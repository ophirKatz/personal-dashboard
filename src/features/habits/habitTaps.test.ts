import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Habit, HabitLog } from '../../supabase'
import { today } from '../../utils'

const { authGetUser, fromMock, insertMock, updateMock, deleteMock, eqMock } = vi.hoisted(() => {
  const eqMock = vi.fn().mockResolvedValue({ data: null, error: null })
  const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })
  const updateMock = vi.fn(() => ({ eq: eqMock }))
  const deleteMock = vi.fn(() => ({ eq: eqMock }))
  const fromMock = vi.fn(() => ({ insert: insertMock, update: updateMock, delete: deleteMock }))
  const authGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } })
  return { authGetUser, fromMock, insertMock, updateMock, deleteMock, eqMock }
})

vi.mock('../../supabase', () => ({
  supabase: {
    from: fromMock,
    auth: { getUser: authGetUser },
  },
}))

const { decideHabitTap, executeHabitTap } = await import('./habitTaps')

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    user_id: 'user-1',
    name: 'Daily pushups',
    emoji: '💪',
    color: '#3b82f6',
    frequency: 'daily',
    times_per_week: null,
    reminder_enabled: false,
    reminder_time: null,
    last_notified_date: null,
    created_at: '2026-01-01T00:00:00.000Z',
    debt: 0,
    debt_checked_date: null,
    ...overrides,
  }
}

function makeLog(overrides: Partial<HabitLog> = {}): HabitLog {
  return {
    id: 'log-1',
    habit_id: 'habit-1',
    user_id: 'user-1',
    logged_date: today(),
    created_at: '2026-06-29T08:00:00.000Z',
    paid_debt: false,
    ...overrides,
  }
}

describe('decideHabitTap', () => {
  it('pays down debt on the first tap of the day, without logging yet', () => {
    const habit = makeHabit({ debt: 3 })
    expect(decideHabitTap(habit, [])).toEqual({ type: 'pay', paidDebt: true })
  })

  // Regression test for the reported bug: tapping a habit with remaining
  // debt repeatedly should keep paying it down like a counter, not flip
  // back to "not completed" on the second tap.
  it('keeps paying down debt on repeated taps the same day instead of undoing the first tap', () => {
    const habit = makeHabit({ debt: 2 })
    const logsAfterFirstTap = [makeLog({ id: 'log-1', paid_debt: true })]
    expect(decideHabitTap(habit, logsAfterFirstTap)).toEqual({ type: 'pay', paidDebt: true })

    const habitAfterSecondTap = makeHabit({ debt: 1 })
    const logsAfterSecondTap = [
      makeLog({ id: 'log-1', paid_debt: true }),
      makeLog({ id: 'log-2', paid_debt: true, created_at: '2026-06-29T08:01:00.000Z' }),
    ]
    expect(decideHabitTap(habitAfterSecondTap, logsAfterSecondTap)).toEqual({ type: 'pay', paidDebt: true })
  })

  it('marks today done without touching debt once debt is already zero', () => {
    const habit = makeHabit({ debt: 0 })
    expect(decideHabitTap(habit, [])).toEqual({ type: 'pay', paidDebt: false })
  })

  it('undoes the most recent log once nothing is owed today', () => {
    const habit = makeHabit({ debt: 0 })
    const logs = [
      makeLog({ id: 'log-1', paid_debt: true, created_at: '2026-06-29T08:00:00.000Z' }),
      makeLog({ id: 'log-2', paid_debt: true, created_at: '2026-06-29T08:01:00.000Z' }),
    ]
    expect(decideHabitTap(habit, logs)).toEqual({ type: 'undo', logId: 'log-2', refundDebt: true })
  })

  it('does nothing when fully caught up and there is no log for today to undo', () => {
    // Pinned rather than relative to the real clock: the fixture log must land
    // in the same 3-day period as "today" (2x/week -> floor(7/2) day periods,
    // anchored to created_at) without being dated exactly today, which only
    // holds for specific date/anchor combinations — this pairing was verified
    // to satisfy that, but drifts if left to the wall clock.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-29T12:00:00Z'))
    try {
      const habit = makeHabit({ debt: 0, frequency: 'weekly', times_per_week: 2 })
      const logs = [makeLog({ logged_date: '2026-06-28', paid_debt: false })]
      expect(decideHabitTap(habit, logs)).toEqual({ type: 'noop' })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('executeHabitTap', () => {
  beforeEach(() => {
    fromMock.mockClear()
    insertMock.mockClear()
    updateMock.mockClear()
    deleteMock.mockClear()
    eqMock.mockClear()
  })

  it('inserts a log and decrements debt when paying down debt', async () => {
    const habit = makeHabit({ id: 'habit-1', debt: 2 })
    await executeHabitTap(habit, { type: 'pay', paidDebt: true })

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ habit_id: 'habit-1', user_id: 'user-1', paid_debt: true }),
    )
    expect(updateMock).toHaveBeenCalledWith({ debt: 1 })
  })

  it('inserts a log without touching debt when there is nothing to pay', async () => {
    const habit = makeHabit({ id: 'habit-1', debt: 0 })
    await executeHabitTap(habit, { type: 'pay', paidDebt: false })

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ habit_id: 'habit-1', paid_debt: false }),
    )
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('deletes the log and refunds debt when undoing', async () => {
    const habit = makeHabit({ id: 'habit-1', debt: 0 })
    await executeHabitTap(habit, { type: 'undo', logId: 'log-2', refundDebt: true })

    expect(deleteMock).toHaveBeenCalled()
    expect(eqMock).toHaveBeenCalledWith('id', 'log-2')
    expect(updateMock).toHaveBeenCalledWith({ debt: 1 })
  })

  it('does nothing on noop', async () => {
    const habit = makeHabit({ id: 'habit-1', debt: 0 })
    await executeHabitTap(habit, { type: 'noop' })

    expect(insertMock).not.toHaveBeenCalled()
    expect(deleteMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
  })
})
