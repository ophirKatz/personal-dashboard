import { addDays, format, parseISO, startOfWeek, subWeeks } from 'date-fns'

const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

/** One exercise of a logged workout, as far as the statistics care. */
export type StatsItem = {
  exercise_name: string
  icon: string
  sets: number
  reps: number
  // Set for distance exercises (running), where sets/reps are unused placeholders.
  distance_km?: number | null
}

export type StatsLog = { id: string; log_date: string; items: StatsItem[] }

export type ExerciseStat = {
  /** Lower-cased name: the same exercise logged under a deleted-and-recreated copy still adds up. */
  key: string
  name: string
  icon: string
  /** Workouts that included the exercise (once each, even if it appears twice in one workout). */
  workouts: number
  /** Totals over the sets × reps entries; distance entries don't contribute. */
  sets: number
  reps: number
  /** Total kilometres over the distance entries. */
  distanceKm: number
  hasSetsReps: boolean
  hasDistance: boolean
}

/**
 * Per-exercise totals over `logs`, most-used first. Exercises are matched by name rather than id,
 * because a log keeps the name of an exercise that has since been deleted (its id is then null).
 * The name and icon shown are the first seen, so pass logs newest first to get the latest.
 */
export function exerciseStats(logs: readonly StatsLog[]): ExerciseStat[] {
  const byKey = new Map<string, ExerciseStat>()
  const logsSeen = new Map<string, Set<string>>()

  for (const log of logs) {
    for (const item of log.items) {
      const key = item.exercise_name.trim().toLowerCase()
      let stat = byKey.get(key)
      if (!stat) {
        stat = {
          key, name: item.exercise_name.trim(), icon: item.icon,
          workouts: 0, sets: 0, reps: 0, distanceKm: 0, hasSetsReps: false, hasDistance: false,
        }
        byKey.set(key, stat)
        logsSeen.set(key, new Set())
      }
      const seen = logsSeen.get(key)!
      if (!seen.has(log.id)) {
        seen.add(log.id)
        stat.workouts++
      }
      if (item.distance_km != null) {
        stat.distanceKm += item.distance_km
        stat.hasDistance = true
      } else {
        stat.sets += item.sets
        stat.reps += item.sets * item.reps
        stat.hasSetsReps = true
      }
    }
  }

  return [...byKey.values()]
    .map(s => ({ ...s, distanceKm: Math.round(s.distanceKm * 100) / 100 }))
    .sort((a, b) => b.workouts - a.workouts || a.name.localeCompare(b.name))
}

export const HEATMAP_WEEKS = 53

/** Shades of the heat map: 0 = no workout, then 1, 2, 3 and 4 or more workouts that day. */
export const HEAT_LEVELS = 4

export function heatLevel(count: number): number {
  return Math.max(0, Math.min(Math.floor(count), HEAT_LEVELS))
}

export type HeatDay = { key: string; count: number; future: boolean; isToday: boolean }

/**
 * The heat map grid: `weeks` columns of 7 days (Sunday first), ending with the week of today, the
 * way GitHub lays out its contributions graph. Days after today are flagged `future` and have no count.
 */
export function heatmapWeeks(counts: ReadonlyMap<string, number>, todayStr: string, weeks = HEATMAP_WEEKS): HeatDay[][] {
  const start = subWeeks(startOfWeek(parseISO(todayStr)), weeks - 1)
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const key = fmt(addDays(start, w * 7 + d))
      const future = key > todayStr
      return { key, count: future ? 0 : counts.get(key) ?? 0, future, isToday: key === todayStr }
    }),
  )
}

/** Workouts and distinct active days shown in the grid. */
export function heatmapTotals(weeks: readonly (readonly HeatDay[])[]): { workouts: number; activeDays: number } {
  let workouts = 0
  let activeDays = 0
  for (const week of weeks) {
    for (const day of week) {
      workouts += day.count
      if (day.count > 0) activeDays++
    }
  }
  return { workouts, activeDays }
}

/** A month label above the week column that holds that month's 1st (never for a 1st still to come). */
export function monthLabels(weeks: readonly (readonly HeatDay[])[]): { index: number; label: string }[] {
  const labels: { index: number; label: string }[] = []
  weeks.forEach((week, index) => {
    const first = week.find(d => !d.future && d.key.endsWith('-01'))
    if (first) labels.push({ index, label: format(parseISO(first.key), 'MMM') })
  })
  return labels
}
