import { format, parseISO, subDays } from 'date-fns'

const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

/**
 * Consecutive days (yyyy-MM-dd) present in `days`. A streak stays alive through today: if today
 * isn't logged yet it is counted up to yesterday, so the number only drops once a whole day has
 * been missed.
 */
export function currentStreak(days: readonly string[], todayStr: string): number {
  const set = new Set(days)
  let cursor = parseISO(todayStr)
  if (!set.has(fmt(cursor))) cursor = subDays(cursor, 1)
  let streak = 0
  while (set.has(fmt(cursor))) {
    streak++
    cursor = subDays(cursor, 1)
  }
  return streak
}
