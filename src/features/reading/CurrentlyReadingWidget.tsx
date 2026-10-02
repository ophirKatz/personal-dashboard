import { forwardRef, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { BookOpen, CheckCircle2, ChevronRight, Flame } from 'lucide-react'
import type { ReadingBook } from '../../supabase'
import { Button } from '../../components/ui/button'
import { celebrateFromElement } from '../../lib/confetti'
import { haptic } from '../../lib/haptics'
import { cn, today } from '../../utils'
import BookCover from './BookCover'
import PickNextBookDrawer from './PickNextBookDrawer'
import { clearCurrentBook, completeBook, fetchCurrentBook, setCurrentBook } from './currentBook'
import { currentStreak, fetchReadingDays, logReadingDay, nudgeCopy, recentDays, unlogReadingDay } from './readingDays'

/**
 * Home-screen widget. Shown while a book is set as current on the Reading page. Once that
 * book is read the widget shows a persistent "finished" state, from which the next book can
 * be chosen (replacing it) or the widget dismissed.
 */
export default function CurrentlyReadingWidget() {
  const [book, setBook] = useState<ReadingBook | null>(null)
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState<string[]>([])
  const [flipKey, setFlipKey] = useState(0)
  const completeRef = useRef<HTMLButtonElement>(null)
  const readRef = useRef<HTMLButtonElement>(null)

  const todayStr = today()
  const readToday = days.includes(todayStr)
  const streak = currentStreak(days, todayStr)

  useEffect(() => {
    fetchCurrentBook().then(setBook)
    fetchReadingDays(today()).then(setDays)
  }, [])

  /** Sets whether `day` counts as read, optimistically, reverting if the save fails. */
  async function setDayRead(day: string, read: boolean) {
    setError(null)
    setDays(d => read ? [day, ...d.filter(x => x !== day)] : d.filter(x => x !== day))
    const { error } = await (read ? logReadingDay(day) : unlogReadingDay(day))
    if (error) {
      setError(error)
      setDays(d => read ? d.filter(x => x !== day) : [day, ...d])
    }
  }

  function logToday() {
    setFlipKey(k => k + 1)
    haptic('success')
    if (readRef.current) celebrateFromElement(readRef.current)
    return setDayRead(todayStr, true)
  }

  function toggleDay(day: string, read: boolean) {
    haptic('selection')
    return setDayRead(day, read)
  }

  async function complete() {
    if (!book) return
    setBusy(true)
    setError(null)
    const { error } = await completeBook(book.id)
    setBusy(false)
    if (error) { setError(error); return }
    if (completeRef.current) celebrateFromElement(completeRef.current)
    haptic('success')
    setBook({ ...book, is_read: true })
  }

  async function dismiss() {
    setError(null)
    const { error } = await clearCurrentBook()
    if (error) { setError(error); return }
    setBook(null)
  }

  async function pick(next: ReadingBook) {
    setError(null)
    const { error } = await setCurrentBook(next.id)
    if (error) { setError(error); return }
    haptic('success')
    setPicking(false)
    setBook({ ...next, is_current: true })
  }

  if (!book) return null

  return (
    <div className="bg-card border border-border rounded-xl p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Currently reading</h2>
        <Link to="/reading" className="flex items-center gap-0.5 text-xs text-primary">
          Reading list <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {!book.is_read ? (
        <div className="flex items-center gap-3">
          <div key={flipKey} className={cn('shrink-0', flipKey > 0 && 'motion-safe:animate-cover-flip')}>
            <BookCover url={book.cover_url} title={book.title} className="h-24 w-16 rounded-md shadow-sm" />
          </div>
          <div className="min-w-0 flex-1 space-y-2.5">
            <div>
              <p className="font-medium leading-tight line-clamp-2">{book.title}</p>
              {book.author && <p className="text-sm text-muted-foreground truncate">{book.author}</p>}
            </div>
            <Button ref={completeRef} size="sm" variant="outline" disabled={busy} onClick={complete} className="rounded-lg">
              <CheckCircle2 className="mr-1.5 h-4 w-4" /> {busy ? 'Saving…' : 'Mark as completed'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <BookCover url={book.cover_url} title={book.title} className="h-24 w-16 shrink-0 rounded-md shadow-sm opacity-70" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
                <CheckCircle2 className="h-4 w-4" /> Finished 🎉
              </p>
              <p className="font-medium leading-tight line-clamp-2">{book.title}</p>
              {book.author && <p className="text-sm text-muted-foreground truncate">{book.author}</p>}
            </div>
            <div className="flex items-center gap-3">
              <Button size="sm" onClick={() => setPicking(true)} className="rounded-lg">Choose next book</Button>
              <button onClick={dismiss} className="text-xs text-muted-foreground hover:text-foreground">Dismiss</button>
            </div>
          </div>
        </div>
      )}

      {!book.is_read && (
        <ReadingTracker
          ref={readRef}
          readToday={readToday}
          streak={streak}
          week={recentDays(days, todayStr)}
          onLog={logToday}
          onUndo={() => setDayRead(todayStr, false)}
          onToggleDay={toggleDay}
        />
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <PickNextBookDrawer open={picking} onClose={() => setPicking(false)} onPick={pick} />
    </div>
  )
}

type TrackerProps = {
  readToday: boolean
  streak: number
  week: ReturnType<typeof recentDays>
  onLog: () => void
  onUndo: () => void
  onToggleDay: (day: string, read: boolean) => void
}

/** Daily nudge: a pulsing banner until today's reading is logged, then a streak + week strip whose days can be tapped to toggle. */
const ReadingTracker = forwardRef<HTMLButtonElement, TrackerProps>(function ReadingTracker(
  { readToday, streak, week, onLog, onUndo, onToggleDay },
  ref,
) {
  const now = new Date()
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000)
  const nudge = nudgeCopy(streak, now.getHours(), dayOfYear)
  const [popped, setPopped] = useState<string | null>(null)

  return (
    <div className="space-y-2.5">
      {readToday ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-900 dark:bg-emerald-950/40">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white motion-safe:animate-pop-in">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">You read today</p>
            <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
              {streak > 1 ? `${streak} days in a row. Keep it going tomorrow` : 'Day one is done. Come back tomorrow'}
            </p>
          </div>
          <button onClick={onUndo} className="text-xs text-muted-foreground hover:text-foreground">Undo</button>
        </div>
      ) : (
        <button
          ref={ref}
          onClick={onLog}
          className="flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-left transition-transform active:scale-[0.98] motion-safe:animate-nudge-ring"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground motion-safe:animate-book-wiggle">
            <BookOpen className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{nudge.title}</span>
            <span className="block text-xs text-muted-foreground">{nudge.sub}</span>
          </span>
          <span className="shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">I read</span>
        </button>
      )}

      <div className="flex items-center justify-between px-0.5">
        <div className={cn('flex items-center gap-1 text-sm font-semibold', streak === 0 && 'text-muted-foreground')}>
          <Flame className={cn('h-4 w-4', streak > 0 && 'text-orange-500 motion-safe:animate-flicker')} />
          {streak}
          <span className="text-xs font-normal text-muted-foreground">day streak</span>
        </div>
        <div className="flex gap-1.5">
          {week.map(d => (
            <button
              key={d.key}
              onClick={() => { setPopped(d.read ? null : d.key); onToggleDay(d.key, !d.read) }}
              aria-pressed={d.read}
              aria-label={`${d.isToday ? 'Today' : format(parseISO(d.key), 'EEEE d MMM')}: ${d.read ? 'read' : 'not read'}`}
              className="flex flex-col items-center gap-0.5 rounded-md px-0.5 transition-transform active:scale-90"
            >
              <span
                className={cn(
                  'h-5 w-5 rounded-full border transition-colors',
                  d.read ? 'border-emerald-500 bg-emerald-500' : 'border-border bg-muted',
                  d.isToday && !d.read && 'border-primary',
                  d.key === popped && d.read && 'motion-safe:animate-pop-in',
                )}
              />
              <span className={cn('text-[10px] text-muted-foreground', d.isToday && 'font-semibold text-foreground')}>{d.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
})
