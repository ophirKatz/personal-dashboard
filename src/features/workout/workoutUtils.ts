// An exercise's amount is either sets x reps or, for distance exercises (running), kilometres.
// An item is a distance item when distance_km is set; sets/reps are then unused placeholders.
// Optional because rows read before the distance migration is applied don't have the column.
export type Amount = { sets: number; reps: number; distance_km?: number | null }

export const DEFAULT_SETS = 3
export const DEFAULT_REPS = 10
export const DEFAULT_DISTANCE_KM = 3
export const MIN_DISTANCE_KM = 0.1
export const MAX_DISTANCE_KM = 999

// Distance exercises are identified by their built-in key; custom exercises are sets x reps.
export function isDistanceExercise(exercise: { builtin_key: string | null }): boolean {
  return exercise.builtin_key === 'running'
}

// The amount a freshly added exercise starts with.
export function defaultAmount(exercise: { builtin_key: string | null }): Required<Amount> {
  return isDistanceExercise(exercise)
    ? { sets: 1, reps: 1, distance_km: DEFAULT_DISTANCE_KM }
    : { sets: DEFAULT_SETS, reps: DEFAULT_REPS, distance_km: null }
}

// "5", "5.5", "3.25": at most two decimals, no trailing zeros.
export function formatKm(km: number): string {
  return String(Number(km.toFixed(2)))
}

// Parses what was typed into the distance box (a comma works as the decimal mark). Null unless it is
// a usable distance, so half-typed input like "" or "3." never reaches the stored value as junk.
export function parseKm(text: string): number | null {
  const n = Number(text.trim().replace(',', '.'))
  if (!Number.isFinite(n) || n < MIN_DISTANCE_KM) return null
  return Math.min(MAX_DISTANCE_KM, Math.round(n * 100) / 100)
}

// "3×10" or "5 km".
export function formatAmount(item: Amount): string {
  return item.distance_km != null ? `${formatKm(item.distance_km)} km` : `${item.sets}×${item.reps}`
}

export function summarizeItem(item: { exercise_name: string } & Amount): string {
  return `${item.exercise_name} ${formatAmount(item)}`
}

// The amount columns to write. sets/reps are NOT NULL, so a distance item stores 1/1 next to its
// distance. distance_km is left out entirely for a normal item, so writing a normal workout does
// not depend on the distance migration having been applied.
export function amountColumns(item: Amount): { sets: number; reps: number; distance_km?: number } {
  return item.distance_km != null
    ? { sets: 1, reps: 1, distance_km: item.distance_km }
    : { sets: item.sets, reps: item.reps }
}

export function pickDefaultPreset<T extends { is_default: boolean }>(presets: T[]): T | undefined {
  return presets.find(p => p.is_default) ?? presets[0]
}
