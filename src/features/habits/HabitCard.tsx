import { useState } from 'react'
import { Flame, Trash2, Pencil, Bell } from 'lucide-react'
import type { HabitLog, HabitStatus } from '../../supabase'
import { formatTime, utcTimeToLocalTime } from '../../utils'
import { haptic } from '../../lib/haptics'
import { celebrateFromElement } from '../../lib/confetti'
import { toggleHabitCompletion } from './habitStatus'
import HabitHeatmap from './HabitHeatmap'

type Props = {
  habit: HabitStatus
  logs: HabitLog[]
  v2Enabled: boolean
  onEdit: () => void
  onDelete: () => void
  onLogChange: () => void
}

export default function HabitCard({ habit, logs, v2Enabled, onEdit, onDelete, onLogChange }: Props) {
  const [expanded, setExpanded] = useState(false)
  const todayLogged = habit.logged_today
  const fullyDone = todayLogged && habit.owed_count === 0
  const partiallyDone = todayLogged && habit.owed_count > 0
  const streak = habit.streak
  const logDates = logs.map(l => l.logged_date)

  async function toggleToday(e: React.MouseEvent<HTMLButtonElement>) {
    const willLog = habit.owed_count > 0
    haptic(willLog ? 'success' : 'light')
    if (willLog) celebrateFromElement(e.currentTarget)
    await toggleHabitCompletion(habit, logs, v2Enabled)
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
          title={partiallyDone ? `Logged today — ${habit.owed_count} owed still` : undefined}
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
              {habit.frequency === 'daily'
                ? 'Daily'
                : habit.frequency === 'weekly'
                ? `${habit.times_per_week}×/week`
                : `Every ${habit.interval_days} days`}
            </span>
            {habit.reminder_enabled && habit.reminder_time && (
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <span className="text-border">·</span>
                <Bell className="h-3.5 w-3.5 shrink-0" />
                {formatTime(utcTimeToLocalTime(habit.reminder_time.slice(0, 5)))}
              </span>
            )}
            {habit.owed_count > 0 && (
              <span className="inline-flex items-center whitespace-nowrap rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                {habit.owed_count} owed
              </span>
            )}
            {habit.logged_today_count > 0 && (
              <span className="inline-flex items-center whitespace-nowrap rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {habit.logged_today_count}× today
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
