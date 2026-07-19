import { supabase } from '../../supabase'
import type { Habit, HabitLog, HabitStatus } from '../../supabase'
import { habitDebtOwedToday, isHabitDueToday, today } from '../../utils'
import { decideHabitTap, executeHabitTap } from './habitTaps'

export async function fetchHabitsV2Enabled(): Promise<boolean> {
  const { data } = await supabase.from('app_settings').select('habits_v2_enabled').eq('id', true).maybeSingle()
  return data?.habits_v2_enabled ?? false
}

// Moved verbatim from HabitCard.tsx (including the weekly-habit quirk,
// where streak is just the total log count rather than a period-aware
// walk) — v1 is preserved exactly as it behaves today, bugs included.
// Only used by computeHabitStatusV1 below; v2's streak comes from the
// habit_status view's server-computed habit_streak() instead.
function computeStreak(logs: HabitLog[], frequency: Habit['frequency']): number {
  if (!logs.length) return 0
  const sorted = [...logs].sort((a, b) => b.logged_date.localeCompare(a.logged_date))
  if (frequency === 'daily') {
    let streak = 0
    const d = new Date()
    for (const log of sorted) {
      const expected = new Date(d)
      expected.setHours(0, 0, 0, 0)
      const logDate = new Date(log.logged_date)
      logDate.setHours(0, 0, 0, 0)
      if (logDate.getTime() === expected.getTime()) {
        streak++
        d.setDate(d.getDate() - 1)
      } else if (logDate.getTime() < expected.getTime()) {
        break
      }
    }
    return streak
  }
  return sorted.length
}

// Repackages the existing, unmodified v1 debt/period functions from
// src/utils.ts into the same HabitStatus shape the habit_status view
// provides for v2, so downstream components can consume either uniformly.
export function computeHabitStatusV1(habit: Habit, logs: HabitLog[]): HabitStatus {
  const habitLogs = logs.filter(l => l.habit_id === habit.id)
  const todayLogs = habitLogs.filter(l => l.logged_date === today())
  return {
    ...habit,
    owed_count: habitDebtOwedToday(habit, logs),
    is_due_today: isHabitDueToday(habit, logs),
    streak: computeStreak(habitLogs, habit.frequency),
    logged_today: todayLogs.length > 0,
    logged_today_count: todayLogs.length,
  }
}

// Single fetch entry point for both implementations. v2 reads the
// habit_status view (server-computed); v1 reads the raw habits table and
// computes the same shape client-side via computeHabitStatusV1, exactly as
// Habits.tsx/Dashboard.tsx did before this module existed.
export async function loadHabitStatuses(v2: boolean, sinceDate: string): Promise<{ statuses: HabitStatus[]; logs: HabitLog[] }> {
  const logsPromise = supabase.from('habit_logs').select('*').gte('logged_date', sinceDate)

  if (v2) {
    const [{ data: statusRows }, { data: logs }] = await Promise.all([
      supabase.from('habit_status').select('*').order('created_at'),
      logsPromise,
    ])
    return { statuses: (statusRows ?? []) as HabitStatus[], logs: logs ?? [] }
  }

  const [{ data: habits }, { data: logs }] = await Promise.all([
    supabase.from('habits').select('*').order('created_at'),
    logsPromise,
  ])
  const logList = logs ?? []
  const statuses = ((habits ?? []) as Habit[]).map(h => computeHabitStatusV1(h, logList))
  return { statuses, logs: logList }
}

// Single mutation entry point. v2 calls the atomic RPC; v1 keeps using the
// existing, unmodified decideHabitTap/executeHabitTap client-side flow.
export async function toggleHabitCompletion(habit: HabitStatus, habitLogs: HabitLog[], v2: boolean): Promise<void> {
  if (v2) {
    await supabase.rpc('toggle_habit_completion', { p_habit_id: habit.id })
    return
  }
  const action = decideHabitTap(habit, habitLogs)
  await executeHabitTap(habit, action)
}
