import { describe, expect, it, vi } from 'vitest'
import type { Habit, HabitLog } from '../../supabase'
import { today } from '../../utils'

vi.mock('../../supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}))

const { computeHabitStatusV1 } = await import('./habitStatus')

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    user_id: 'user-1',
    name: 'Daily pushups',
    emoji: '💪',
    color: '#3b82f6',
    frequency: 'daily',
    times_per_week: null,
    interval_days: null,
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

describe('computeHabitStatusV1', () => {
  it('repackages debt/period math into the HabitStatus shape without changing the numbers', () => {
    const habit = makeHabit({ debt: 2 })
    const status = computeHabitStatusV1(habit, [])

    expect(status.owed_count).toBe(3) // 2 past debt + 1 for today's undone period
    expect(status.is_due_today).toBe(true)
    expect(status.logged_today).toBe(false)
    expect(status.logged_today_count).toBe(0)
    // Habit fields pass through unchanged.
    expect(status.id).toBe('habit-1')
    expect(status.debt).toBe(2)
  })

  it('reports zero owed and logged_today once todays log covers the period', () => {
    const habit = makeHabit({ debt: 0 })
    const logs = [makeLog({ logged_date: today() })]
    const status = computeHabitStatusV1(habit, logs)

    expect(status.owed_count).toBe(0)
    expect(status.is_due_today).toBe(false)
    expect(status.logged_today).toBe(true)
    expect(status.logged_today_count).toBe(1)
  })

  it('only counts streak/today fields for logs belonging to the given habit', () => {
    const habit = makeHabit({ id: 'habit-1', debt: 0 })
    const logs = [
      makeLog({ habit_id: 'habit-1', logged_date: today() }),
      makeLog({ id: 'log-2', habit_id: 'other-habit', logged_date: today() }),
    ]
    const status = computeHabitStatusV1(habit, logs)

    expect(status.logged_today_count).toBe(1)
  })

  it('reproduces the known weekly-streak quirk (total log count, not period-aware)', () => {
    const habit = makeHabit({ frequency: 'weekly', times_per_week: 2, debt: 0 })
    const logs = [
      makeLog({ id: 'log-1', logged_date: '2026-01-05' }),
      makeLog({ id: 'log-2', logged_date: '2026-01-08' }),
      makeLog({ id: 'log-3', logged_date: '2026-01-12' }),
    ]
    const status = computeHabitStatusV1(habit, logs)

    expect(status.streak).toBe(3)
  })
})
