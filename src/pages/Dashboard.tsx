import { useEffect, useState } from 'react'
import { CheckCircle2, Flame, Bell, CalendarDays, Plus, ShoppingCart, Mountain, DollarSign, TrendingUp, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import type { Habit, HabitLog, Todo, Reminder, CalendarEvent, Notification } from '../supabase'
import type { User } from '@supabase/supabase-js'
import { today, formatDateTime, formatTime, PRIORITY_CONFIG } from '../utils'
import { isBefore, addDays, parseISO, format } from 'date-fns'
import TodoForm from '../features/todos/TodoForm'
import { fetchGoogleCalendarEvents } from '../features/calendar/googleCalendar'
import type { GoogleCalendarEvent } from '../features/calendar/googleCalendar'

type DashboardEvent =
  | { source: 'local'; event: CalendarEvent }
  | { source: 'google'; event: GoogleCalendarEvent }

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [habits, setHabits] = useState<Habit[]>([])
  const [todayLogs, setTodayLogs] = useState<HabitLog[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showAddTodo, setShowAddTodo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [quickTitle, setQuickTitle] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  async function loadLocalData() {
    const t = today()
    const in7 = format(addDays(new Date(), 7), 'yyyy-MM-dd')

    const [habitsRes, logsRes, todosRes, remindersRes, eventsRes, notificationsRes] = await Promise.all([
      supabase.from('habits').select('*').order('created_at'),
      supabase.from('habit_logs').select('*').eq('logged_date', t),
      supabase.from('todos').select('*').eq('completed', false).or(`due_date.eq.${t},due_date.is.null`).order('created_at'),
      supabase.from('reminders').select('*').lte('remind_at', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()).order('remind_at'),
      supabase.from('events').select('*').gte('event_date', t).lte('event_date', in7).order('event_date').order('event_time'),
      supabase.from('notifications').select('*').eq('read', false).order('created_at', { ascending: false }),
    ])

    setHabits(habitsRes.data ?? [])
    setTodayLogs(logsRes.data ?? [])
    setTodos(todosRes.data ?? [])
    setReminders(remindersRes.data ?? [])
    setEvents(eventsRes.data ?? [])
    setNotifications(notificationsRes.data ?? [])
    setLoading(false)
  }

  // Kept separate from loadLocalData: this hits an external API (token refresh +
  // Google Calendar) and is the slow part of the page, so it must never gate the
  // fast Supabase-backed sections from rendering.
  async function loadGoogleEvents() {
    const googleRes = await fetchGoogleCalendarEvents(7)
    setGoogleEvents(googleRes.events)
  }

  useEffect(() => {
    loadLocalData()
    loadGoogleEvents()
  }, [])

  async function toggleHabit(habit: Habit) {
    const logged = todayLogs.some(l => l.habit_id === habit.id)
    if (logged) {
      await supabase.from('habit_logs').delete().eq('habit_id', habit.id).eq('logged_date', today())
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('habit_logs').insert({ habit_id: habit.id, user_id: user!.id, logged_date: today() })
    }
    const { data } = await supabase.from('habit_logs').select('*').eq('logged_date', today())
    setTodayLogs(data ?? [])
  }

  async function dismissNotification(id: string) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  async function completeTodo(id: string) {
    await supabase.from('todos').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', id)
    setTodos(prev => prev.filter(t => t.id !== id))
  }

  async function quickAddTodo(e: React.FormEvent) {
    e.preventDefault()
    if (!quickTitle.trim() || !user) return
    await supabase.from('todos').insert({
      title: quickTitle.trim(),
      priority: 'medium',
      user_id: user.id,
      due_date: today(),
    })
    setQuickTitle('')
    loadLocalData()
  }

  const now = new Date()
  const overdueReminders = reminders.filter(r => isBefore(new Date(r.remind_at), now))
  const upcomingReminders = reminders.filter(r => !isBefore(new Date(r.remind_at), now)).slice(0, 5)
  const doneCount = habits.filter(h => todayLogs.some(l => l.habit_id === h.id)).length

  const mergedEvents: DashboardEvent[] = [
    ...events.map(event => ({ source: 'local' as const, event })),
    ...googleEvents.map(event => ({ source: 'google' as const, event })),
  ].sort((a, b) => {
    const dateCompare = a.event.event_date.localeCompare(b.event.event_date)
    if (dateCompare !== 0) return dateCompare
    return (a.event.event_time ?? '99:99:99').localeCompare(b.event.event_time ?? '99:99:99')
  })

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-5">
      <div className="pt-2">
        <h1 className="text-2xl font-bold">{greetingTime()}</h1>
        <p className="text-muted-foreground text-sm">{format(new Date(), 'EEEE, MMMM d')}</p>
      </div>

      {/* Notifications */}
      {!loading && notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map(n => (
            <div key={n.id} className="flex items-start gap-3 p-3.5 rounded-xl border bg-primary/5 border-primary/30">
              <Bell className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{n.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
              </div>
              <button onClick={() => dismissNotification(n.id)} className="p-1 rounded-lg hover:bg-accent text-muted-foreground shrink-0" title="Dismiss">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Quick links - static, no data dependency, always shown immediately */}
      <div className="grid grid-cols-4 gap-3">
        <Link
          to="/shopping"
          aria-label="Shopping List"
          title="Shopping List"
          className="flex items-center justify-center p-3.5 bg-card border border-border rounded-xl active:scale-[0.98] transition-transform"
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <ShoppingCart className="h-4 w-4" />
          </div>
        </Link>
        <Link
          to="/climbing"
          aria-label="Climbing"
          title="Climbing"
          className="flex items-center justify-center p-3.5 bg-card border border-border rounded-xl active:scale-[0.98] transition-transform"
        >
          <div className="w-9 h-9 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
            <Mountain className="h-4 w-4" />
          </div>
        </Link>
        <Link
          to="/finance"
          aria-label="Finance"
          title="Finance"
          className="flex items-center justify-center p-3.5 bg-card border border-border rounded-xl active:scale-[0.98] transition-transform"
        >
          <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <DollarSign className="h-4 w-4" />
          </div>
        </Link>
        <Link
          to="/habits"
          aria-label="Habits"
          title="Habits"
          className="flex items-center justify-center p-3.5 bg-card border border-border rounded-xl active:scale-[0.98] transition-transform"
        >
          <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
            <TrendingUp className="h-4 w-4" />
          </div>
        </Link>
      </div>

      {/* Habits */}
      {!loading && habits.length > 0 && (
        <Section title="Today's Habits" badge={`${doneCount}/${habits.length}`}>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
            {habits.map(habit => {
              const done = todayLogs.some(l => l.habit_id === habit.id)
              return (
                <button
                  key={habit.id}
                  onClick={() => toggleHabit(habit)}
                  className="flex flex-col items-center gap-1.5 shrink-0 relative"
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all active:scale-95"
                    style={{ backgroundColor: done ? habit.color : 'hsl(var(--muted))', opacity: done ? 1 : 0.5 }}
                  >
                    {habit.emoji}
                  </div>
                  {done && (
                    <CheckCircle2 className="h-4 w-4 text-primary absolute -top-1 -right-1 bg-background rounded-full" />
                  )}
                  <span className="text-[10px] text-muted-foreground max-w-[56px] truncate">{habit.name}</span>
                </button>
              )
            })}
          </div>
        </Section>
      )}

      {/* Quick add todo - only needs `user`, not the dashboard data load, so it's never gated */}
      <form onSubmit={quickAddTodo} className="flex gap-2">
        <input
          value={quickTitle}
          onChange={e => setQuickTitle(e.target.value)}
          placeholder="Add a task for today…"
          className="flex-1 h-11 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={!quickTitle.trim()}
          className="h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40"
        >
          <Plus className="h-5 w-5" />
        </button>
      </form>

      {/* Todos */}
      {!loading && todos.length > 0 && (
        <Section title="Due Today">
          <div className="space-y-2">
            {todos.slice(0, 5).map(todo => (
              <div key={todo.id} className="flex items-center gap-3 p-3.5 bg-card border border-border rounded-xl">
                <button
                  onClick={() => completeTodo(todo.id)}
                  className="w-5 h-5 rounded-md border-2 border-primary flex items-center justify-center shrink-0 hover:bg-primary/10"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{todo.title}</p>
                  {todo.due_time && <p className="text-xs text-muted-foreground mt-0.5">{formatTime(todo.due_time)}</p>}
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${PRIORITY_CONFIG[todo.priority].className}`}>
                  {PRIORITY_CONFIG[todo.priority].label}
                </span>
              </div>
            ))}
            {todos.length > 5 && (
              <p className="text-xs text-center text-muted-foreground">+{todos.length - 5} more</p>
            )}
          </div>
        </Section>
      )}

      {/* Reminders */}
      {!loading && (overdueReminders.length > 0 || upcomingReminders.length > 0) && (
        <Section title="Reminders" badge={overdueReminders.length > 0 ? `${overdueReminders.length} overdue` : undefined} badgeClass="text-destructive">
          <div className="space-y-2">
            {[...overdueReminders, ...upcomingReminders].slice(0, 4).map(r => {
              const overdue = isBefore(new Date(r.remind_at), now)
              return (
                <div key={r.id} className={`flex items-center gap-3 p-3.5 rounded-xl border ${overdue ? 'bg-destructive/5 border-destructive/30' : 'bg-card border-border'}`}>
                  <Bell className={`h-4 w-4 shrink-0 ${overdue ? 'text-destructive' : 'text-muted-foreground'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.title}</p>
                    <p className={`text-xs mt-0.5 ${overdue ? 'text-destructive' : 'text-muted-foreground'}`}>{formatDateTime(r.remind_at)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* Events */}
      {!loading && mergedEvents.length > 0 && (
        <Section title="Upcoming Events">
          <div className="space-y-2">
            {mergedEvents.slice(0, 5).map(({ source, event }) => (
              <div key={`${source}-${event.id}`} className="flex items-center gap-3 p-3.5 bg-card border border-border rounded-xl">
                <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">{event.title}</p>
                    {source === 'google' && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 shrink-0">Google</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(event.event_date), 'MMM d')}
                    {event.event_time && ` · ${format(new Date(`2000-01-01T${event.event_time}`), 'h:mm a')}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {loading && (
        <div className="flex justify-center pt-6">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && habits.length === 0 && todos.length === 0 && reminders.length === 0 && mergedEvents.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-5xl mb-4">🌅</div>
          <p className="font-semibold text-lg text-foreground">Welcome!</p>
          <p className="text-sm mt-1">Start by adding habits and tasks.</p>
        </div>
      )}

      {user && showAddTodo && (
        <TodoForm open={showAddTodo} onClose={() => setShowAddTodo(false)} onSave={loadLocalData} userId={user.id} />
      )}
    </div>
  )
}

function Section({ title, badge, badgeClass, children }: {
  title: string; badge?: string; badgeClass?: string; children: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{title}</h2>
        {badge && <span className={`text-xs font-medium ${badgeClass ?? 'text-muted-foreground'}`}>{badge}</span>}
      </div>
      {children}
    </div>
  )
}

function greetingTime() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning 👋'
  if (h < 17) return 'Good afternoon 👋'
  return 'Good evening 👋'
}
