import { useEffect, useMemo, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { cn } from '../../utils'
import { HEAT_LEVELS, heatLevel, heatmapTotals, heatmapWeeks, monthLabels, type HeatDay } from './workoutStats'

// Purple that deepens with each extra workout in a day. Written out in full so Tailwind keeps the classes.
// On the dark theme a darker purple would sink into the card, so there the scale runs the other way:
// more workouts = brighter. Either way, a stronger shade always means more workouts.
const LEVEL_CLASSES = [
  'bg-muted',
  'bg-purple-300 dark:bg-purple-900',
  'bg-purple-500 dark:bg-purple-700',
  'bg-purple-700 dark:bg-purple-500',
  'bg-purple-900 dark:bg-purple-300',
]

// Sunday first, like the columns; only every other row is labelled so the labels don't crowd.
const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

function describeDay(day: HeatDay): string {
  const when = format(parseISO(day.key), 'EEE d MMM yyyy')
  return `${when}: ${day.count === 0 ? 'no workouts' : plural(day.count, 'workout', 'workouts')}`
}

function levelName(level: number): string {
  if (level === 0) return 'No workouts'
  return level === HEAT_LEVELS ? `${level}+ workouts` : plural(level, 'workout', 'workouts')
}

/** A GitHub-style contributions graph of the last year of workouts: one square per day, shaded by how many. */
export default function WorkoutHeatmap({ counts, todayStr }: { counts: ReadonlyMap<string, number>; todayStr: string }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const weeks = useMemo(() => heatmapWeeks(counts, todayStr), [counts, todayStr])
  const totals = useMemo(() => heatmapTotals(weeks), [weeks])
  const labels = useMemo(() => new Map(monthLabels(weeks).map(l => [l.index, l.label])), [weeks])
  const selectedDay = useMemo(() => weeks.flat().find(d => d.key === selected), [weeks, selected])

  // The grid is wider than a phone: start at the present, with the past a swipe away.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [weeks])

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="text-base font-semibold">Activity</h2>
        <p className="text-xs text-muted-foreground">
          {plural(totals.workouts, 'workout', 'workouts')} on {plural(totals.activeDays, 'day', 'days')} in the last year
        </p>
      </div>

      {/* No padding on the scroller itself: the weekday labels stick to its edge, and any gap there lets cells show through. */}
      <div ref={scrollRef} className="overflow-x-auto pb-2">
        <div className="flex w-max gap-[3px] pr-1">
          {/* Stays put while the weeks scroll under it. */}
          <div className="sticky left-0 z-10 flex flex-col gap-[3px] bg-card pr-1">
            <div className="h-3.5" />
            {WEEKDAY_LABELS.map((label, i) => (
              <div key={i} className="flex h-4 items-center text-[10px] leading-none text-muted-foreground">{label}</div>
            ))}
          </div>

          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {/* The month name may be wider than its column; the columns after it have no label, so it spills over them. */}
              <div className="relative h-3.5 w-4">
                {labels.has(wi) && (
                  <span className="absolute left-0 top-0 whitespace-nowrap text-[10px] leading-[14px] text-muted-foreground">{labels.get(wi)}</span>
                )}
              </div>
              {week.map(day =>
                day.future ? (
                  <div key={day.key} className="h-4 w-4" />
                ) : (
                  <div
                    key={day.key}
                    role="img"
                    title={describeDay(day)}
                    aria-label={describeDay(day)}
                    onClick={() => setSelected(s => (s === day.key ? null : day.key))}
                    className={cn(
                      'h-4 w-4 cursor-pointer rounded-[3px]',
                      LEVEL_CLASSES[heatLevel(day.count)],
                      day.isToday && 'ring-1 ring-foreground/50 ring-offset-1 ring-offset-card',
                      day.key === selected && 'ring-2 ring-primary ring-offset-1 ring-offset-card',
                    )}
                  />
                ),
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between gap-3">
        <p className="min-w-0 text-xs text-muted-foreground" aria-live="polite">
          {selectedDay ? <span className="font-medium text-foreground">{describeDay(selectedDay)}</span> : 'Tap a day for details'}
        </p>
        <div className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
          Less
          {LEVEL_CLASSES.map((cls, level) => (
            <span key={level} title={levelName(level)} className={cn('h-3 w-3 rounded-[3px]', cls)} />
          ))}
          More
        </div>
      </div>
    </div>
  )
}
