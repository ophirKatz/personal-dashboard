import { useState } from 'react'
import { RotateCcw, Trash2 } from 'lucide-react'
import type { DayOverride, Invitee, WeekPreset } from '../../supabase'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
import { haptic } from '../../lib/haptics'
import { cn } from '../../utils'
import InviteeInput from './InviteeInput'
import { DOW_LABELS, EMOJI_CHOICES, draftFromPreset, durationOptions, emptyDraft, formatDuration, type PresetDraft } from './planner'
import { deletePreset, savePreset } from './presets'

type Props = {
  // The preset being edited, or null to make a new one (optionally starting from `initial`).
  preset: WeekPreset | null
  initial?: PresetDraft
  pool: Invitee[]
  // Where a new preset goes in the list.
  nextPosition: number
  onClose: () => void
  onSaved: () => void
}

function DurationSelect({ value, onChange, className, label }: { value: number; onChange: (minutes: number) => void; className?: string; label: string }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className={cn(
        'h-10 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm',
        className,
      )}
    >
      {durationOptions([value]).map(m => <option key={m} value={m}>{formatDuration(m)}</option>)}
    </select>
  )
}

const validTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)

export default function PresetEditor({ preset, initial, pool, nextPosition, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<PresetDraft>(() => (preset ? draftFromPreset(preset) : initial ?? emptyDraft()))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const patch = (changes: Partial<PresetDraft>) => setDraft(d => ({ ...d, ...changes }))

  function toggleDay(dow: number) {
    haptic('selection')
    setDraft(d => ({ ...d, days: d.days.includes(dow) ? d.days.filter(x => x !== dow) : [...d.days, dow] }))
  }

  // A weekday keeps an override only while something about it differs from the default.
  function setOverride(dow: number, changes: DayOverride) {
    setDraft(d => {
      const merged = { ...d.overrides[dow], ...changes }
      const overrides = { ...d.overrides }
      if (merged.time === undefined && merged.duration === undefined) delete overrides[dow]
      else overrides[dow] = merged
      return { ...d, overrides }
    })
  }

  function resetDay(dow: number) {
    setDraft(d => {
      const overrides = { ...d.overrides }
      delete overrides[dow]
      return { ...d, overrides }
    })
  }

  const canSave = draft.title.trim().length > 0 && validTime(draft.time) && !saving

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      await savePreset(draft, preset?.id ?? null, nextPosition)
      haptic('success')
      onSaved()
    } catch (e) {
      console.error('Could not save preset', e)
      setError(`Could not save: ${(e as { message?: string })?.message ?? 'unknown error'}`)
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!preset || !confirm(`Delete "${preset.title}"? Events already on your calendar stay.`)) return
    setSaving(true)
    setError(null)
    try {
      await deletePreset(preset.id)
      haptic('warning')
      onSaved()
    } catch (e) {
      console.error('Could not delete preset', e)
      setError(`Could not delete: ${(e as { message?: string })?.message ?? 'unknown error'}`)
      setSaving(false)
    }
  }

  return (
    <Drawer open onOpenChange={open => !open && onClose()}>
      <DrawerContent aria-describedby={undefined}>
        <DrawerHeader><DrawerTitle>{preset ? 'Edit preset' : 'New preset'}</DrawerTitle></DrawerHeader>
        <DrawerBody className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="preset-title">Event title</Label>
            <Input
              id="preset-title"
              dir="auto"
              value={draft.title}
              onChange={e => patch({ title: e.target.value })}
              placeholder="e.g. Climbing session"
              autoFocus={!preset && !initial}
            />
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Emoji">
              {EMOJI_CHOICES.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  role="radio"
                  aria-checked={draft.emoji === emoji}
                  aria-label={emoji}
                  onClick={() => patch({ emoji })}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition-colors',
                    draft.emoji === emoji ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent',
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 min-w-0">
              <Label htmlFor="preset-time">Usually starts</Label>
              <Input id="preset-time" type="time" value={draft.time} onChange={e => patch({ time: e.target.value })} />
            </div>
            <div className="space-y-2 min-w-0">
              <Label>Lasts</Label>
              <DurationSelect label="Default duration" value={draft.duration} onChange={duration => patch({ duration })} className="h-10" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Days</Label>
            <p className="text-xs text-muted-foreground">
              Pick the days it usually happens: they come pre-selected every week. Change a day's time or length to make that weekday different.
            </p>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {DOW_LABELS.map((label, dow) => {
                const override = draft.overrides[dow]
                const time = override?.time ?? draft.time
                const duration = override?.duration ?? draft.duration
                const timeDiffers = time !== draft.time
                const durationDiffers = duration !== draft.duration
                const on = draft.days.includes(dow)
                return (
                  <li key={dow} className="flex items-center gap-2 px-2 py-1.5">
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-label={`${label} is ${on ? 'on' : 'off'}`}
                      onClick={() => toggleDay(dow)}
                      className={cn(
                        'h-9 w-14 shrink-0 rounded-lg text-sm font-medium transition-colors',
                        on ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent',
                      )}
                    >
                      {label}
                    </button>
                    <Input
                      type="time"
                      aria-label={`${label} start time`}
                      value={time}
                      onChange={e => setOverride(dow, { time: e.target.value || undefined })}
                      className={cn('h-9 min-w-0 flex-1', timeDiffers && 'border-primary')}
                    />
                    <div className="w-24 shrink-0">
                      <DurationSelect
                        label={`${label} duration`}
                        value={duration}
                        onChange={m => setOverride(dow, { duration: m })}
                        className={cn('h-9', durationDiffers && 'border-primary')}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => resetDay(dow)}
                      aria-label={`Reset ${label} to the default`}
                      title="Back to the default"
                      className={cn('shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-accent', !(timeDiffers || durationDiffers) && 'invisible')}
                      tabIndex={timeDiffers || durationDiffers ? 0 : -1}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="space-y-2">
            <Label>Invite</Label>
            <InviteeInput value={draft.invitees} onChange={invitees => patch({ invitees })} pool={pool} />
            <p className="text-xs text-muted-foreground">They get a Google Calendar invitation by email for each event.</p>
          </div>

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            {preset && (
              <Button type="button" variant="outline" size="lg" onClick={handleDelete} disabled={saving} aria-label="Delete preset" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button type="button" size="lg" className="flex-1" onClick={handleSave} disabled={!canSave}>
              {saving ? 'Saving…' : 'Save preset'}
            </Button>
          </div>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
