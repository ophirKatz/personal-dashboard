import { Fragment, useEffect, useRef, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, CalendarArrowUp, CheckCircle2, ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react'
import type { HabitStatus, Todo } from '../../supabase'
import { formatTime, isOverdue, today } from '../../utils'
import WeatherWidget from '../weather/WeatherWidget'
import { celebrateFromElement } from '../../lib/confetti'
import { haptic } from '../../lib/haptics'
import PostponeMenu from '../todos/PostponeMenu'
import WorkoutWidget from '../workout/WorkoutWidget'
import { getTodaySectionsOrder } from '../../lib/userSettings'
import { DEFAULT_TODAY_SECTIONS_ORDER, TODAY_SECTIONS_CHANGED_EVENT, type TodaySectionKey } from '../../lib/todaySections'

// Gives the user a beat to see the checkmark/celebration before the parent
// reload removes the item from the list.
const COMPLETE_REMOVAL_DELAY_MS = 450

type Page = 'today' | 'tomorrow'

export type TodayEvent = {
  id: string
  title: string
  time: string | null
  endTime: string | null
  endDate: string | null
  location: string | null
  source: 'local' | 'google'
}

type Props = {
  habits: HabitStatus[]
  totalHabitsCount: number
  onToggleHabit: (habit: HabitStatus) => void
  todos: Todo[]
  onCompleteTodo: (id: string) => void
  onPostponeTodo: (id: string, target: Date | 'tomorrow') => void
  events: TodayEvent[]
  tomorrowTodos: Todo[]
  tomorrowEvents: TodayEvent[]
  workoutDoneToday: boolean
}

const PRIORITY_DOT = {
  low: 'bg-blue-500',
  medium: 'bg-amber-500',
  high: 'bg-red-500',
} as const

// How far ahead an upcoming item still counts as "next up" worth a banner.
const NEXT_UP_WINDOW_MINUTES = 180

function minutesUntil(time: string, now: Date): number {
  const target = new Date(`${now.toDateString()} ${time}`)
  return Math.round((target.getTime() - now.getTime()) / 60000)
}

function formatCountdown(minutes: number): string {
  if (minutes <= 0) return 'now'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function hasEventEnded(event: TodayEvent, now: Date): boolean {
  if (!event.time) return false
  const endDate = event.endDate ?? today()
  const endTime = event.endTime ?? event.time
  return new Date(`${endDate}T${endTime}`).getTime() < now.getTime()
}

export default function TodaySection({ habits, totalHabitsCount, onToggleHabit, todos, onCompleteTodo, onPostponeTodo, events, tomorrowTodos, tomorrowEvents, workoutDoneToday }: Props) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  const [order, setOrder] = useState<TodaySectionKey[]>(DEFAULT_TODAY_SECTIONS_ORDER)
  useEffect(() => {
    getTodaySectionsOrder().then(setOrder)
    const handleChange = (e: Event) => setOrder((e as CustomEvent<TodaySectionKey[]>).detail)
    window.addEventListener(TODAY_SECTIONS_CHANGED_EVENT, handleChange)
    return () => window.removeEventListener(TODAY_SECTIONS_CHANGED_EVENT, handleChange)
  }, [])
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)
  const [postponingTodoId, setPostponingTodoId] = useState<string | null>(null)
  const [completingTodoIds, setCompletingTodoIds] = useState<Set<string>>(new Set())
  const [showAllTodos, setShowAllTodos] = useState<Record<Page, boolean>>({ today: false, tomorrow: false })
  const [showAllEvents, setShowAllEvents] = useState<Record<Page, boolean>>({ today: false, tomorrow: false })
  const [page, setPage] = useState<Page>('today')
  const pageRefs = useRef<Record<Page, HTMLDivElement | null>>({ today: null, tomorrow: null })
  const [pageHeights, setPageHeights] = useState<Record<Page, number | null>>({ today: null, tomorrow: null })

  // Both pages stay mounted side by side, so the card's height has to be
  // animated to whichever page is showing (they differ a lot in length).
  useEffect(() => {
    const measure = () => setPageHeights({ today: pageRefs.current.today?.offsetHeight ?? null, tomorrow: pageRefs.current.tomorrow?.offsetHeight ?? null })
    measure()
    const ro = new ResizeObserver(measure)
    for (const el of Object.values(pageRefs.current)) if (el) ro.observe(el)
    return () => ro.disconnect()
  }, [])

  function goToPage(next: Page) {
    if (next === page) return
    setPage(next)
    setExpandedEventId(null)
    haptic('light')
  }

  function handleCompleteTodo(todo: Todo, e: MouseEvent<HTMLButtonElement>) {
    haptic('success')
    celebrateFromElement(e.currentTarget)
    setCompletingTodoIds(prev => new Set(prev).add(todo.id))
    setTimeout(() => onCompleteTodo(todo.id), COMPLETE_REMOVAL_DELAY_MS)
  }

  const nextUp = [
    ...events.filter(e => e.time).map(e => ({ kind: 'event' as const, label: e.title, minutes: minutesUntil(e.time!, now) })),
    ...todos.filter(t => t.due_time && !isOverdue(t.due_date)).map(t => ({ kind: 'task' as const, label: t.title, minutes: minutesUntil(t.due_time!, now) })),
  ]
    .filter(item => item.minutes >= 0 && item.minutes <= NEXT_UP_WINDOW_MINUTES)
    .sort((a, b) => a.minutes - b.minutes)[0]

  const urgency = nextUp == null ? null : nextUp.minutes <= 15 ? 'high' : nextUp.minutes <= 60 ? 'medium' : 'low'

  const visibleEvents = events.filter(event => !hasEventEnded(event, now))

  const sortedTodos = [...todos].sort((a, b) => {
    const overdueDiff = Number(isOverdue(b.due_date)) - Number(isOverdue(a.due_date))
    if (overdueDiff !== 0) return overdueDiff
    return (a.due_time ?? '99:99:99').localeCompare(b.due_time ?? '99:99:99')
  })

  const sortedTomorrowTodos = [...tomorrowTodos].sort((a, b) => (a.due_time ?? '99:99:99').localeCompare(b.due_time ?? '99:99:99'))

  // Only sections that actually render count when deciding where dividers go.
  const rendered = order.filter(key => (key === 'next_up' ? !!nextUp : key === 'habits' ? habits.length > 0 : true))
  const dividerFor = (key: TodaySectionKey) => {
    const i = rendered.indexOf(key)
    return i > 0 && rendered[i - 1] !== 'next_up' ? 'border-t border-border pt-3' : ''
  }

  function renderEvents(list: TodayEvent[], tomorrow: boolean, divider: string) {
    const pageKey: Page = tomorrow ? 'tomorrow' : 'today'
    return (
        <div className={`space-y-2 ${divider}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Events</span>
            <Link to="/calendar" className="flex items-center gap-0.5 text-xs text-primary">
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tomorrow ? 'No events tomorrow' : 'No events today'}</p>
          ) : (
            <div className="space-y-1.5">
              {(showAllEvents[pageKey] ? list : list.slice(0, 3)).map(event => (
                <div key={event.id}>
                  <button
                    onClick={() => event.location && setExpandedEventId(id => (id === event.id ? null : event.id))}
                    className="flex items-center gap-2 w-full text-left"
                    disabled={!event.location}
                  >
                    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate flex-1">{event.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {event.time
                        ? `${formatTime(event.time)}${event.endTime ? ` – ${formatTime(event.endTime)}` : ''}`
                        : 'All day'}
                    </span>
                  </button>
                  {expandedEventId === event.id && event.location && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 pl-6">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{event.location}</span>
                    </p>
                  )}
                </div>
              ))}
              {list.length > 3 && (
                <button
                  onClick={() => setShowAllEvents(v => ({ ...v, [pageKey]: !v[pageKey] }))}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {showAllEvents[pageKey] ? 'Show less' : `+${list.length - 3} more`}
                </button>
              )}
            </div>
          )}
        </div>
    
    )
  }

  function renderTasks(list: Todo[], sorted: Todo[], tomorrow: boolean, divider: string) {
    const pageKey: Page = tomorrow ? 'tomorrow' : 'today'
    return (
        <div className={`space-y-2 ${divider}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Tasks</span>
            <Link to="/todos" className="flex items-center gap-0.5 text-xs text-primary">
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tomorrow ? 'Nothing due tomorrow' : 'Nothing due today'}</p>
          ) : (
            <div className="space-y-1.5">
              {(showAllTodos[pageKey] ? sorted : sorted.slice(0, 3)).map(todo => {
                const overdue = !tomorrow && (isOverdue(todo.due_date) || (!!todo.due_time && minutesUntil(todo.due_time, now) < 0))
                const completing = completingTodoIds.has(todo.id)
                return (
                  <div key={todo.id} className={`flex items-center gap-2 transition-opacity duration-300 ${completing ? 'opacity-60' : ''}`}>
                    <button
                      onClick={e => handleCompleteTodo(todo, e)}
                      disabled={completing}
                      className="shrink-0 hover:bg-primary/10 rounded-full"
                      title="Mark complete"
                    >
                      {completing ? (
                        <CheckCircle2 className="h-4 w-4 text-primary animate-in zoom-in-50 duration-150" />
                      ) : (
                        <span className={`block w-4 h-4 rounded-full border-2 ${overdue ? 'border-destructive' : 'border-primary'}`} />
                      )}
                    </button>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[todo.priority]}`} />
                    <span className={`text-sm truncate flex-1 ${completing ? 'line-through text-muted-foreground' : overdue ? 'text-destructive' : ''}`}>{todo.title}</span>
                    {todo.due_time && (
                      <span className={`flex items-center gap-1 text-xs shrink-0 ${overdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                        {overdue && <AlertCircle className="h-3 w-3" />}
                        {formatTime(todo.due_time)}
                      </span>
                    )}
                    {overdue && (
                      <button
                        onClick={() => setPostponingTodoId(todo.id)}
                        className="p-1 rounded-lg hover:bg-accent text-muted-foreground shrink-0"
                        title="Postpone"
                      >
                        <CalendarArrowUp className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )
              })}
              {list.length > 3 && (
                <button
                  onClick={() => setShowAllTodos(v => ({ ...v, [pageKey]: !v[pageKey] }))}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {showAllTodos[pageKey] ? 'Show less' : `+${list.length - 3} more`}
                </button>
              )}
            </div>
          )}
        </div>
    
    )
  }

  const sections: Record<TodaySectionKey, ReactNode> = {
    next_up: nextUp && (
        <div
          className={`flex items-center gap-3 rounded-lg p-3 ${
            urgency === 'high'
              ? 'bg-destructive/10 border border-destructive/30'
              : urgency === 'medium'
              ? 'bg-amber-500/10 border border-amber-500/30'
              : 'bg-primary/5 border border-primary/20'
          }`}
        >
          <Clock className={`h-4 w-4 shrink-0 ${urgency === 'high' ? 'text-destructive' : urgency === 'medium' ? 'text-amber-600' : 'text-primary'}`} />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Next up</p>
            <p className="text-sm font-medium truncate">{nextUp.label}</p>
          </div>
          <span className={`text-sm font-semibold shrink-0 ${urgency === 'high' ? 'text-destructive' : urgency === 'medium' ? 'text-amber-600' : 'text-primary'}`}>
            in {formatCountdown(nextUp.minutes)}
          </span>
        </div>
      ),
    events: renderEvents(visibleEvents, false, dividerFor('events')),
    tasks: renderTasks(todos, sortedTodos, false, dividerFor('tasks')),
    habits: habits.length > 0 && (
        <div className={`space-y-2 ${dividerFor('habits')}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Habits</span>
            <span className="text-xs text-muted-foreground">{habits.length}/{totalHabitsCount}</span>
          </div>
          <div className="flex gap-3 overflow-x-auto -mt-2 pt-2 pb-1 -mx-1 px-1">
            {habits.map(habit => {
              const loggedToday = habit.logged_today
              const fullyDone = loggedToday && habit.owed_count === 0
              const partiallyDone = loggedToday && habit.owed_count > 0
              return (
                <button
                  key={habit.id}
                  onClick={e => {
                    if (!loggedToday) celebrateFromElement(e.currentTarget)
                    onToggleHabit(habit)
                  }}
                  title={partiallyDone ? `${habit.owed_count} owed still` : undefined}
                  className="flex flex-col items-center gap-1 shrink-0 relative"
                >
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl transition-all active:scale-95 ${
                      partiallyDone ? 'border-2 border-dashed border-destructive' : ''
                    }`}
                    style={{ backgroundColor: loggedToday ? habit.color : 'hsl(var(--muted))', opacity: fullyDone ? 1 : loggedToday ? 0.75 : 0.5 }}
                  >
                    {habit.emoji}
                  </div>
                  {fullyDone && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary absolute -top-1 -right-1 bg-background rounded-full" />
                  )}
                  {habit.owed_count > 0 && (
                    <span className="h-4 min-w-4 px-0.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold absolute -top-1 -left-1 flex items-center justify-center">
                      {habit.owed_count}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground max-w-[48px] truncate">{habit.name}</span>
                </button>
              )
            })}
          </div>
        </div>
        ),
    workout: (
        <WorkoutWidget doneToday={workoutDoneToday} />
    ),
  }

  const isTomorrow = page === 'tomorrow'
  const pageClass = 'w-full shrink-0 space-y-4'

  return (
    <div className="bg-card border border-border rounded-xl p-3.5 space-y-4">
      <div className="flex items-center justify-between">
        <div key={page} className="animate-in fade-in duration-300">
          <h2 className="text-base font-semibold">{isTomorrow ? 'Tomorrow' : 'Today'}</h2>
        </div>
        <button
          onClick={() => goToPage(isTomorrow ? 'today' : 'tomorrow')}
          className="flex items-center gap-0.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary active:scale-95 transition-transform"
        >
          {isTomorrow && <ChevronLeft className="h-3 w-3" />}
          {isTomorrow ? 'Today' : 'Tomorrow'}
          {!isTomorrow && <ChevronRight className="h-3 w-3" />}
        </button>
        <WeatherWidget />
      </div>

      {/* Viewport: clips the sliding track and animates its height to the active page. */}
      <div
        className="overflow-hidden transition-[height] duration-300 ease-out"
        style={{ height: pageHeights[page] ?? undefined }}
      >
        <div
          className="flex items-start transition-transform duration-300 ease-out"
          style={{ transform: `translateX(${isTomorrow ? -100 : 0}%)` }}
        >
          <div ref={el => { pageRefs.current.today = el }} className={`${pageClass} transition-opacity duration-300 ${isTomorrow ? 'opacity-0' : ''}`} aria-hidden={isTomorrow}>
            {order.map(key => <Fragment key={key}>{sections[key]}</Fragment>)}
          </div>
          <div ref={el => { pageRefs.current.tomorrow = el }} className={`${pageClass} transition-opacity duration-300 ${!isTomorrow ? 'opacity-0' : ''}`} aria-hidden={!isTomorrow}>
            {renderEvents(tomorrowEvents, true, '')}
            {renderTasks(tomorrowTodos, sortedTomorrowTodos, true, 'border-t border-border pt-3')}
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-1.5">
        {(['today', 'tomorrow'] as const).map(p => (
          <button
            key={p}
            onClick={() => goToPage(p)}
            aria-label={`Show ${p}`}
            className={`h-1.5 rounded-full transition-all duration-300 ${page === p ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/30'}`}
          />
        ))}
      </div>

      <PostponeMenu
        open={postponingTodoId !== null}
        onClose={() => setPostponingTodoId(null)}
        onPostponeTomorrow={() => {
          if (postponingTodoId) onPostponeTodo(postponingTodoId, 'tomorrow')
          setPostponingTodoId(null)
        }}
        onPostponeTo={target => {
          if (postponingTodoId) onPostponeTodo(postponingTodoId, target)
          setPostponingTodoId(null)
        }}
      />
    </div>
  )
}
