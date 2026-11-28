import { useRef, useState } from 'react'
import { AlertTriangle, Minus, Play, Plus, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Drawer, DrawerBody, DrawerContent, DrawerHeader, DrawerTitle } from '../../components/ui/drawer'
import { Input } from '../../components/ui/input'
import { Textarea } from '../../components/ui/textarea'
import { haptic } from '../../lib/haptics'
import { cn } from '../../utils'
import {
  MAX_BOTTLE_ML,
  MAX_NOTE_LENGTH,
  MAX_PUMP_ML,
  STOOL_COLORS,
  minutesAgo,
  toLocalInput,
  validateDraft,
  type BabyEvent,
  type DiaperKind,
  type EventDraft,
} from './babyEvents'
import {
  BOTTLE_STEP_ML,
  PUMP_STEP_ML,
  buildDraft,
  canHaveStool,
  clampMl,
  clampPumpMl,
  formType,
  initialForm,
  type FeedDefaults,
  type FormState,
  type FormTarget,
} from './eventForm'
import { EVENT_LABEL } from './eventStyle'
import Segmented from './Segmented'

export type DrawerTarget = FormTarget & { key: number }

type Props = {
  target: DrawerTarget | null
  defaults: FeedDefaults
  onClose: () => void
  /** Saves a new entry (existing is null) or changes one. Resolves to a message if it failed. */
  onSave: (draft: EventDraft, existing: BabyEvent | null) => Promise<string | null>
  onDelete: (event: BabyEvent) => void
}

const TITLES = {
  feed: 'Log a feed',
  diaper: 'Log a diaper',
  sleep: 'Log a past sleep',
  pump: 'Log pumping',
  note: 'Add a note',
} as const

const AGO_CHIPS = [
  { label: 'Now', minutes: 0 },
  { label: '5m ago', minutes: 5 },
  { label: '15m ago', minutes: 15 },
  { label: '30m ago', minutes: 30 },
  { label: '1h ago', minutes: 60 },
]

const DIAPERS: { kind: DiaperKind; emoji: string; label: string }[] = [
  { kind: 'wet', emoji: '💧', label: 'Wet' },
  { kind: 'dirty', emoji: '💩', label: 'Dirty' },
  { kind: 'both', emoji: '💧💩', label: 'Both' },
  { kind: 'dry', emoji: '✨', label: 'Dry' },
]

export default function EventDrawer({ target, defaults, onClose, onSave, onDelete }: Props) {
  // Keep showing the last target while the sheet slides away, instead of collapsing it.
  const last = useRef(target)
  if (target) last.current = target
  const shown = last.current

  return (
    <Drawer open={target !== null} onOpenChange={v => !v && onClose()}>
      <DrawerContent>
        {shown && <EventForm key={shown.key} target={shown} defaults={defaults} onClose={onClose} onSave={onSave} onDelete={onDelete} />}
      </DrawerContent>
    </Drawer>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="px-1 text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

type MlStepperProps = {
  /** Used in the button labels: "Less milk, 10 ml". */
  name: string
  inputLabel: string
  value: number
  step: number
  max: number
  onChange: (ml: number) => void
  clamp: (ml: number) => number
}

/** A − / amount / + row for millilitres, big enough to hit one-handed. */
function MlStepper({ name, inputLabel, value, step, max, onChange, clamp }: MlStepperProps) {
  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="icon" aria-label={`Less ${name}, ${step} ml`} className="h-12 w-12 shrink-0 rounded-xl" onClick={() => onChange(clamp(value - step))}>
        <Minus className="h-4 w-4" />
      </Button>
      <div className="relative flex-1">
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          aria-label={inputLabel}
          value={value || ''}
          placeholder="0"
          onChange={e => onChange(clamp(Number(e.target.value)))}
          className="h-12 pr-10 text-center text-xl font-semibold"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">ml</span>
      </div>
      <Button type="button" variant="outline" size="icon" aria-label={`More ${name}, ${step} ml`} className="h-12 w-12 shrink-0 rounded-xl" onClick={() => onChange(clamp(value + step))}>
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  )
}

function EventForm({ target, defaults, onClose, onSave, onDelete }: Omit<Props, 'target'> & { target: DrawerTarget }) {
  const type = formType(target)
  const editing = target.mode === 'edit' ? target.event : null
  const [form, setForm] = useState<FormState>(() => initialForm(target, defaults, Date.now()))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Changing anything clears the last complaint: it was about what the form said before.
  const patch = (p: Partial<FormState>) => {
    setError(null)
    setForm(f => ({ ...f, ...p }))
  }

  async function submit(startTimer = false) {
    if (busy) return
    const now = Date.now()
    const draft = buildDraft(form, target, now, startTimer)
    const problem = validateDraft(draft, now)
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    setError(null)
    const failure = await onSave(draft, editing)
    setBusy(false)
    if (failure) {
      setError(failure)
      return
    }
    haptic('success')
    onClose()
  }

  const title = editing ? `Edit ${EVENT_LABEL[type]}` : TITLES[target.mode === 'create' ? target.type : 'note']
  const isBreastCreate = !editing && type === 'feed' && form.method === 'breast'
  const showDuration = isBreastCreate || (!editing && type === 'pump')
  const showEnd = type === 'sleep' ? !editing?.in_progress : !!editing?.ended_at && !editing.in_progress
  const maxLocal = toLocalInput(new Date(Date.now() + 2 * 60_000))

  return (
    <>
      <DrawerHeader>
        <DrawerTitle>{title}</DrawerTitle>
      </DrawerHeader>
      <DrawerBody className="space-y-4">
        {type === 'feed' && (
          <>
            <Segmented
              label="Feed type"
              value={form.method}
              onChange={method => patch({ method })}
              options={[
                { value: 'breast', label: 'Breast' },
                { value: 'bottle', label: 'Bottle' },
                { value: 'solids', label: 'Solids' },
              ]}
            />
            {form.method === 'breast' && (
              <Field label="Side">
                <Segmented
                  label="Side"
                  value={form.side}
                  onChange={side => patch({ side })}
                  options={[
                    { value: 'left', label: 'Left' },
                    { value: 'right', label: 'Right' },
                    { value: 'both', label: 'Both' },
                  ]}
                />
              </Field>
            )}
            {form.method === 'bottle' && (
              <>
                <Field label="Amount">
                  <MlStepper
                    name="milk"
                    inputLabel="Amount in ml"
                    value={form.ml}
                    step={BOTTLE_STEP_ML}
                    max={MAX_BOTTLE_ML}
                    onChange={ml => patch({ ml })}
                    clamp={clampMl}
                  />
                </Field>
                <Segmented
                  label="What was in the bottle"
                  value={form.content}
                  onChange={content => patch({ content })}
                  options={[
                    { value: 'breast_milk', label: 'Breast milk' },
                    { value: 'formula', label: 'Formula' },
                  ]}
                />
              </>
            )}
            {form.method === 'solids' && (
              <Input aria-label="What they ate" placeholder="What did they eat?" maxLength={100} value={form.food} onChange={e => patch({ food: e.target.value })} />
            )}
            {isBreastCreate && (
              <>
                <Button type="button" disabled={busy} onClick={() => submit(true)} className="h-12 w-full rounded-xl text-base font-semibold">
                  <Play className="h-4 w-4" /> Start timer
                </Button>
                <p className="px-1 text-center text-xs text-muted-foreground">or log a feed that's already over</p>
              </>
            )}
          </>
        )}

        {type === 'pump' && (
          <>
            <Field label="Left">
              <MlStepper name="left" inputLabel="Left amount in ml" value={form.mlLeft} step={PUMP_STEP_ML} max={MAX_PUMP_ML} onChange={mlLeft => patch({ mlLeft })} clamp={clampPumpMl} />
            </Field>
            <Field label="Right">
              <MlStepper name="right" inputLabel="Right amount in ml" value={form.mlRight} step={PUMP_STEP_ML} max={MAX_PUMP_ML} onChange={mlRight => patch({ mlRight })} clamp={clampPumpMl} />
            </Field>
            <p className="px-1 text-sm text-muted-foreground" aria-live="polite">
              Total <span className="font-semibold text-foreground tabular-nums">{form.mlLeft + form.mlRight} ml</span>
            </p>
          </>
        )}

        {type === 'diaper' && (
          <>
            <div className="grid grid-cols-4 gap-2">
              {DIAPERS.map(d => (
                <button
                  key={d.kind}
                  type="button"
                  aria-pressed={form.kind === d.kind}
                  onClick={() => patch({ kind: d.kind })}
                  className={cn(
                    'flex h-20 flex-col items-center justify-center gap-1 rounded-2xl border text-sm font-medium transition-colors',
                    form.kind === d.kind ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-card text-muted-foreground',
                  )}
                >
                  <span className="text-xl leading-none">{d.emoji}</span>
                  {d.label}
                </button>
              ))}
            </div>
            {canHaveStool(form.kind) && (
              <Field label="Color (optional)">
                <div className="flex flex-wrap gap-2">
                  {STOOL_COLORS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      aria-pressed={form.stoolColor === c.value}
                      onClick={() => patch({ stoolColor: form.stoolColor === c.value ? null : c.value })}
                      className={cn(
                        'inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm',
                        form.stoolColor === c.value ? 'border-primary bg-primary/10 font-medium' : 'border-border text-muted-foreground',
                      )}
                    >
                      <span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ background: c.swatch }} />
                      {c.label}
                    </button>
                  ))}
                </div>
                {form.stoolColor === 'grey_white' && (
                  <p className="flex items-start gap-1.5 rounded-lg bg-amber-100 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Pale, grey or white stool: call your pediatrician.
                  </p>
                )}
              </Field>
            )}
          </>
        )}

        {type === 'note' && (
          <Textarea aria-label="Note" placeholder="What happened?" maxLength={MAX_NOTE_LENGTH} value={form.note} onChange={e => patch({ note: e.target.value })} className="min-h-[110px]" />
        )}

        {/* When */}
        {type !== 'note' && (
          <Field label={type === 'sleep' ? 'Fell asleep' : editing ? 'Started' : 'When'}>
            {!editing && type !== 'sleep' && (
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {AGO_CHIPS.map(c => (
                  <button
                    key={c.minutes}
                    type="button"
                    onClick={() => patch({ startedAt: toLocalInput(minutesAgo(c.minutes, Date.now())) })}
                    className={cn(
                      'min-h-9 whitespace-nowrap rounded-full border px-3 text-sm',
                      form.startedAt === toLocalInput(minutesAgo(c.minutes, Date.now())) ? 'border-primary bg-primary/10 font-medium' : 'border-border text-muted-foreground',
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
            <Input type="datetime-local" aria-label="Start time" max={maxLocal} value={form.startedAt} onChange={e => patch({ startedAt: e.target.value })} className="h-11" />
          </Field>
        )}

        {type !== 'note' && showEnd && (
          <Field label={type === 'sleep' ? 'Woke up' : 'Ended'}>
            <Input type="datetime-local" aria-label="End time" max={maxLocal} value={form.endedAt} onChange={e => patch({ endedAt: e.target.value })} className="h-11" />
          </Field>
        )}

        {showDuration && (
          <Field label="How long (minutes, optional)">
            <Input type="number" inputMode="numeric" min={0} max={180} aria-label="Minutes" placeholder="e.g. 12" value={form.durationMin} onChange={e => patch({ durationMin: e.target.value })} className="h-11" />
          </Field>
        )}

        {type !== 'note' && (
          <Input aria-label="Note" placeholder="Note (optional)" maxLength={MAX_NOTE_LENGTH} value={form.note} onChange={e => patch({ note: e.target.value })} />
        )}

        {editing?.in_progress && (
          <p className="px-1 text-xs text-muted-foreground">This timer is still running. Stop it from the log when it's over.</p>
        )}

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          {editing && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              aria-label="Delete entry"
              className="h-12 rounded-xl text-destructive"
              onClick={() => {
                haptic('warning')
                onDelete(editing)
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button type="button" disabled={busy} variant={isBreastCreate ? 'outline' : 'default'} onClick={() => submit(false)} className="h-12 flex-1 rounded-xl text-base font-semibold">
            {busy ? 'Saving…' : editing ? 'Save changes' : isBreastCreate ? 'Save finished feed' : 'Save'}
          </Button>
        </div>
      </DrawerBody>
    </>
  )
}
