import { useEffect, useState } from 'react'
import type { MouseEvent, KeyboardEvent } from 'react'
import { Bell, ShoppingCart, Mountain, DollarSign, TrendingUp, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { Habit, HabitLog, Todo, CalendarEvent, Notification } from '../supabase'
import { today, advanceRecurrence } from '../utils'
import { addDays, format } from 'date-fns'
import { refreshGoogleCalendarEvents } from '../features/calendar/googleCalendar'
import { toggleGoogleTask } from '../features/todos/googleTasks'
import FocusSection from '../features/focus/FocusSection'
import TodaySection from '../features/today/TodaySection'
import type { TodayEvent } from '../features/today/TodaySection'
import { getShowFocusSection } from '../lib/userSettings'
import { useLongPress } from '../lib/useLongPress'
import ShoppingItemDrawer from '../features/shopping/ShoppingItemDrawer'
import QuickLogSessionDrawer from '../features/climbing/QuickLogSessionDrawer'
import FinanceQuickDrawer from '../features/finance/FinanceQuickDrawer'

const USER_NAME = 'Ophir'

export default function Dashboard() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [todayLogs, setTodayLogs] = useState<HabitLog[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [showFocusSection, setShowFocusSection] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [showAddItem, setShowAddItem] = useState(false)
  const [showLogSession, setShowLogSession] = useState(false)
  const [showFinanceRates, setShowFinanceRates] = useState(false)

  const navigate = useNavigate()
  const shoppingLongPress = useLongPress(() => setShowAddItem(true))
  const climbingLongPress = useLongPress(() => setShowLogSession(true))
  const financeLongPress = useLongPress(() => setShowFinanceRates(true))

  function quickLinkClick(longPress: { onClick: (e: MouseEvent) => void }, path: string) {
    return (e: MouseEvent<HTMLDivElement>) => {
      longPress.onClick(e)
      if (!e.defaultPrevented) navigate(path)
    }
  }

  function quickLinkKeyDown(path: string) {
    return (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        navigate(path)
      }
    }
  }

  async function loadLocalData() {
    const t = today()
    const in7 = format(addDays(new Date(), 7), 'yyyy-MM-dd')

    const [habitsRes, logsRes, todosRes, eventsRes, notificationsRes] = await Promise.all([
      supabase.from('habits').select('*').order('created_at'),
      supabase.from('habit_logs').select('*').eq('logged_date', t),
      supabase.from('todos').select('*').eq('completed', false).or(`due_date.eq.${t},due_date.is.null`).order('created_at'),
      supabase.from('events').select('*').gte('event_date', t).lte('event_date', in7).order('event_date').order('event_time'),
      supabase.from('notifications').select('*').eq('read', false).order('created_at', { ascending: false }),
    ])

    setHabits(habitsRes.data ?? [])
    setTodayLogs(logsRes.data ?? [])
    setTodos(todosRes.data ?? [])
    setEvents(eventsRes.data ?? [])
    setNotifications(notificationsRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadLocalData().then(() => {
      refreshGoogleCalendarEvents().then(loadLocalData)
    })
    getShowFocusSection().then(setShowFocusSection)
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  async function toggleHabit(habit: Habit) {
    const log = todayLogs.find(l => l.habit_id === habit.id)
    if (log) {
      await supabase.from('habit_logs').delete().eq('habit_id', habit.id).eq('logged_date', today())
      if (log.paid_debt) {
        await supabase.from('habits').update({ debt: habit.debt + 1 }).eq('id', habit.id)
      }
    } else {
      const paidDebt = habit.debt > 0
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('habit_logs').insert({ habit_id: habit.id, user_id: user!.id, logged_date: today(), paid_debt: paidDebt })
      if (paidDebt) {
        await supabase.from('habits').update({ debt: habit.debt - 1 }).eq('id', habit.id)
      }
    }
    const [{ data: logsData }, { data: habitsData }] = await Promise.all([
      supabase.from('habit_logs').select('*').eq('logged_date', today()),
      supabase.from('habits').select('*').order('created_at'),
    ])
    setTodayLogs(logsData ?? [])
    setHabits(habitsData ?? [])
  }

  async function dismissNotification(id: string) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  async function completeTodo(id: string) {
    const todo = todos.find(t => t.id === id)
    if (!todo) return
    if (todo.source === 'google') {
      await toggleGoogleTask(todo)
    } else if (todo.due_date && todo.recurrence_interval && todo.recurrence_unit) {
      const nextDue = advanceRecurrence(todo.due_date, todo.recurrence_interval, todo.recurrence_unit)
      const nextRemindAt = todo.remind_at && todo.due_time ? new Date(`${nextDue}T${todo.due_time}`).toISOString() : null
      await supabase.from('todos').update({ due_date: nextDue, remind_at: nextRemindAt, notified_at: null }).eq('id', id)
    } else {
      await supabase.from('todos').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', id)
    }
    setTodos(prev => prev.filter(t => t.id !== id))
  }

  const sortedEvents = [...events].sort((a, b) => {
    const dateCompare = a.event_date.localeCompare(b.event_date)
    if (dateCompare !== 0) return dateCompare
    return (a.event_time ?? '99:99:99').localeCompare(b.event_time ?? '99:99:99')
  })

  const t = today()
  const todayEvents: TodayEvent[] = sortedEvents
    .filter(event => event.event_date === t)
    .map(event => ({ id: event.id, title: event.title, time: event.event_time, source: event.source }))

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-5">
      <div className="pt-2">
        <h1 className="text-2xl font-bold">{greetingTime(USER_NAME)}</h1>
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
        <div
          role="link"
          tabIndex={0}
          aria-label="Shopping List"
          title="Long press to add an item"
          className="flex flex-col items-center justify-center gap-1.5 p-3.5 bg-card border border-border rounded-xl active:scale-[0.98] transition-transform select-none cursor-pointer"
          {...shoppingLongPress}
          onClick={quickLinkClick(shoppingLongPress, '/shopping')}
          onKeyDown={quickLinkKeyDown('/shopping')}
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 select-none">
            <ShoppingCart className="h-4 w-4" />
          </div>
          <span className="text-xs font-medium text-muted-foreground select-none">Shopping</span>
        </div>
        <div
          role="link"
          tabIndex={0}
          aria-label="Climbing"
          title="Long press to log a session"
          className="flex flex-col items-center justify-center gap-1.5 p-3.5 bg-card border border-border rounded-xl active:scale-[0.98] transition-transform select-none cursor-pointer"
          {...climbingLongPress}
          onClick={quickLinkClick(climbingLongPress, '/climbing')}
          onKeyDown={quickLinkKeyDown('/climbing')}
        >
          <div className="w-9 h-9 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center shrink-0 select-none">
            <Mountain className="h-4 w-4" />
          </div>
          <span className="text-xs font-medium text-muted-foreground select-none">Climbing</span>
        </div>
        <div
          role="link"
          tabIndex={0}
          aria-label="Finance"
          title="Long press for quick rates"
          className="flex flex-col items-center justify-center gap-1.5 p-3.5 bg-card border border-border rounded-xl active:scale-[0.98] transition-transform select-none cursor-pointer"
          {...financeLongPress}
          onClick={quickLinkClick(financeLongPress, '/finance')}
          onKeyDown={quickLinkKeyDown('/finance')}
        >
          <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 select-none">
            <DollarSign className="h-4 w-4" />
          </div>
          <span className="text-xs font-medium text-muted-foreground select-none">Finance</span>
        </div>
        <Link
          to="/habits"
          aria-label="Habits"
          title="Habits"
          className="flex flex-col items-center justify-center gap-1.5 p-3.5 bg-card border border-border rounded-xl active:scale-[0.98] transition-transform"
        >
          <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
            <TrendingUp className="h-4 w-4" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">Habits</span>
        </Link>
      </div>

      {/* Today: habits, tasks due today, today's events, and weather */}
      {!loading && (
        <TodaySection
          habits={habits}
          todayLogs={todayLogs}
          onToggleHabit={toggleHabit}
          todos={todos}
          onCompleteTodo={completeTodo}
          events={todayEvents}
        />
      )}

      {/* Focus */}
      {!loading && showFocusSection && <FocusSection />}

      {loading && (
        <div className="flex justify-center pt-6">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && habits.length === 0 && todos.length === 0 && events.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-5xl mb-4">🌅</div>
          <p className="font-semibold text-lg text-foreground">Welcome!</p>
          <p className="text-sm mt-1">Start by adding habits and tasks.</p>
        </div>
      )}

      {user && (
        <ShoppingItemDrawer
          open={showAddItem}
          onClose={() => setShowAddItem(false)}
          onSave={() => {}}
          userId={user.id}
        />
      )}
      {user && (
        <QuickLogSessionDrawer
          open={showLogSession}
          onClose={() => setShowLogSession(false)}
          onSaved={() => setShowLogSession(false)}
          userId={user.id}
        />
      )}
      <FinanceQuickDrawer open={showFinanceRates} onClose={() => setShowFinanceRates(false)} />
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

function greetingTime(name: string) {
  const h = new Date().getHours()
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return `${greeting}, ${name} 👋`
}
