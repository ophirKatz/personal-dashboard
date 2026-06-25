import { Link } from 'react-router-dom'
import { CheckCircle2, ChevronRight, Clock } from 'lucide-react'
import type { Habit, HabitLog, Todo } from '../../supabase'
import { formatTime } from '../../utils'
import WeatherWidget from '../weather/WeatherWidget'
import { celebrateFromElement } from '../../lib/confetti'

export type TodayEvent = {
  id: string
  title: string
  time: string | null
  source: 'local' | 'google'
}

type Props = {
  habits: Habit[]
  todayLogs: HabitLog[]
  onToggleHabit: (habit: Habit) => void
  todos: Todo[]
  onCompleteTodo: (id: string) => void
  events: TodayEvent[]
}

const PRIORITY_DOT = {
  low: 'bg-blue-500',
  medium: 'bg-amber-500',
  high: 'bg-red-500',
} as const

export default function TodaySection({ habits, todayLogs, onToggleHabit, todos, onCompleteTodo, events }: Props) {
  const doneCount = habits.filter(h => todayLogs.some(l => l.habit_id === h.id)).length

  return (
    <div className="bg-card border border-border rounded-xl p-3.5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Today</h2>
        <WeatherWidget />
      </div>

      {habits.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Habits</span>
            <span className="text-xs text-muted-foreground">{doneCount}/{habits.length}</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
            {habits.map(habit => {
              const done = todayLogs.some(l => l.habit_id === habit.id)
              return (
                <button
                  key={habit.id}
                  onClick={e => {
                    if (!done) celebrateFromElement(e.currentTarget)
                    onToggleHabit(habit)
                  }}
                  className="flex flex-col items-center gap-1 shrink-0 relative"
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-xl transition-all active:scale-95"
                    style={{ backgroundColor: done ? habit.color : 'hsl(var(--muted))', opacity: done ? 1 : 0.5 }}
                  >
                    {habit.emoji}
                  </div>
                  {done && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary absolute -top-1 -right-1 bg-background rounded-full" />
                  )}
                  <span className="text-[10px] text-muted-foreground max-w-[48px] truncate">{habit.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="space-y-2 border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Tasks</span>
          <Link to="/todos" className="flex items-center gap-0.5 text-xs text-primary">
            View all <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        {todos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing due today</p>
        ) : (
          <div className="space-y-1.5">
            {todos.slice(0, 3).map(todo => (
              <div key={todo.id} className="flex items-center gap-2">
                <button
                  onClick={() => onCompleteTodo(todo.id)}
                  className="w-4 h-4 rounded-full border-2 border-primary shrink-0 hover:bg-primary/10"
                  title="Mark complete"
                />
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[todo.priority]}`} />
                <span className="text-sm truncate flex-1">{todo.title}</span>
                {todo.due_time && <span className="text-xs text-muted-foreground shrink-0">{formatTime(todo.due_time)}</span>}
              </div>
            ))}
            {todos.length > 3 && <p className="text-xs text-muted-foreground">+{todos.length - 3} more</p>}
          </div>
        )}
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Events</span>
          <Link to="/calendar" className="flex items-center gap-0.5 text-xs text-primary">
            View all <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events today</p>
        ) : (
          <div className="space-y-1.5">
            {events.slice(0, 3).map(event => (
              <div key={event.id} className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm truncate flex-1">{event.title}</span>
                <span className="text-xs text-muted-foreground shrink-0">{event.time ? formatTime(event.time) : 'All day'}</span>
              </div>
            ))}
            {events.length > 3 && <p className="text-xs text-muted-foreground">+{events.length - 3} more</p>}
          </div>
        )}
      </div>
    </div>
  )
}
