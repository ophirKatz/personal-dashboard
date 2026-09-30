import { useEffect, useState } from 'react'
import { CalendarDays, Trash2 } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../supabase'
import type { WorkoutLog } from '../../supabase'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Textarea } from '../../components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { haptic } from '../../lib/haptics'
import { celebrate } from '../../lib/confetti'
import { today } from '../../utils'
import { exerciseIcon } from './exerciseIcons'
import Stepper from './Stepper'
import {
  createLog, ensureBuiltinExercises, loadPresets, updateLog,
  type PresetWithExercises, type WorkoutDraftItem, type LogWithExercises,
} from './workout'
import { loadExercises } from './workout'
import { pickDefaultPreset } from './workoutUtils'
import type { WorkoutExercise } from '../../supabase'

type Props = {
  // When set, the form edits this logged instance instead of creating one.
  editing?: LogWithExercises
  onSaved: () => void
}

function itemsFromPreset(preset: PresetWithExercises, exercises: WorkoutExercise[]): WorkoutDraftItem[] {
  return preset.items.flatMap(i => {
    const ex = exercises.find(e => e.id === i.exercise_id)
    return ex ? [{ exercise_id: ex.id, exercise_name: ex.name, icon: ex.icon, sets: i.sets, reps: i.reps }] : []
  })
}

export default function WorkoutForm({ editing, onSaved }: Props) {
  const [user, setUser] = useState<User | null>(null)
  const [presets, setPresets] = useState<PresetWithExercises[]>([])
  const [exercises, setExercises] = useState<WorkoutExercise[]>([])
  const [presetId, setPresetId] = useState<string>(editing?.preset_id ?? '')
  const [items, setItems] = useState<WorkoutDraftItem[]>(
    editing?.items.map(i => ({ exercise_id: i.exercise_id, exercise_name: i.exercise_name, icon: i.icon, sets: i.sets, reps: i.reps })) ?? [],
  )
  const [date, setDate] = useState(editing?.log_date ?? today())
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) await ensureBuiltinExercises(user.id)
      const [p, e] = await Promise.all([loadPresets(), loadExercises()])
      setPresets(p)
      setExercises(e)
      if (!editing) {
        const def = pickDefaultPreset(p)
        if (def) {
          setPresetId(def.id)
          setItems(itemsFromPreset(def, e))
        }
      }
      setLoading(false)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function choosePreset(id: string) {
    setPresetId(id)
    const preset = presets.find(p => p.id === id)
    if (preset) setItems(itemsFromPreset(preset, exercises))
  }

  function updateItem(index: number, patch: Partial<WorkoutDraftItem>) {
    setItems(prev => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }

  function addExercise(id: string) {
    const ex = exercises.find(e => e.id === id)
    if (ex) setItems(prev => [...prev, { exercise_id: ex.id, exercise_name: ex.name, icon: ex.icon, sets: 3, reps: 10 }])
  }

  async function handleSave() {
    if (!user || items.length === 0) return
    setSaving(true)
    try {
      if (editing) {
        await updateLog(editing as WorkoutLog, { log_date: date, notes: notes.trim() || null, items })
      } else {
        const preset = presets.find(p => p.id === presetId)
        await createLog(user.id, {
          preset_id: preset?.id ?? null,
          preset_name: preset?.name ?? null,
          log_date: date,
          notes: notes.trim() || null,
          items,
        })
        celebrate()
        setNotes('')
        setDate(today())
      }
      haptic('success')
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-5">
      {!editing && (
        presets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No presets yet — create one in the Settings tab, or add exercises below for a one-off workout.</p>
        ) : (
          <Select value={presetId} onValueChange={choosePreset}>
            <SelectTrigger><SelectValue placeholder="Choose a preset" /></SelectTrigger>
            <SelectContent>
              {presets.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}{p.is_default ? ' (default)' : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      )}

      <div className="flex items-center gap-2 text-muted-foreground">
        <CalendarDays className="h-4 w-4 shrink-0" />
        <Input
          type="date"
          value={date}
          max={today()}
          onChange={e => setDate(e.target.value)}
          className="w-auto h-8 px-2 py-1 text-sm text-foreground"
        />
      </div>

      <div className="space-y-2">
        {items.map((item, index) => {
          const Icon = exerciseIcon(item.icon)
          return (
            <div key={index} className="bg-card border border-border rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="font-medium text-sm flex-1 truncate">{item.exercise_name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${item.exercise_name}`}
                  onClick={() => setItems(prev => prev.filter((_, i) => i !== index))}
                  className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                <Stepper label="Sets" value={item.sets} onChange={v => updateItem(index, { sets: v })} />
                <Stepper label="Reps" value={item.reps} onChange={v => updateItem(index, { reps: v })} />
              </div>
            </div>
          )
        })}
        {items.length === 0 && <p className="text-sm text-muted-foreground">No exercises in this workout.</p>}
      </div>

      <Select value="" onValueChange={addExercise}>
        <SelectTrigger><SelectValue placeholder="Add exercise…" /></SelectTrigger>
        <SelectContent>
          {exercises.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <Textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="min-h-[60px] text-sm"
      />

      <Button onClick={handleSave} disabled={saving || items.length === 0} className="w-full" size="lg">
        {saving ? 'Saving…' : editing ? 'Save changes' : 'Log workout as done'}
      </Button>
    </div>
  )
}
