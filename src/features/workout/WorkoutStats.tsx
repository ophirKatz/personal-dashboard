import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../components/ui/button'
import { today } from '../../utils'
import { exerciseIcon } from './exerciseIcons'
import { loadWorkoutStats } from './workout'
import { exerciseStats, type ExerciseStat, type StatsLog } from './workoutStats'
import { countByDay } from './workoutTracking'
import WorkoutHeatmap from './WorkoutHeatmap'

const number = (n: number) => n.toLocaleString()

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-xl font-semibold leading-tight tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

function ExerciseCard({ stat }: { stat: ExerciseStat }) {
  const Icon = exerciseIcon(stat.icon)
  const tiles: { value: string; label: string }[] = []
  if (stat.hasSetsReps) tiles.push({ value: number(stat.sets), label: 'Sets' }, { value: number(stat.reps), label: 'Reps' })
  if (stat.hasDistance) tiles.push({ value: `${stat.distanceKm.toLocaleString(undefined, { maximumFractionDigits: 2 })} km`, label: 'Distance' })
  tiles.push({ value: number(stat.workouts), label: 'Workouts' })

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-300">
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="min-w-0 flex-1 truncate font-medium">{stat.name}</h3>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}>
        {tiles.map(t => <Tile key={t.label} {...t} />)}
      </div>
    </div>
  )
}

export default function WorkoutStats() {
  const [logs, setLogs] = useState<StatsLog[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const todayStr = today()

  useEffect(() => {
    let cancelled = false
    setFailed(false)
    loadWorkoutStats().then(
      result => { if (!cancelled) setLogs(result) },
      () => { if (!cancelled) setFailed(true) },
    )
    return () => { cancelled = true }
  }, [attempt])

  const counts = useMemo(() => countByDay((logs ?? []).map(l => l.log_date)), [logs])
  const stats = useMemo(() => exerciseStats(logs ?? []), [logs])

  if (failed) return (
    <div className="py-12 text-center text-muted-foreground">
      <p className="mb-3 font-medium">Couldn't load your statistics</p>
      <Button variant="outline" size="sm" onClick={() => setAttempt(a => a + 1)}>Try again</Button>
    </div>
  )

  if (!logs) return <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>

  if (!logs.length) return (
    <div className="py-12 text-center text-muted-foreground">
      <div className="mb-3 text-4xl">📊</div>
      <p className="font-medium">No workouts yet</p>
      <p className="text-sm">Log a workout and your stats will show up here</p>
    </div>
  )

  return (
    <div className="space-y-5">
      <WorkoutHeatmap counts={counts} todayStr={todayStr} />

      <section>
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="text-base font-semibold">Exercises</h2>
          <p className="text-xs text-muted-foreground">All time · {number(logs.length)} {logs.length === 1 ? 'workout' : 'workouts'}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {stats.map(s => <ExerciseCard key={s.key} stat={s} />)}
        </div>
      </section>
    </div>
  )
}
