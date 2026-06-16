import { useState } from 'react'
import { Flame, Trash2, Pencil } from 'lucide-react'
import { supabase } from '../../supabase'
import type { Habit, HabitLog } from '../../supabase'
import { today } from '../../utils'
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
  const todayLogged = logs.some(l => l.logged_date === today())
  const streak = computeStreak(logs, habit.frequency)
  const logDates = logs.map(l => l.logged_date)

  async function toggleToday() {
    if (todayLogged) {
      await supabase
        .from('habit_logs')
        .delete()
        .eq('habit_id', habit.id)
        .eq('logged_date', today())
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('habit_logs').insert({
        habit_id: habit.id,
        user_id: user!.id,
        logged_date: today(),
      })
    }
    onLogChange()
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <button
          onClick={toggleToday}
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 transition-transform active:scale-95"
          style={{
            backgroundColor: todayLogged ? habit.color : 'hsl(var(--muted))',
            opacity: todayLogged ? 1 : 0.6,
          }}
        >
          {habit.emoji}
        </button>
        <div className="flex-1 min-w-0" onClick={() => setExpanded(e => !e)}>
          <div className="font-medium truncate">{habit.name}</div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Flame className="h-3.5 w-3.5 text-orange-400" />
            <span>{streak} day streak</span>
            <span className="mx-1">·</span>
            <span>{habit.frequency === 'daily' ? 'Daily' : `${habit.times_per_week}×/week`}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-2 rounded-lg hover:bg-accent text-muted-foreground">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={onDelete} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-destructive">
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
