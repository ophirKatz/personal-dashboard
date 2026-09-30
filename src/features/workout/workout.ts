import { supabase } from '../../supabase'
import type { WorkoutExercise, WorkoutLog, WorkoutLogExercise, WorkoutPreset, WorkoutPresetExercise } from '../../supabase'
import { today } from '../../utils'
import { BUILTIN_EXERCISES } from './exerciseIcons'

export type PresetWithExercises = WorkoutPreset & { items: WorkoutPresetExercise[] }
export type LogWithExercises = WorkoutLog & { items: WorkoutLogExercise[] }

// One editable row of a workout instance (either a new log or an edit).
export type WorkoutDraftItem = {
  exercise_id: string | null
  exercise_name: string
  icon: string
  sets: number
  reps: number
}

// Built-ins are seeded lazily per user; the unique index makes this idempotent.
export async function ensureBuiltinExercises(userId: string): Promise<void> {
  await supabase.from('workout_exercises').upsert(
    BUILTIN_EXERCISES.map(e => ({ user_id: userId, name: e.name, icon: e.key, builtin_key: e.key })),
    { onConflict: 'user_id,builtin_key', ignoreDuplicates: true },
  )
}

export async function loadExercises(): Promise<WorkoutExercise[]> {
  const { data } = await supabase.from('workout_exercises').select('*').order('created_at').order('name')
  return data ?? []
}

export async function loadPresets(): Promise<PresetWithExercises[]> {
  const [{ data: presets }, { data: items }] = await Promise.all([
    supabase.from('workout_presets').select('*').order('created_at'),
    supabase.from('workout_preset_exercises').select('*').order('position'),
  ])
  return (presets ?? []).map(p => ({ ...p, items: (items ?? []).filter(i => i.preset_id === p.id) }))
}

export async function loadLogs(limit = 100): Promise<LogWithExercises[]> {
  const { data: logs } = await supabase
    .from('workout_logs')
    .select('*')
    .order('log_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (!logs?.length) return []
  const { data: items } = await supabase
    .from('workout_log_exercises')
    .select('*')
    .in('log_id', logs.map(l => l.id))
    .order('position')
  return logs.map(l => ({ ...l, items: (items ?? []).filter(i => i.log_id === l.id) }))
}

export async function hasWorkedOutToday(): Promise<boolean> {
  const { count } = await supabase
    .from('workout_logs')
    .select('id', { count: 'exact', head: true })
    .eq('log_date', today())
  return (count ?? 0) > 0
}

async function replaceLogItems(userId: string, logId: string, items: WorkoutDraftItem[]) {
  await supabase.from('workout_log_exercises').delete().eq('log_id', logId)
  if (items.length === 0) return
  await supabase.from('workout_log_exercises').insert(
    items.map((it, position) => ({ ...it, user_id: userId, log_id: logId, position })),
  )
}

export async function createLog(
  userId: string,
  data: { preset_id: string | null; preset_name: string | null; log_date: string; notes: string | null; items: WorkoutDraftItem[] },
): Promise<void> {
  const { items, ...log } = data
  const { data: created, error } = await supabase
    .from('workout_logs')
    .insert({ ...log, user_id: userId })
    .select('id')
    .single()
  if (error || !created) throw error ?? new Error('Failed to log workout')
  await replaceLogItems(userId, created.id, items)
}

export async function updateLog(
  log: WorkoutLog,
  data: { log_date: string; notes: string | null; items: WorkoutDraftItem[] },
): Promise<void> {
  await supabase.from('workout_logs').update({ log_date: data.log_date, notes: data.notes }).eq('id', log.id)
  await replaceLogItems(log.user_id, log.id, data.items)
}

export async function deleteLog(id: string): Promise<void> {
  await supabase.from('workout_logs').delete().eq('id', id)
}

export async function savePreset(
  userId: string,
  preset: { id?: string; name: string; items: { exercise_id: string; sets: number; reps: number }[] },
): Promise<void> {
  let id = preset.id
  if (id) {
    await supabase.from('workout_presets').update({ name: preset.name }).eq('id', id)
    await supabase.from('workout_preset_exercises').delete().eq('preset_id', id)
  } else {
    const { data: existing } = await supabase.from('workout_presets').select('id').limit(1)
    const { data, error } = await supabase
      .from('workout_presets')
      .insert({ user_id: userId, name: preset.name, is_default: !existing?.length })
      .select('id')
      .single()
    if (error || !data) throw error ?? new Error('Failed to save preset')
    id = data.id
  }
  if (preset.items.length > 0) {
    await supabase.from('workout_preset_exercises').insert(
      preset.items.map((it, position) => ({ ...it, user_id: userId, preset_id: id!, position })),
    )
  }
}

export async function setDefaultPreset(id: string): Promise<void> {
  // Clear first: the partial unique index allows only one default per user.
  await supabase.from('workout_presets').update({ is_default: false }).eq('is_default', true)
  await supabase.from('workout_presets').update({ is_default: true }).eq('id', id)
}

export async function deletePreset(preset: WorkoutPreset): Promise<void> {
  await supabase.from('workout_presets').delete().eq('id', preset.id)
  if (preset.is_default) {
    const { data } = await supabase.from('workout_presets').select('id').order('created_at').limit(1)
    if (data?.[0]) await setDefaultPreset(data[0].id)
  }
}

export async function addExercise(userId: string, name: string, icon: string): Promise<void> {
  await supabase.from('workout_exercises').insert({ user_id: userId, name, icon })
}

export async function deleteExercise(id: string): Promise<void> {
  await supabase.from('workout_exercises').delete().eq('id', id)
}
