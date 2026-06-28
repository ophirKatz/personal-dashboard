import { useState } from 'react'
import { Flame, Trash2, Pencil, Bell } from 'lucide-react'
import { supabase } from '../../supabase'
import type { Habit, HabitLog } from '../../supabase'
import { today, formatTime, utcTimeToLocalTime } from '../../utils'
import { haptic } from '../../lib/haptics'
import { celebrateFromElement } from '../../lib/confetti'
import HabitHeatmap from './HabitHeatmap'

type Props = {
  habit: Habit
  logs: HabitLog[]
  onEdit: () => void
  onDelete: () => void
  onLogChange: () => void
}

function computeStreak(logs: HabitLog[], frequency: 'daily' | 'weekly'): number {
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

export default function HabitCard({ habit, logs, onEdit, onDelete, onLogChange }: Props) {
  const [expanded, setExpanded] = useState(false)
  const todayLog = logs.find(l => l.logged_date === today())
  const todayLogged = todayLog != null
  const fullyDone = todayLogged && habit.debt === 0
  const partiallyDone = todayLogged && habit.debt > 0
  const streak = computeStreak(logs, habit.frequency)
  const logDates = logs.map(l => l.logged_date)

  async function toggleToday(e: React.MouseEvent<HTMLButtonElement>) {
    haptic(todayLogged ? 'light' : 'success')
    if (!todayLogged) celebrateFromElement(e.currentTarget)
    if (todayLogged) {
      await supabase
        .from('habit_logs')
        .delete()
        .eq('habit_id', habit.id)
        .eq('logged_date', today())
      if (todayLog?.paid_debt) {
        await supabase.from('habits').update({ debt: habit.debt + 1 }).eq('id', habit.id)
      }
    } else {
      const paidDebt = habit.debt > 0
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('habit_logs').insert({
        habit_id: habit.id,
        user_id: user!.id,
        logged_date: today(),
        paid_debt: paidDebt,
      })
      if (paidDebt) {
        await supabase.from('habits').update({ debt: habit.debt - 1 }).eq('id', habit.id)
      }
    }
    onLogChange()
  }

  function handleDelete() {
    haptic('warning')
    onDelete()
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <button
          onClick={toggleToday}
          title={partiallyDone ? `Logged today — ${habit.debt} owed still` : undefined}
          className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 transition-transform active:scale-95 ${
            partiallyDone ? 'border-2 border-dashed border-destructive' : ''
          }`}
          style={{
            backgroundColor: todayLogged ? habit.color : 'hsl(var(--muted))',
            opacity: fullyDone ? 1 : todayLogged ? 0.75 : 0.6,
          }}
        >
          {habit.emoji}
        </button>
        <div className="flex-1 min-w-0" onClick={() => setExpanded(e => !e)}>
          <div className="font-medium truncate">{habit.name}</div>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mt-0.5 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <Flame className="h-3.5 w-3.5 text-orange-400 shrink-0" />
              {streak} day streak
            </span>
            <span className="whitespace-nowrap">
              <span className="text-border">· </span>
              {habit.frequency === 'daily' ? 'Daily' : `${habit.times_per_week}×/week`}
            </span>
            {habit.reminder_enabled && habit.reminder_time && (
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <span className="text-border">·</span>
                <Bell className="h-3.5 w-3.5 shrink-0" />
                {formatTime(utcTimeToLocalTime(habit.reminder_time.slice(0, 5)))}
              </span>
            )}
            {habit.debt > 0 && (
              <span className="inline-flex items-center whitespace-nowrap rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                {habit.debt} owed
              </span>
            )}
            {todayLog?.paid_debt && (
              <span className="inline-flex items-center whitespace-nowrap rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                paid 1 today
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEdit} className="p-2 rounded-lg hover:bg-accent text-muted-foreground">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={handleDelete} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-3">
          <HabitHeatmap logs={logDates} color={habit.color} />
        </div>
      )}
    </div>
  )
}
