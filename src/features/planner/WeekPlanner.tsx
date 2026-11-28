import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarPlus, Check, ChevronLeft, ChevronRight, Link2, Pencil, Plus, RotateCcw, Users, X } from 'lucide-react'
import { addDays, format, parseISO } from 'date-fns'
import { supabase } from '../../supabase'
import type { CalendarEvent, WeekPreset } from '../../supabase'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { haptic } from '../../lib/haptics'
import { connectGoogle, isGoogleConnected } from '../../lib/googleAuth'
import { refreshGoogleCalendarEvents } from '../calendar/googleCalendar'
import { cn, today } from '../../utils'
import PresetEditor from './PresetEditor'
import {
  DOW_LABELS, STARTER_DRAFTS, addMinutes, buildInviteePool, buildPlan, cellState, countInvited, defaultWeekStart,
  durationOptions, findConflicts, formatDuration, inviteeLabel, planKey, scheduledKeys, slotFor, weekDays, weekLabel,
  weekRelativeLabel, type CellState, type CreateFailure, type ExistingEvent, type PlannedEvent, type PresetDraft, type Tweak, type WeekDay,
} from './planner'
import { createCalendarEvents, loadEventsBetween, loadFriendContacts, loadPresets, loadUpcomingAttendees } from './presets'

type Notice =
  | { kind: 'done'; created: PlannedEvent[]; failed: CreateFailure[] }
  | { kind: 'scope' }
  | { kind: 'error'; message: string }

type WeekEvent = ExistingEvent & { id: string }

const CELL_STYLES: Record<CellState, string> = {
  idle: 'border-border bg-background text-muted-foreground hover:bg-accent',
  selected: 'border-primary bg-primary text-primary-foreground shadow-sm',
  scheduled: 'border-transparent bg-green-500/10 text-green-700 dark:text-green-400',
  past: 'border-transparent bg-muted/40 text-muted-foreground/40',
}

function Spinner() {
  return <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
}

function omit<T>(record: Record<string, T>, keys: string[]): Record<string, T> {
  const copy = { ...record }
  for (const key of keys) delete copy[key]
  return copy
}

export default function WeekPlanner() {
  const [weekStart, setWeekStart] = useState(() => defaultWeekStart(new Date()))
  const [presets, setPresets] = useState<WeekPreset[]>([])
  const [events, setEvents] = useState<WeekEvent[]>([])
  const [friends, setFriends] = useState<{ name: string; email: string | null }[]>([])
  const [attendees, setAttendees] = useState<Pick<CalendarEvent, 'attendees'>[]>([])
  const [selfEmail, setSelfEmail] = useState<string | null>(null)
  const [connected, setConnected] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  // What the user has done to this week's plan. Both are keyed by preset + date.
  const [picks, setPicks] = useState<Record<string, boolean>>({})
  const [tweaks, setTweaks] = useState<Record<string, Tweak>>({})
  const [justCreated, setJustCreated] = useState<ReadonlySet<string>>(new Set())
  const [expanded, setExpanded] = useState<string | null>(null)

  const [editor, setEditor] = useState<{ preset: WeekPreset | null; initial?: PresetDraft } | null>(null)
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  const days = useMemo(() => weekDays(weekStart), [weekStart])
  const todayStr = today()

  // The events cache is synced from Google; reading it is cheap, so a week change just re-reads it.
  const loadWeekEvents = useCallback(async (start: Date) => {
    const found = await loadEventsBetween(format(start, 'yyyy-MM-dd'), format(addDays(start, 6), 'yyyy-MM-dd'))
    setEvents(found)
  }, [])

  const loadAll = useCallback(async () => {
    setLoadError(false)
    try {
      const [p, f, a, ok, session] = await Promise.all([
        loadPresets(), loadFriendContacts(), loadUpcomingAttendees(today()), isGoogleConnected(), supabase.auth.getSession(),
      ])
      setPresets(p)
      setFriends(f)
      setAttendees(a)
      setConnected(ok)
      setSelfEmail(session.data.session?.user.email ?? null)
    } catch (e) {
      console.error('Could not load the week planner', e)
      setLoadError(true)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  useEffect(() => {
    let current = true
    loadEventsBetween(format(weekStart, 'yyyy-MM-dd'), format(addDays(weekStart, 6), 'yyyy-MM-dd'))
      .then(found => { if (current) setEvents(found) })
      .catch(e => console.error('Could not load this week’s events', e))
    return () => { current = false }
  }, [weekStart])

  // Once, on opening: pull the latest from Google so conflicts and "already added" are current.
  useEffect(() => {
    refreshGoogleCalendarEvents().then(() => loadWeekEvents(weekStart)).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scheduled = useMemo(() => {
    const keys = scheduledKeys(presets, events)
    justCreated.forEach(k => keys.add(k))
    return keys
  }, [presets, events, justCreated])

  const plan = useMemo(
    () => buildPlan({ presets, days, picks, tweaks, scheduled, today: todayStr }),
    [presets, days, picks, tweaks, scheduled, todayStr],
  )
  const planByKey = useMemo(() => new Map(plan.map(e => [e.key, e])), [plan])
  const conflicts = useMemo(() => findConflicts(plan, events), [plan, events])
  const pool = useMemo(() => buildInviteePool({ friends, events: attendees, presets, selfEmail }), [friends, attendees, presets, selfEmail])
  const invited = countInvited(plan)

  function shiftWeek(delta: number) {
    haptic('selection')
    setNotice(null)
    setExpanded(null)
    setWeekStart(w => addDays(w, delta * 7))
  }

  function toggle(preset: WeekPreset, day: WeekDay) {
    const state = cellState(preset, day, { picks, scheduled, today: todayStr })
    if (state === 'past' || state === 'scheduled') return
    haptic('selection')
    setNotice(null)
    const key = planKey(preset.id, day.date)
    const turnOn = state === 'idle'
    setPicks(p => ({ ...p, [key]: turnOn }))
    if (!turnOn) {
      setTweaks(t => omit(t, [key]))
      setExpanded(x => (x === key ? null : x))
    }
  }

  function tweak(key: string, changes: Tweak) {
    setTweaks(t => ({ ...t, [key]: { ...t[key], ...changes } }))
  }

  function resetTweak(key: string) {
    setTweaks(t => omit(t, [key]))
  }

  async function handleCreate() {
    if (plan.length === 0 || creating) return
    setCreating(true)
    setNotice(null)
    const outcome = await createCalendarEvents(plan)
    setCreating(false)

    if (outcome.kind === 'needs-scope') {
      setNotice({ kind: 'scope' })
      return
    }
    if (outcome.kind === 'error') {
      setNotice({ kind: 'error', message: outcome.message })
      return
    }

    const keys = outcome.created.map(e => e.key)
    if (keys.length > 0) {
      haptic('success')
      setJustCreated(prev => new Set([...prev, ...keys]))
      setPicks(p => omit(p, keys))
      setTweaks(t => omit(t, keys))
      setExpanded(null)
      // Bring the new events into the app's cache; "already added" no longer depends on it.
      refreshGoogleCalendarEvents().then(() => loadWeekEvents(weekStart)).catch(() => {})
    } else {
      haptic('warning')
    }
    setNotice({ kind: 'done', created: outcome.created, failed: outcome.failed })
  }

  function openEditor(preset: WeekPreset | null, initial?: PresetDraft) {
    setEditor({ preset, initial })
  }

  async function handleEditorSaved() {
    setEditor(null)
    try {
      setPresets(await loadPresets())
    } catch (e) {
      console.error('Could not reload presets', e)
    }
  }

  const relative = weekRelativeLabel(weekStart, new Date())
  const nextPosition = presets.reduce((max, p) => Math.max(max, p.position), -1) + 1

  return (
    <div className="mx-auto max-w-2xl p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Week planner</h1>
        <p className="text-sm text-muted-foreground">Tap days to add your usual events to Google Calendar</p>
      </div>

      {!loading && !connected && (
        <button
          onClick={connectGoogle}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border p-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
        >
          <Link2 className="h-4 w-4" />
          Connect Google Calendar
        </button>
      )}

      {notice?.kind === 'scope' && (
        <div role="alert" className="mb-4 space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p className="font-medium">Google Calendar needs your permission to add events</p>
          <p className="text-muted-foreground">
            The app can only read your calendar so far. You'll go to Google once to allow adding events, then come straight back.
          </p>
          <Button size="sm" onClick={() => connectGoogle()}>Allow access</Button>
        </div>
      )}

      {notice?.kind === 'error' && (
        <div role="alert" className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {notice.message}
        </div>
      )}

      {notice?.kind === 'done' && <DoneNotice notice={notice} />}

      {loading ? (
        <Spinner />
      ) : loadError ? (
        <div className="rounded-2xl border border-border p-6 text-center">
          <p className="font-medium">Couldn't load the planner</p>
          <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
          <Button variant="outline" className="mt-4" onClick={() => { setLoading(true); loadAll() }}>Retry</Button>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <Button variant="ghost" size="icon" aria-label="Previous week" onClick={() => shiftWeek(-1)}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="text-center">
              <div className="font-semibold" data-testid="week-label">{weekLabel(weekStart)}</div>
              <div className="h-4 text-xs text-muted-foreground">{relative}</div>
            </div>
            <Button variant="ghost" size="icon" aria-label="Next week" onClick={() => shiftWeek(1)}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {presets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center">
              <CalendarPlus className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 font-medium">Make your first preset</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                A preset is an event you create often: its title, time, length and who to invite. Once you have some, planning a week is a few taps.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {STARTER_DRAFTS.map(starter => (
                  <Button key={starter.label} variant="outline" onClick={() => openEditor(null, starter.draft)}>
                    <span aria-hidden>{starter.draft.emoji}</span> {starter.label}
                  </Button>
                ))}
                <Button onClick={() => openEditor(null)}><Plus className="h-4 w-4" /> Custom</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-border bg-card">
                <div className="grid grid-cols-7 border-b border-border">
                  {days.map(day => {
                    const count = events.filter(e => e.event_date === day.date).length
                    const isToday = day.date === todayStr
                    return (
                      <div key={day.date} className={cn('py-2 text-center', day.date < todayStr && 'opacity-50')}>
                        <div className={cn('text-[11px] font-medium uppercase tracking-wide', isToday ? 'text-primary' : 'text-muted-foreground')}>
                          {DOW_LABELS[day.dow]}
                        </div>
                        <div className={cn('mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-base font-semibold leading-none', isToday && 'bg-primary text-primary-foreground')}>
                          {day.dayOfMonth}
                        </div>
                        <div
                          className="mt-1 flex h-1.5 items-center justify-center gap-0.5"
                          title={count > 0 ? `${count} event${count === 1 ? '' : 's'} already` : undefined}
                          aria-label={count > 0 ? `${count} events already on ${format(parseISO(day.date), 'EEEE')}` : undefined}
                        >
                          {Array.from({ length: Math.min(count, 4) }, (_, i) => <span key={i} className="h-1 w-1 rounded-full bg-muted-foreground/50" />)}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {presets.map(preset => (
                  <div key={preset.id} className="border-b border-border p-2 last:border-b-0">
                    <div className="flex items-center gap-2 px-1 pb-1.5">
                      <span aria-hidden>{preset.emoji}</span>
                      {/* content-width, not flex-1: a right-to-left (Hebrew) title would otherwise sit at the far edge, away from its emoji */}
                      <span dir="auto" className="min-w-0 truncate font-medium">{preset.title}</span>
                      <span className="flex-1" />
                      {preset.invitees.length > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground" title={preset.invitees.map(inviteeLabel).join(', ')}>
                          <Users className="h-3 w-3" />{preset.invitees.length}
                        </span>
                      )}
                      <button
                        onClick={() => openEditor(preset)}
                        aria-label={`Edit ${preset.title}`}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {days.map(day => {
                        const key = planKey(preset.id, day.date)
                        const state = cellState(preset, day, { picks, scheduled, today: todayStr })
                        const time = planByKey.get(key)?.time ?? slotFor(preset, day.dow).time
                        const disabled = state === 'past' || state === 'scheduled'
                        return (
                          <button
                            key={day.date}
                            type="button"
                            disabled={disabled}
                            aria-pressed={disabled ? undefined : state === 'selected'}
                            aria-label={`${preset.title}, ${format(parseISO(day.date), 'EEEE MMMM d')}, ${time}${state === 'scheduled' ? ', already on your calendar' : ''}`}
                            data-state={state}
                            onClick={() => toggle(preset, day)}
                            className={cn(
                              'flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border text-[11px] font-medium tabular-nums transition-colors active:scale-95',
                              CELL_STYLES[state],
                              disabled && 'cursor-default active:scale-100',
                            )}
                          >
                            {state === 'selected' || state === 'scheduled'
                              ? <Check className="h-3.5 w-3.5" strokeWidth={3} />
                              : <Plus className={cn('h-3.5 w-3.5', state === 'idle' ? 'opacity-40' : 'opacity-0')} />}
                            {time}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => openEditor(null)}
                className="mt-3 flex h-10 items-center gap-1.5 rounded-full border border-dashed border-input px-4 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
                New preset
              </button>

              <section className="mt-6" aria-label="Events to create">
                <h2 className="mb-2 flex items-baseline justify-between px-1 text-sm font-semibold">
                  <span>{plan.length === 0 ? 'Nothing picked yet' : `${plan.length} event${plan.length === 1 ? '' : 's'} to add`}</span>
                  {invited > 0 && <span className="text-xs font-normal text-muted-foreground">{invited} {invited === 1 ? 'person' : 'people'} will be invited</span>}
                </h2>
                {plan.length === 0 ? (
                  <p className="px-1 text-sm text-muted-foreground">Tap a day above to add an event. Tap a time here to change it for one event.</p>
                ) : (
                  <ul className="space-y-2">
                    {plan.map(event => (
                      <PlanRow
                        key={event.key}
                        event={event}
                        conflicts={conflicts[event.key]}
                        tweaked={event.key in tweaks}
                        open={expanded === event.key}
                        onOpen={() => setExpanded(x => (x === event.key ? null : event.key))}
                        onTweak={changes => tweak(event.key, changes)}
                        onReset={() => resetTweak(event.key)}
                        onRemove={() => {
                          const preset = presets.find(p => p.id === event.presetId)
                          const day = days.find(d => d.date === event.date)
                          if (preset && day) toggle(preset, day)
                        }}
                      />
                    ))}
                  </ul>
                )}
              </section>

              <div className="sticky bottom-[calc(var(--tabbar-height,0px)+1rem)] z-30 mt-5">
                <Button size="lg" className="w-full shadow-lg" disabled={plan.length === 0 || creating} onClick={handleCreate}>
                  {creating
                    ? 'Adding to Google Calendar…'
                    : plan.length === 0
                      ? 'Pick days to plan'
                      : `Create ${plan.length} event${plan.length === 1 ? '' : 's'}${invited > 0 ? ` · ${invited} invited` : ''}`}
                </Button>
              </div>
            </>
          )}
        </>
      )}

      {editor && (
        <PresetEditor
          key={editor.preset?.id ?? 'new'}
          preset={editor.preset}
          initial={editor.initial}
          pool={pool}
          nextPosition={nextPosition}
          onClose={() => setEditor(null)}
          onSaved={handleEditorSaved}
        />
      )}
    </div>
  )
}

function DoneNotice({ notice }: { notice: Extract<Notice, { kind: 'done' }> }) {
  const { created, failed } = notice
  const invited = countInvited(created)
  if (created.length === 0 && failed.length === 0) return null
  return (
    <div
      role="status"
      className={cn(
        'mb-4 space-y-1.5 rounded-xl border p-3 text-sm',
        failed.length === 0 ? 'border-green-500/40 bg-green-500/10' : 'border-amber-500/40 bg-amber-500/10',
      )}
    >
      {created.length > 0 && (
        <p className="font-medium">
          {failed.length === 0 ? '✓ ' : ''}Added {created.length} {created.length === 1 ? 'event' : 'events'} to Google Calendar
          {invited > 0 && ` · invitations sent to ${invited} ${invited === 1 ? 'person' : 'people'}`}
        </p>
      )}
      {failed.length > 0 && (
        <>
          <p className="font-medium">{failed.length} {failed.length === 1 ? 'event' : 'events'} could not be added. They're still selected, so you can try again.</p>
          <ul className="space-y-0.5 text-muted-foreground">
            {failed.map(f => (
              <li key={f.event.key}>
                {format(parseISO(f.event.date), 'EEE MMM d')} · {f.event.title}: {f.reason}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function PlanRow({ event, conflicts, tweaked, open, onOpen, onTweak, onReset, onRemove }: {
  event: PlannedEvent
  conflicts: string[] | undefined
  tweaked: boolean
  open: boolean
  onOpen: () => void
  onTweak: (changes: Tweak) => void
  onReset: () => void
  onRemove: () => void
}) {
  const end = addMinutes(event.date, event.time, event.duration)
  const endLabel = end.date === event.date ? end.time : `${end.time} +1`
  const date = parseISO(event.date)
  return (
    <li className="rounded-xl border border-border bg-card" data-testid="plan-row">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="w-10 shrink-0 text-center leading-tight">
          <div className="text-[11px] font-medium uppercase text-muted-foreground">{format(date, 'EEE')}</div>
          <div className="text-base font-semibold">{format(date, 'd')}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span aria-hidden>{event.emoji}</span>
            <span dir="auto" className="truncate font-medium">{event.title}</span>
          </div>
          {event.invitees.length > 0 && (
            <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              <Users className="h-3 w-3 shrink-0" />
              <span dir="auto" className="truncate">{event.invitees.map(inviteeLabel).join(', ')}</span>
            </div>
          )}
          {conflicts && (
            <div className="mt-0.5 flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span dir="auto">Overlaps {conflicts.join(', ')}</span>
            </div>
          )}
        </div>
        <button
          onClick={onOpen}
          aria-expanded={open}
          aria-label={`Change time for ${event.title} on ${format(date, 'EEEE')}`}
          className={cn('shrink-0 rounded-lg px-2 py-1.5 text-sm tabular-nums transition-colors hover:bg-accent', tweaked && 'font-semibold text-primary', open && 'bg-accent')}
        >
          {event.time}–{endLabel}
        </button>
        <button
          onClick={onRemove}
          aria-label={`Remove ${event.title} on ${format(date, 'EEEE')}`}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {open && (
        <div className="flex items-center gap-2 border-t border-border px-3 py-2">
          <Input
            type="time"
            aria-label="Start time"
            value={event.time}
            onChange={e => e.target.value && onTweak({ time: e.target.value })}
            className="h-9 min-w-0 flex-1"
          />
          <select
            aria-label="Duration"
            value={event.duration}
            onChange={e => onTweak({ duration: Number(e.target.value) })}
            className="h-9 w-24 shrink-0 rounded-lg border border-input bg-background px-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
          >
            {durationOptions([event.duration]).map(m => <option key={m} value={m}>{formatDuration(m)}</option>)}
          </select>
          <button
            onClick={onReset}
            aria-label="Back to the preset's time"
            title="Back to the preset's time"
            className={cn('shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-accent', !tweaked && 'invisible')}
            tabIndex={tweaked ? 0 : -1}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      )}
    </li>
  )
}
