import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Habit, HabitLog } from '../../supabase'
import { today } from '../../utils'
import { subDays, format } from 'date-fns'

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

  it('logs today\'s completion when debt is zero but period not done', () => {
    const todayStr = today()
    const habit = makeHabit({ debt: 0 })
    // With debt = 0 but no log for today, current period is owed
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
    const todayStr = today()
    // For a weekly habit (period = 3 days), once logged in current period, period is satisfied
    const habit = makeHabit({
      debt: 0,
      frequency: 'weekly',
      times_per_week: 2
    })
    // Simulate: logged yesterday (within current 3-day period) but not today
    // Get a date string for yesterday
    const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd')
    const logs = [makeLog({ logged_date: yesterdayStr, paid_debt: false })]

    // Period is satisfied by yesterday's log, debt = 0, no log today → noop
    expect(decideHabitTap(habit, logs)).toEqual({ type: 'noop' })
  })
})

describe('Multiple debt payments on same day', () => {
  it('shows remaining debt after first payment when debt >= 2', () => {
    const habit = makeHabit({ debt: 2 })
    // First tap with debt = 2
    expect(decideHabitTap(habit, [])).toEqual({ type: 'pay', paidDebt: true })

    // After first tap, debt should be decremented but the habit should still owe something
    const habitAfterFirstTap = makeHabit({ debt: 1 })
    const logsAfterFirstTap = [makeLog({ id: 'log-1', paid_debt: true })]

    // `habitDebtOwedToday` should still be > 0 (1 debt + 0 for period done = 1)
    expect(decideHabitTap(habitAfterFirstTap, logsAfterFirstTap)).toEqual({ type: 'pay', paidDebt: true })

    // After second tap, debt = 0 but still show as due because period is done
    const habitAfterSecondTap = makeHabit({ debt: 0 })
    const logsAfterSecondTap = [
      makeLog({ id: 'log-1', paid_debt: true }),
      makeLog({ id: 'log-2', paid_debt: true, created_at: '2026-06-29T08:01:00.000Z' }),
    ]

    // `habitDebtOwedToday` = 0 + 0 = 0 (debt paid, period done)
    // So next tap should undo, not pay
    expect(decideHabitTap(habitAfterSecondTap, logsAfterSecondTap)).toEqual({ type: 'undo', logId: 'log-2', refundDebt: true })
  })

  it('correctly accumulates and pays debt over multiple missed periods', () => {
    // Scenario: User misses 3 days of daily pushups (debt accumulates to 3)
    // Then on day 4, user completes the habit 3 times to pay off all debt

    const todayStr = today()
    const habit = makeHabit({ debt: 3 }) // 3 days of accumulated debt

    // First completion: debt = 3, period not done
    // habitDebtOwedToday = 3 + 1 = 4, so pay with paidDebt: true
    expect(decideHabitTap(habit, [])).toEqual({ type: 'pay', paidDebt: true })

    // After first completion: debt = 2, period is now done by first log
    const habitAfter1st = makeHabit({ debt: 2 })
    const logsAfter1st = [makeLog({ id: 'log-1', logged_date: todayStr, paid_debt: true })]
    // habitDebtOwedToday = 2 + 0 = 2 (debt still owed, period done)
    expect(decideHabitTap(habitAfter1st, logsAfter1st)).toEqual({ type: 'pay', paidDebt: true })

    // After second completion: debt = 1
    const habitAfter2nd = makeHabit({ debt: 1 })
    const logsAfter2nd = [
      makeLog({ id: 'log-1', logged_date: todayStr, paid_debt: true }),
      makeLog({ id: 'log-2', logged_date: todayStr, paid_debt: true, created_at: '2026-06-29T08:01:00.000Z' })
    ]
    // habitDebtOwedToday = 1 + 0 = 1 (still owed)
    expect(decideHabitTap(habitAfter2nd, logsAfter2nd)).toEqual({ type: 'pay', paidDebt: true })

    // After third completion: debt = 0, fully paid
    const habitAfter3rd = makeHabit({ debt: 0 })
    const logsAfter3rd = [
      makeLog({ id: 'log-1', logged_date: todayStr, paid_debt: true }),
      makeLog({ id: 'log-2', logged_date: todayStr, paid_debt: true, created_at: '2026-06-29T08:01:00.000Z' }),
      makeLog({ id: 'log-3', logged_date: todayStr, paid_debt: true, created_at: '2026-06-29T08:02:00.000Z' })
    ]
    // habitDebtOwedToday = 0 + 0 = 0 (fully paid, period done)
    // Next tap should undo the last log
    expect(decideHabitTap(habitAfter3rd, logsAfter3rd)).toEqual({ type: 'undo', logId: 'log-3', refundDebt: true })
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
