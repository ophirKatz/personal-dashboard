import { addDays, format, parseISO, subDays } from 'date-fns'

const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

/** Workouts per day. `dates` holds one entry per logged workout, so a day with two appears twice. */
export function countByDay(dates: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const d of dates) counts.set(d, (counts.get(d) ?? 0) + 1)
  return counts
}

/**
 * Past workouts still owed, carried over from missed days the way a habit carries its debt.
 *
 * Walks forward from `startDate`: a finished day with no workout adds one to what's owed, and each
 * extra workout beyond a day's first pays one off. Extras only pay misses that came before them, so
 * a big day can't pre-pay the future. Today is never a miss (it isn't over), but extras logged today
 * do pay down earlier misses.
 */
export function missedWorkouts(dates: readonly string[], startDate: string, todayStr: string): number {
  const counts = countByDay(dates)
  let owed = 0
  for (let d = parseISO(startDate); fmt(d) <= todayStr; d = addDays(d, 1)) {
    const key = fmt(d)
    const n = counts.get(key) ?? 0
    if (n === 0) {
      if (key !== todayStr) owed++
    } else {
      owed = Math.max(0, owed - (n - 1))
    }
  }
  return owed
}

export type WorkoutDay = { key: string; label: string; count: number; isToday: boolean }

/** The last `count` days ending today, oldest first, each with how many workouts were logged. */
export function workoutWeek(dates: readonly string[], todayStr: string, count = 7): WorkoutDay[] {
  const counts = countByDay(dates)
  const start = subDays(parseISO(todayStr), count - 1)
  return Array.from({ length: count }, (_, i) => {
    const d = addDays(start, i)
    const key = fmt(d)
    return { key, label: format(d, 'EEEEE'), count: counts.get(key) ?? 0, isToday: key === todayStr }
  })
}

const NUDGES = [
  'Time for your home workout',
  'Get your reps in today',
  'A quick session counts',
  'Your future self says thanks',
  'Ten minutes beats zero',
]

/** Short, rotating nudge for a day with no workout yet. Escalates in the evening. */
export function workoutNudge(streak: number, missed: number, hour: number, dayOfYear: number): { title: string; sub: string } {
  const owed = missed > 0 ? `${missed} missed ${missed === 1 ? 'workout' : 'workouts'} to make up` : null
  if (streak > 0 && hour >= 20) {
    return { title: `Your ${streak}-day streak ends at midnight`, sub: owed ?? 'Even a short one keeps it alive' }
  }
  return {
    title: NUDGES[dayOfYear % NUDGES.length],
    sub: owed ?? (streak > 0 ? `Keep your ${streak}-day streak going` : 'Start a streak today'),
  }
}

const REMINDER_TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/** Trims Postgres `HH:MM:SS` to `HH:MM`, drops anything invalid, and returns the times de-duplicated and sorted. */
export function normalizeReminderTimes(times: readonly string[] | null | undefined): string[] {
  const valid = (times ?? []).map(t => t.slice(0, 5)).filter(t => REMINDER_TIME.test(t))
  return [...new Set(valid)].sort()
}
