import { addDays, format, parseISO, subDays } from 'date-fns'
import { supabase } from '../../supabase'

type Result = { error: string | null }

const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

/** Days (yyyy-MM-dd) the user logged reading, newest first, limited to the last `sinceDays` days. */
export async function fetchReadingDays(todayStr: string, sinceDays = 400): Promise<string[]> {
  const since = fmt(subDays(parseISO(todayStr), sinceDays))
  const { data } = await supabase
    .from('reading_days')
    .select('day')
    .gte('day', since)
    .order('day', { ascending: false })
  return (data ?? []).map(r => r.day as string)
}

export async function logReadingDay(day: string): Promise<Result> {
  const { error } = await supabase.from('reading_days').upsert({ day }, { onConflict: 'user_id,day' })
  return { error: error?.message ?? null }
}

export async function unlogReadingDay(day: string): Promise<Result> {
  const { error } = await supabase.from('reading_days').delete().eq('day', day)
  return { error: error?.message ?? null }
}

/**
 * Consecutive days read. A streak stays alive through today: if today isn't logged yet it is
 * counted up to yesterday, so the number only drops once a whole day has been missed.
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

/** The last `count` days ending today, oldest first, flagged with whether each was read. */
export function recentDays(days: readonly string[], todayStr: string, count = 7) {
  const set = new Set(days)
  const start = subDays(parseISO(todayStr), count - 1)
  return Array.from({ length: count }, (_, i) => {
    const d = addDays(start, i)
    const key = fmt(d)
    return { key, label: format(d, 'EEEEE'), read: set.has(key), isToday: key === todayStr }
  })
}

/** Short, rotating nudge for a day that hasn't been read yet. Escalates in the evening. */
export function nudgeCopy(streak: number, hour: number, dayOfYear: number): { title: string; sub: string } {
  if (streak > 0 && hour >= 20) {
    return { title: `Your ${streak}-day streak ends at midnight`, sub: 'Even one page keeps it alive' }
  }
  const prompts = [
    'Just 10 pages today?',
    'Your book is waiting',
    'Read a chapter before bed?',
    'Five minutes. That’s all.',
    'One page counts',
  ]
  const title = prompts[dayOfYear % prompts.length]
  return { title, sub: streak > 0 ? `Keep your ${streak}-day streak going` : 'Start a streak today' }
}
