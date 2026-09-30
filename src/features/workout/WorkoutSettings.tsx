import { useEffect, useState } from 'react'
import { Pencil, Plus, Star, Trash2 } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../supabase'
import type { WorkoutExercise } from '../../supabase'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
import { haptic } from '../../lib/haptics'
import { cn } from '../../utils'
import { CUSTOM_ICON_KEYS, exerciseIcon } from './exerciseIcons'
import Stepper from './Stepper'
import {
  addExercise, deleteExercise, deletePreset, ensureBuiltinExercises, loadExercises, loadPresets,
  savePreset, setDefaultPreset, type PresetWithExercises,
} from './workout'

type DraftPreset = { id?: string; name: string; items: { exercise_id: string; sets: number; reps: number }[] }

export default function WorkoutSettings() {
  const [user, setUser] = useState<User | null>(null)
  const [exercises, setExercises] = useState<WorkoutExercise[]>([])
  const [presets, setPresets] = useState<PresetWithExercises[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('dumbbell')
  const [draft, setDraft] = useState<DraftPreset | null>(null)

  async function load() {
    const [e, p] = await Promise.all([loadExercises(), loadPresets()])
    setExercises(e)
    setPresets(p)
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user)
      if (user) await ensureBuiltinExercises(user.id)
      load()
    })
  }, [])

  async function handleAddExercise() {
    const name = newName.trim()
    if (!user || !name) return
    await addExercise(user.id, name, newIcon)
    setNewName('')
    load()
  }

  async function handleDeleteExercise(ex: WorkoutExercise) {
    if (!confirm(`Delete "${ex.name}"? It will also be removed from presets.`)) return
    haptic('warning')
    await deleteExercise(ex.id)
    load()
  }

  async function handleSavePreset() {
    if (!user || !draft || !draft.name.trim()) return
    await savePreset(user.id, { ...draft, name: draft.name.trim() })
    setDraft(null)
    load()
  }

  function toggleDraftExercise(id: string) {
    setDraft(d => {
      if (!d) return d
      const has = d.items.some(i => i.exercise_id === id)
      return { ...d, items: has ? d.items.filter(i => i.exercise_id !== id) : [...d.items, { exercise_id: id, sets: 3, reps: 10 }] }
    })
  }

  function updateDraftItem(id: string, patch: { sets?: number; reps?: number }) {
    setDraft(d => d && { ...d, items: d.items.map(i => (i.exercise_id === id ? { ...i, ...patch } : i)) })
  }

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Presets</h2>
          <Button size="sm" onClick={() => setDraft({ name: '', items: [] })}>
            <Plus className="h-4 w-4 mr-1" /> New preset
          </Button>
        </div>
        {presets.length === 0 && <p className="text-sm text-muted-foreground">No presets yet.</p>}
        {presets.map(p => (
          <div key={p.id} className="bg-card border border-border rounded-xl p-3">
            <div className="flex items-center gap-2">
              <span className="font-medium flex-1 truncate">{p.name}</span>
              <button
                onClick={async () => { haptic('selection'); await setDefaultPreset(p.id); load() }}
                aria-label={p.is_default ? 'Default preset' : 'Make default'}
                title={p.is_default ? 'Default preset' : 'Make default'}
                className="p-1.5 rounded-lg hover:bg-accent"
              >
                <Star className={cn('h-4 w-4', p.is_default ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground')} />
              </button>
              <button
                onClick={() => setDraft({ id: p.id, name: p.name, items: p.items.map(i => ({ exercise_id: i.exercise_id, sets: i.sets, reps: i.reps })) })}
                aria-label="Edit preset"
                className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={async () => { if (confirm(`Delete preset "${p.name}"?`)) { haptic('warning'); await deletePreset(p); load() } }}
                aria-label="Delete preset"
                className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {p.items.map(i => {
                const ex = exercises.find(e => e.id === i.exercise_id)
                return ex ? `${ex.name} ${i.sets}×${i.reps}` : null
              }).filter(Boolean).join(' · ') || 'No exercises'}
            </p>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Exercises</h2>
        <div className="space-y-2">
          {exercises.map(ex => {
            const Icon = exerciseIcon(ex.icon)
            return (
              <div key={ex.id} className="flex items-center gap-3 bg-card border border-border rounded-xl px-3 py-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-sm flex-1 truncate">{ex.name}</span>
                {!ex.builtin_key && (
                  <button onClick={() => handleDeleteExercise(ex)} aria-label={`Delete ${ex.name}`} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <div className="space-y-2 pt-1">
          <p className="text-xs font-medium text-muted-foreground">Add your own</p>
          <div className="flex gap-1.5 flex-wrap">
            {CUSTOM_ICON_KEYS.map(key => {
              const Icon = exerciseIcon(key)
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={`Icon ${key}`}
                  onClick={() => setNewIcon(key)}
                  className={cn('w-9 h-9 rounded-lg border flex items-center justify-center', newIcon === key ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground')}
                >
                  <Icon className="h-4 w-4" />
                </button>
              )
            })}
          </div>
          <div className="flex gap-2">
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Exercise name" onKeyDown={e => e.key === 'Enter' && handleAddExercise()} />
            <Button onClick={handleAddExercise} disabled={!newName.trim()}>Add</Button>
          </div>
        </div>
      </section>

      {draft && (
        <Drawer open onOpenChange={v => !v && setDraft(null)}>
          <DrawerContent>
            <DrawerHeader><DrawerTitle>{draft.id ? 'Edit preset' : 'New preset'}</DrawerTitle></DrawerHeader>
            <DrawerBody className="space-y-4">
              <Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Preset name" />
              <div className="space-y-2">
                {exercises.map(ex => {
                  const Icon = exerciseIcon(ex.icon)
                  const item = draft.items.find(i => i.exercise_id === ex.id)
                  return (
                    <div key={ex.id} className={cn('rounded-xl border p-3 space-y-2', item ? 'border-primary/40 bg-primary/5' : 'border-border')}>
                      <button type="button" onClick={() => toggleDraftExercise(ex.id)} className="flex items-center gap-2 w-full text-left">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm flex-1">{ex.name}</span>
                        <span className="text-xs text-muted-foreground">{item ? 'Included' : 'Add'}</span>
                      </button>
                      {item && (
                        <div className="flex flex-wrap gap-x-5 gap-y-2">
                          <Stepper label="Sets" value={item.sets} onChange={v => updateDraftItem(ex.id, { sets: v })} />
                          <Stepper label="Reps" value={item.reps} onChange={v => updateDraftItem(ex.id, { reps: v })} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <Button className="w-full" size="lg" onClick={handleSavePreset} disabled={!draft.name.trim() || draft.items.length === 0}>
                Save preset
              </Button>
            </DrawerBody>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  )
}
