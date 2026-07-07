import { describe, expect, it, vi } from 'vitest'
import { makeHabit, makeLog, makeFriend, makeFriendInteraction } from './testHelpers'
import {
  habitPeriodLengthDays,
  isHabitDoneThisPeriod,
  habitDebtOwedToday,
  advanceRecurrence,
  friendTargetIntervalDays,
  isFriendOverdue,
  friendDaysSinceLastInteraction,
} from './utils'

describe('habitPeriodLengthDays', () => {
  it('is 1 day for daily habits', () => {
    expect(habitPeriodLengthDays(makeHabit({ frequency: 'daily' }))).toBe(1)
  })

  it('is floor(7 / times_per_week) for weekly habits', () => {
    expect(habitPeriodLengthDays(makeHabit({ frequency: 'weekly', times_per_week: 2 }))).toBe(3)
    expect(habitPeriodLengthDays(makeHabit({ frequency: 'weekly', times_per_week: 3 }))).toBe(2)
    expect(habitPeriodLengthDays(makeHabit({ frequency: 'weekly', times_per_week: 7 }))).toBe(1)
  })

  it('floors at 1 day even when times_per_week exceeds 7', () => {
    expect(habitPeriodLengthDays(makeHabit({ frequency: 'weekly', times_per_week: 10 }))).toBe(1)
  })

  it('defaults times_per_week to 1 when null', () => {
    expect(habitPeriodLengthDays(makeHabit({ frequency: 'weekly', times_per_week: null }))).toBe(7)
  })
})

describe('isHabitDoneThisPeriod / habitDebtOwedToday', () => {
  it('is not done and owes 1 when there are no logs', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-01T12:00:00Z'))
    try {
      const habit = makeHabit({ created_at: '2026-01-01T00:00:00.000Z', debt: 0 })
      expect(isHabitDoneThisPeriod(habit, [])).toBe(false)
      expect(habitDebtOwedToday(habit, [])).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('is done and owes 0 once logged within the current daily period', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-01T12:00:00Z'))
    try {
      const habit = makeHabit({ created_at: '2026-01-01T00:00:00.000Z', debt: 0 })
      const logs = [makeLog({ habit_id: habit.id, logged_date: '2026-07-01' })]
      expect(isHabitDoneThisPeriod(habit, logs)).toBe(true)
      expect(habitDebtOwedToday(habit, logs)).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('carries existing debt on top of an unlogged current period', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-01T12:00:00Z'))
    try {
      const habit = makeHabit({ created_at: '2026-01-01T00:00:00.000Z', debt: 3 })
      expect(habitDebtOwedToday(habit, [])).toBe(4)
    } finally {
      vi.useRealTimers()
    }
  })

  it('a log logged earlier in a multi-day weekly period still counts as done', () => {
    // created 2026-01-01, 2x/week -> 3-day periods (floor(7/2)). 10 days since
    // creation on 2026-01-11 -> periodIndex 3 -> period covers 01-10..01-12.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-11T12:00:00Z'))
    try {
      const habit = makeHabit({ created_at: '2026-01-01T00:00:00.000Z', frequency: 'weekly', times_per_week: 2, debt: 0 })
      const logs = [makeLog({ habit_id: habit.id, logged_date: '2026-01-10' })]
      expect(isHabitDoneThisPeriod(habit, logs)).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('advanceRecurrence', () => {
  it('advances by days', () => {
    expect(advanceRecurrence('2026-06-30', 3, 'day')).toBe('2026-07-03')
  })

  it('advances by weeks', () => {
    expect(advanceRecurrence('2026-06-30', 2, 'week')).toBe('2026-07-14')
  })

  it('advances by months, clamping end-of-month overflow', () => {
    expect(advanceRecurrence('2026-01-31', 1, 'month')).toBe('2026-02-28')
  })
})

describe('friendTargetIntervalDays', () => {
  it('is infinite when goal_mode is none', () => {
    expect(friendTargetIntervalDays(makeFriend({ goal_mode: 'none' }))).toBe(Infinity)
  })

  it('is goal_count * unit days in interval mode', () => {
    expect(friendTargetIntervalDays(makeFriend({ goal_mode: 'interval', goal_unit: 'week', goal_count: 2 }))).toBe(14)
  })

  it('divides unit days by goal_count in frequency mode, rounded', () => {
    // 2x/week -> every ~4 days
    expect(friendTargetIntervalDays(makeFriend({ goal_mode: 'frequency', goal_unit: 'week', goal_count: 2 }))).toBe(4)
  })

  it('never goes below 1 day in frequency mode', () => {
    expect(friendTargetIntervalDays(makeFriend({ goal_mode: 'frequency', goal_unit: 'day', goal_count: 5 }))).toBe(1)
  })
})

describe('friendDaysSinceLastInteraction / isFriendOverdue', () => {
  it('counts from the most recent interaction date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-10T12:00:00Z'))
    try {
      const friend = makeFriend({ id: 'friend-1' })
      const interactions = [
        makeFriendInteraction({ friend_id: 'friend-1', interaction_date: '2026-07-01' }),
        makeFriendInteraction({ friend_id: 'friend-1', interaction_date: '2026-07-05' }),
      ]
      expect(friendDaysSinceLastInteraction(friend, interactions)).toBe(5)
    } finally {
      vi.useRealTimers()
    }
  })

  it('falls back to created_at when there are no interactions', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-10T12:00:00Z'))
    try {
      const friend = makeFriend({ id: 'friend-1', created_at: '2026-07-01T00:00:00.000Z' })
      expect(friendDaysSinceLastInteraction(friend, [])).toBe(9)
    } finally {
      vi.useRealTimers()
    }
  })

  it('is overdue once days since last interaction reaches the target interval', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-15T12:00:00Z'))
    try {
      const friend = makeFriend({ id: 'friend-1', goal_mode: 'interval', goal_unit: 'week', goal_count: 1 })
      const notYetOverdue = [makeFriendInteraction({ friend_id: 'friend-1', interaction_date: '2026-07-10' })]
      expect(isFriendOverdue(friend, notYetOverdue)).toBe(false)

      const overdue = [makeFriendInteraction({ friend_id: 'friend-1', interaction_date: '2026-07-08' })]
      expect(isFriendOverdue(friend, overdue)).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('is never overdue when goal_mode is none', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-15T12:00:00Z'))
    try {
      const friend = makeFriend({ id: 'friend-1', goal_mode: 'none', created_at: '2020-01-01T00:00:00.000Z' })
      expect(isFriendOverdue(friend, [])).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})
