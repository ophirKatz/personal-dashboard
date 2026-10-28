import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { CheckCircle2, ChevronRight, Dumbbell, Flame, Plus } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { currentStreak } from '../../lib/streak'
import { haptic } from '../../lib/haptics'
import { cn, today } from '../../utils'
import { loadWorkoutTracking, type WorkoutTracking } from './workout'
import { countByDay, missedWorkouts, workoutNudge, workoutWeek, type WorkoutDay } from './workoutTracking'
import WorkoutLogDrawer from './WorkoutLogDrawer'

type Logging = { date: string; extra: boolean }

/**
 * Home-screen widget. Full while no workout is logged today: a nudge to log one, the streak, and
 * the last week. Once one is logged it shrinks to a single row, which still offers "Log extra".
 */
export default function WorkoutWidget() {
  const [tracking, setTracking] = useState<WorkoutTracking | null>(null)
  const [logging, setLogging] = useState<Logging | null>(null)
  const navigate = useNavigate()
  const todayStr = today()

  function load() {
    loadWorkoutTracking(todayStr).then(setTracking)
  }

  useEffect(load, [])

  // Nothing to show until we know which state to be in, so it never flashes the wrong one.
  if (!tracking) return null

  const { settings, days } = tracking
  const todayCount = countByDay(days).get(todayStr) ?? 0
  const streak = currentStreak(days, todayStr)
  const missed = settings ? missedWorkouts(days, settings.tracking_start_date, todayStr) : 0

  const drawerTitle = !logging
    ? 'Log workout'
    : logging.extra
      ? 'Log extra workout'
      : logging.date === todayStr
        ? 'Log workout'
        : `Log workout · ${format(parseISO(logging.date), 'EEE d MMM')}`

  return (
    <>
      {todayCount > 0 ? (
        <CompactWorkout
          count={todayCount}
          streak={streak}
          missed={missed}
          onLogExtra={() => setLogging({ date: todayStr, extra: true })}
        />
      ) : (
        <FullWorkout
          streak={streak}
          missed={missed}
          week={workoutWeek(days, todayStr)}
          onLogToday={() => setLogging({ date: todayStr, extra: false })}
          onPickDay={day => {
            haptic('selection')
            if (day.count > 0) navigate('/workout?tab=history')
            else setLogging({ date: day.key, extra: false })
          }}
        />
      )}
      <WorkoutLogDrawer
        open={logging !== null}
        title={drawerTitle}
        date={logging?.date}
        onClose={() => setLogging(null)}
        onSaved={() => { setLogging(null); load() }}
      />
    </>
  )
}

function StreakCount({ streak }: { streak: number }) {
  return (
    <span className={cn('flex items-center gap-1 text-sm font-semibold', streak === 0 && 'text-muted-foreground')}>
      <Flame className={cn('h-4 w-4', streak > 0 && 'text-orange-500 motion-safe:animate-flicker')} />
      {streak}
      <span className="text-xs font-normal text-muted-foreground">day streak</span>
    </span>
  )
}

function CompactWorkout({ count, streak, missed, onLogExtra }: { count: number; streak: number; missed: number; onLogExtra: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5">
      <Link to="/workout?tab=history" className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white motion-safe:animate-pop-in">
          <CheckCircle2 className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{count > 1 ? `${count} workouts today` : 'Workout done today'}</span>
          {/* Each phrase is its own nowrap span: bare text in a flex row becomes shrinkable items that break mid-phrase. */}
          <span className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
            <Flame className={cn('h-3.5 w-3.5', streak > 0 && 'text-orange-500')} />
            <span className="whitespace-nowrap">{streak} day streak</span>
            {missed > 0 && <span className="whitespace-nowrap text-destructive">· {missed} owed</span>}
          </span>
        </span>
      </Link>
      <Button size="sm" variant="outline" onClick={onLogExtra} className="shrink-0 rounded-lg">
        <Plus className="mr-1 h-4 w-4" /> Log extra
      </Button>
    </div>
  )
}

type FullProps = {
  streak: number
  missed: number
  week: WorkoutDay[]
  onLogToday: () => void
  onPickDay: (day: WorkoutDay) => void
}

function FullWorkout({ streak, missed, week, onLogToday, onPickDay }: FullProps) {
  const now = new Date()
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000)
  const nudge = workoutNudge(streak, missed, now.getHours(), dayOfYear)

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-3.5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Workout</h2>
        <Link to="/workout?tab=history" className="flex items-center gap-0.5 text-xs text-primary">
          History <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      <button
        onClick={onLogToday}
        className="flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-left transition-transform active:scale-[0.98] motion-safe:animate-nudge-ring"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground motion-safe:animate-book-wiggle">
          <Dumbbell className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{nudge.title}</span>
          <span className={cn('block text-xs', missed > 0 ? 'text-destructive' : 'text-muted-foreground')}>{nudge.sub}</span>
        </span>
        <span className="shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">Log</span>
      </button>

      <div className="flex items-center justify-between px-0.5">
        <StreakCount streak={streak} />
        <div className="flex gap-1.5">
          {week.map(d => (
            <button
              key={d.key}
              onClick={() => onPickDay(d)}
              aria-label={`${d.isToday ? 'Today' : format(parseISO(d.key), 'EEEE d MMM')}: ${d.count > 0 ? `${d.count} ${d.count === 1 ? 'workout' : 'workouts'}` : 'no workout'}`}
              className="flex flex-col items-center gap-0.5 rounded-md px-0.5 transition-transform active:scale-90"
            >
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold leading-none text-white transition-colors',
                  d.count > 0 ? 'border-emerald-500 bg-emerald-500' : 'border-border bg-muted',
                  d.isToday && d.count === 0 && 'border-primary',
                )}
              >
                {d.count > 1 ? d.count : null}
              </span>
              <span className={cn('text-[10px] text-muted-foreground', d.isToday && 'font-semibold text-foreground')}>{d.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
