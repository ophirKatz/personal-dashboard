import { supabase } from '../../supabase'
import type { Habit, HabitLog } from '../../supabase'
import { habitDebtOwedToday, today } from '../../utils'

export type HabitTapAction =
  | { type: 'pay'; paidDebt: boolean }
  | { type: 'undo'; logId: string; refundDebt: boolean }
  | { type: 'noop' }

// While anything is still owed for the current period (today's rep, plus
// any carried-over debt), each tap should log one more unit of progress —
// a counter, not a toggle. Only once nothing is owed does a further tap
// undo the most recent log, so an accidental extra tap can be corrected.
export function decideHabitTap(habit: Habit, logs: HabitLog[]): HabitTapAction {
  if (habitDebtOwedToday(habit, logs) > 0) {
    return { type: 'pay', paidDebt: habit.debt > 0 }
  }
  const mostRecentToday = logs
    .filter(l => l.habit_id === habit.id && l.logged_date === today())
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
  if (!mostRecentToday) return { type: 'noop' }
  return { type: 'undo', logId: mostRecentToday.id, refundDebt: mostRecentToday.paid_debt }
}

// Lets callers update local state directly from the result instead of
// re-fetching habits/logs after every tap — newDebt is null when the tap
// didn't touch debt, so callers can skip that part of the state update.
export type HabitTapResult =
  | { type: 'insert'; log: HabitLog; newDebt: number | null }
  | { type: 'delete'; logId: string; newDebt: number | null }
  | { type: 'noop' }

export async function executeHabitTap(habit: Habit, action: HabitTapAction): Promise<HabitTapResult> {
  if (action.type === 'pay') {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: log, error } = await supabase
      .from('habit_logs')
      .insert({
        habit_id: habit.id,
        user_id: user!.id,
        logged_date: today(),
        paid_debt: action.paidDebt,
      })
      .select()
      .single()
    if (error || !log) throw error ?? new Error('Failed to insert habit log')

    let newDebt: number | null = null
    if (action.paidDebt) {
      newDebt = habit.debt - 1
      await supabase.from('habits').update({ debt: newDebt }).eq('id', habit.id)
    }
    return { type: 'insert', log: log as HabitLog, newDebt }
  }

  if (action.type === 'undo') {
    await supabase.from('habit_logs').delete().eq('id', action.logId)
    let newDebt: number | null = null
    if (action.refundDebt) {
      newDebt = habit.debt + 1
      await supabase.from('habits').update({ debt: newDebt }).eq('id', habit.id)
    }
    return { type: 'delete', logId: action.logId, newDebt }
  }

  return { type: 'noop' }
}
