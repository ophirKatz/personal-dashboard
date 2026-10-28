import { describe, expect, it } from 'vitest'
import { countByDay, missedWorkouts, normalizeReminderTimes, workoutNudge, workoutWeek } from './workoutTracking'

describe('countByDay', () => {
  it('counts each logged workout, so two on one day count twice', () => {
    expect(countByDay(['2026-10-28', '2026-10-28', '2026-10-27'])).toEqual(
      new Map([['2026-10-28', 2], ['2026-10-27', 1]]),
    )
  })
})

describe('missedWorkouts', () => {
  const start = '2026-10-20'

  it('owes nothing on the first day, even with no workout yet', () => {
    expect(missedWorkouts([], start, start)).toBe(0)
  })

  it('never counts today as missed', () => {
    expect(missedWorkouts(['2026-10-20', '2026-10-21'], start, '2026-10-22')).toBe(0)
  })

  it('carries each finished day without a workout', () => {
    // 20th and 22nd done; 21st and 23rd missed; 24th is today.
    expect(missedWorkouts(['2026-10-20', '2026-10-22'], start, '2026-10-24')).toBe(2)
  })

  it('counts the start day itself once it has passed', () => {
    expect(missedWorkouts([], start, '2026-10-21')).toBe(1)
  })

  it('lets an extra workout on a later day pay one back', () => {
    // 21st missed; two workouts on the 22nd: one covers the day, the extra pays the miss.
    expect(missedWorkouts(['2026-10-20', '2026-10-22', '2026-10-22'], start, '2026-10-23')).toBe(0)
  })

  it('lets an extra workout today pay down earlier misses', () => {
    expect(missedWorkouts(['2026-10-20', '2026-10-23', '2026-10-23'], start, '2026-10-23')).toBe(1)
  })

  it('does not let an extra pre-pay a miss that comes later', () => {
    // Three workouts on the 20th, then nothing on the 21st and 22nd.
    expect(missedWorkouts(['2026-10-20', '2026-10-20', '2026-10-20'], start, '2026-10-23')).toBe(2)
  })

  it('never goes negative', () => {
    expect(missedWorkouts(['2026-10-20', '2026-10-20', '2026-10-20'], start, '2026-10-20')).toBe(0)
  })

  it('ignores workouts from before tracking started', () => {
    expect(missedWorkouts(['2026-10-10', '2026-10-10', '2026-10-10'], start, '2026-10-23')).toBe(3)
  })

  it('owes nothing when tracking starts in the future', () => {
    expect(missedWorkouts([], '2026-11-01', '2026-10-23')).toBe(0)
  })
})

describe('workoutWeek', () => {
  it('returns 7 days oldest first with per-day counts and today flagged', () => {
    const week = workoutWeek(['2026-10-28', '2026-10-28', '2026-10-26'], '2026-10-28')
    expect(week).toHaveLength(7)
    expect(week[0].key).toBe('2026-10-22')
    expect(week[6]).toMatchObject({ key: '2026-10-28', count: 2, isToday: true })
    expect(week.filter(d => d.count > 0).map(d => d.key)).toEqual(['2026-10-26', '2026-10-28'])
  })

  it('uses single-letter weekday labels', () => {
    // Thu 22 Oct through Wed 28 Oct 2026.
    expect(workoutWeek([], '2026-10-28').map(d => d.label).join('')).toBe('TFSSMTW')
  })
})

describe('workoutNudge', () => {
  it('escalates in the evening when a streak is at stake', () => {
    expect(workoutNudge(5, 0, 21, 0)).toEqual({ title: 'Your 5-day streak ends at midnight', sub: 'Even a short one keeps it alive' })
  })

  it('does not escalate without a streak', () => {
    expect(workoutNudge(0, 0, 21, 0).title).not.toContain('midnight')
  })

  it('mentions missed workouts instead of the streak line', () => {
    expect(workoutNudge(3, 2, 10, 0).sub).toBe('2 missed workouts to make up')
    expect(workoutNudge(3, 1, 10, 0).sub).toBe('1 missed workout to make up')
  })

  it('encourages a streak, or starting one', () => {
    expect(workoutNudge(4, 0, 10, 0).sub).toBe('Keep your 4-day streak going')
    expect(workoutNudge(0, 0, 10, 0).sub).toBe('Start a streak today')
  })

  it('rotates the title by day of year', () => {
    expect(workoutNudge(0, 0, 10, 0).title).not.toBe(workoutNudge(0, 0, 10, 1).title)
  })
})

describe('normalizeReminderTimes', () => {
  it('trims Postgres times, drops invalid ones, de-duplicates and sorts', () => {
    expect(normalizeReminderTimes(['21:00:00', '07:30:00', '21:00', '25:00', 'abc', ''])).toEqual(['07:30', '21:00'])
  })
  it('tolerates null', () => {
    expect(normalizeReminderTimes(null)).toEqual([])
  })
})
