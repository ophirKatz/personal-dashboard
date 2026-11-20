import { describe, expect, it } from 'vitest'
import { countByDay } from './workoutTracking'
import { exerciseStats, heatLevel, heatmapTotals, heatmapWeeks, monthLabels, type StatsLog } from './workoutStats'

const item = (exercise_name: string, sets: number, reps: number, distance_km: number | null = null) =>
  ({ exercise_name, icon: exercise_name.toLowerCase(), sets, reps, distance_km })

describe('exerciseStats', () => {
  const logs: StatsLog[] = [
    { id: 'c', log_date: '2026-11-03', items: [item('Push ups', 3, 10), item('Running', 1, 1, 5.5)] },
    { id: 'b', log_date: '2026-11-02', items: [item('Push ups', 4, 12), item('Squats', 2, 20)] },
    { id: 'a', log_date: '2026-11-01', items: [item('Running', 1, 1, 3.25)] },
  ]

  it('totals sets, reps (sets × reps) and the workouts each exercise appeared in', () => {
    const pushUps = exerciseStats(logs).find(s => s.name === 'Push ups')!
    expect(pushUps).toMatchObject({ workouts: 2, sets: 7, reps: 3 * 10 + 4 * 12, distanceKm: 0, hasSetsReps: true, hasDistance: false })
  })

  it('totals kilometres for a distance exercise and ignores its placeholder 1×1', () => {
    const running = exerciseStats(logs).find(s => s.name === 'Running')!
    expect(running).toMatchObject({ workouts: 2, sets: 0, reps: 0, distanceKm: 8.75, hasSetsReps: false, hasDistance: true })
  })

  it('does not accumulate floating point noise in the distance', () => {
    const noisy: StatsLog[] = [
      { id: 'a', log_date: '2026-11-01', items: [item('Running', 1, 1, 0.1)] },
      { id: 'b', log_date: '2026-11-02', items: [item('Running', 1, 1, 0.2)] },
    ]
    expect(exerciseStats(noisy)[0].distanceKm).toBe(0.3)
  })

  it('counts a workout once even when the exercise appears twice in it', () => {
    const twice: StatsLog[] = [{ id: 'a', log_date: '2026-11-01', items: [item('Squats', 3, 10), item('Squats', 2, 8)] }]
    expect(exerciseStats(twice)[0]).toMatchObject({ workouts: 1, sets: 5, reps: 30 + 16 })
  })

  it('merges by name regardless of case, so a re-created exercise keeps adding up', () => {
    const renamed: StatsLog[] = [
      { id: 'b', log_date: '2026-11-02', items: [item('Plank', 1, 1)] },
      { id: 'a', log_date: '2026-11-01', items: [item(' plank ', 1, 1)] },
    ]
    const stats = exerciseStats(renamed)
    expect(stats).toHaveLength(1)
    expect(stats[0]).toMatchObject({ name: 'Plank', workouts: 2 })
  })

  it('lists the most-used exercise first, ties by name', () => {
    expect(exerciseStats(logs).map(s => s.name)).toEqual(['Push ups', 'Running', 'Squats'])
  })

  it('is empty without workouts', () => {
    expect(exerciseStats([])).toEqual([])
  })
})

describe('heatLevel', () => {
  it('maps the workouts in a day to a shade, topping out at 4', () => {
    expect([0, 1, 2, 3, 4, 5, 12].map(heatLevel)).toEqual([0, 1, 2, 3, 4, 4, 4])
  })
})

describe('heatmapWeeks', () => {
  // Friday: its week runs Sun 15 Nov to Sat 21 Nov.
  const todayStr = '2026-11-20'
  const counts = countByDay(['2026-11-20', '2026-11-20', '2026-11-16', '2025-11-16', '2025-11-15', '2026-11-21'])
  const weeks = heatmapWeeks(counts, todayStr)

  it('is 53 weeks of 7 days, Sunday first, ending with the week of today', () => {
    expect(weeks).toHaveLength(53)
    expect(weeks.every(w => w.length === 7)).toBe(true)
    expect(weeks[52][0].key).toBe('2026-11-15')
    expect(weeks[52][6].key).toBe('2026-11-21')
    expect(weeks[0][0].key).toBe('2025-11-16')
  })

  it('carries each day\'s workout count and marks today', () => {
    expect(weeks[52][5]).toEqual({ key: '2026-11-20', count: 2, future: false, isToday: true })
    expect(weeks[52][1]).toMatchObject({ key: '2026-11-16', count: 1, isToday: false })
  })

  it('flags days after today and gives them no count, even if one was logged', () => {
    expect(weeks[52][6]).toEqual({ key: '2026-11-21', count: 0, future: true, isToday: false })
  })

  it('leaves out workouts older than the first week', () => {
    expect(weeks.flat().some(d => d.key === '2025-11-15')).toBe(false)
    expect(weeks[0][0].count).toBe(1)
  })

  it('has no repeated or skipped days across a DST change', () => {
    const keys = weeks.flat().map(d => d.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toEqual([...keys].sort())
  })
})

describe('heatmapTotals', () => {
  it('sums the workouts and the days that have one', () => {
    const weeks = heatmapWeeks(countByDay(['2026-11-20', '2026-11-20', '2026-11-16']), '2026-11-20')
    expect(heatmapTotals(weeks)).toEqual({ workouts: 3, activeDays: 2 })
  })
})

describe('monthLabels', () => {
  const weeks = heatmapWeeks(new Map(), '2026-11-20')
  const labels = monthLabels(weeks)

  it('puts each month above the week holding its 1st', () => {
    // 1 Dec 2025 is a Monday in the week of Sun 30 Nov 2025: the 3rd column.
    expect(labels[0]).toEqual({ index: 2, label: 'Dec' })
    // 1 Nov 2026 is a Sunday: the week starting 1 Nov is 2 columns before the last.
    expect(labels[labels.length - 1]).toEqual({ index: 50, label: 'Nov' })
  })

  it('labels twelve months, one per column at most', () => {
    expect(labels.map(l => l.label)).toEqual(['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'])
    expect(new Set(labels.map(l => l.index)).size).toBe(labels.length)
  })

  it('skips a 1st that has not happened yet', () => {
    // Mon 30 Nov 2026: the last column (29 Nov - 5 Dec) contains Tue 1 Dec, which is still to come.
    const w = heatmapWeeks(new Map(), '2026-11-30')
    expect(monthLabels(w).some(l => l.index === 52)).toBe(false)
  })
})
