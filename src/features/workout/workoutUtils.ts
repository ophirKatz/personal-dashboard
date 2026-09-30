export function summarizeItem(item: { exercise_name: string; sets: number; reps: number }): string {
  return `${item.exercise_name} ${item.sets}×${item.reps}`
}

export function pickDefaultPreset<T extends { is_default: boolean }>(presets: T[]): T | undefined {
  return presets.find(p => p.is_default) ?? presets[0]
}
