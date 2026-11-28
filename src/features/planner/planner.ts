import { addDays, differenceInCalendarWeeks, format, startOfWeek } from 'date-fns'
import type { CalendarEvent, DayOverride, Friend, Invitee, WeekPreset } from '../../supabase'

// Weeks run Sunday to Saturday, so a weekday index is date-fns / Date#getDay: 0 = Sunday.
export const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

// ---------------------------------------------------------------- weeks

export function weekStartOf(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 0 })
}

// The weekend here is Fri/Sat, and that is when you plan the week ahead — so from Friday on the
// planner opens on the coming Sunday-to-Saturday week instead of the one that is nearly over.
export function defaultWeekStart(now: Date): Date {
  const start = weekStartOf(now)
  return now.getDay() >= 5 ? addDays(start, 7) : start
}

export type WeekDay = { date: string; dow: number; dayOfMonth: number }

export function weekDays(weekStart: Date): WeekDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i)
    return { date: format(d, 'yyyy-MM-dd'), dow: d.getDay(), dayOfMonth: d.getDate() }
  })
}

export function weekLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6)
  return weekStart.getMonth() === end.getMonth()
    ? `${format(weekStart, 'MMM d')} – ${format(end, 'd')}`
    : `${format(weekStart, 'MMM d')} – ${format(end, 'MMM d')}`
}

// "This week", "Next week", ... for the week starting at `weekStart`; empty when it's further away.
export function weekRelativeLabel(weekStart: Date, now: Date): string {
  switch (differenceInCalendarWeeks(weekStart, now, { weekStartsOn: 0 })) {
    case -1: return 'Last week'
    case 0: return 'This week'
    case 1: return 'Next week'
    default: return ''
  }
}

// ---------------------------------------------------------------- times

// Postgres `time` columns come back as HH:MM:SS; everything in the planner works in HH:MM.
export function hhmm(time: string): string {
  return time.slice(0, 5)
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function wallClockMs(date: string, time: string): number {
  return Date.parse(`${date}T${hhmm(time)}:00Z`)
}

// Wall-clock arithmetic (no timezone involved), same approach as the calendar sync.
export function addMinutes(date: string, time: string, minutes: number): { date: string; time: string } {
  const iso = new Date(wallClockMs(date, time) + minutes * 60_000).toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) }
}

export type Slot = { time: string; duration: number }

// What a preset does on a weekday: that day's override where there is one, else the default.
export function slotFor(preset: Pick<WeekPreset, 'default_time' | 'default_duration_minutes' | 'day_overrides'>, dow: number): Slot {
  const override = preset.day_overrides?.[String(dow)]
  return {
    time: override?.time ?? hhmm(preset.default_time),
    duration: override?.duration ?? preset.default_duration_minutes,
  }
}

// ---------------------------------------------------------------- the plan

export type Tweak = { time?: string; duration?: number }

export type PlannedEvent = {
  key: string
  presetId: string
  emoji: string
  title: string
  date: string
  dow: number
  time: string
  duration: number
  invitees: Invitee[]
}

export const planKey = (presetId: string, date: string) => `${presetId}|${date}`

export type PlanInput = {
  presets: WeekPreset[]
  days: WeekDay[]
  // Cells the user toggled by hand, by planKey. A cell with no entry follows the preset's usual days.
  picks: Record<string, boolean>
  // One-off time/duration changes for a single planned event.
  tweaks: Record<string, Tweak>
  // planKeys that are already on the calendar.
  scheduled: ReadonlySet<string>
  today: string
}

export type CellState = 'past' | 'scheduled' | 'selected' | 'idle'

export function cellState(preset: WeekPreset, day: WeekDay, input: Pick<PlanInput, 'picks' | 'scheduled' | 'today'>): CellState {
  const key = planKey(preset.id, day.date)
  if (day.date < input.today) return 'past'
  if (input.scheduled.has(key)) return 'scheduled'
  return (input.picks[key] ?? preset.days.includes(day.dow)) ? 'selected' : 'idle'
}

export function buildPlan(input: PlanInput): PlannedEvent[] {
  const planned: PlannedEvent[] = []
  for (const day of input.days) {
    for (const preset of input.presets) {
      if (cellState(preset, day, input) !== 'selected') continue
      const key = planKey(preset.id, day.date)
      const slot = slotFor(preset, day.dow)
      const tweak = input.tweaks[key]
      planned.push({
        key,
        presetId: preset.id,
        emoji: preset.emoji,
        title: preset.title,
        date: day.date,
        dow: day.dow,
        time: tweak?.time ?? slot.time,
        duration: tweak?.duration ?? slot.duration,
        invitees: preset.invitees,
      })
    }
  }
  return planned.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
}

// ---------------------------------------------------------------- what's already on the calendar

export type ExistingEvent = Pick<CalendarEvent, 'title' | 'event_date' | 'event_time' | 'event_end_date' | 'event_end_time'>

const normTitle = (title: string) => title.trim().toLowerCase()

// A preset counts as already scheduled on a day when an event with its title is already on that day
// (e.g. created by an earlier run of the planner), so running the planner twice can't double-book.
export function scheduledKeys(presets: Pick<WeekPreset, 'id' | 'title'>[], events: Pick<ExistingEvent, 'title' | 'event_date'>[]): Set<string> {
  const keys = new Set<string>()
  for (const event of events) {
    for (const preset of presets) {
      if (normTitle(preset.title) === normTitle(event.title)) keys.add(planKey(preset.id, event.event_date))
    }
  }
  return keys
}

type Span = { start: number; end: number; title: string }

function planSpan(e: PlannedEvent): Span {
  const start = wallClockMs(e.date, e.time)
  return { start, end: start + e.duration * 60_000, title: e.title }
}

// All-day events don't block a time slot; a timed one without an end is assumed to take an hour.
function existingSpan(e: ExistingEvent): Span | null {
  if (!e.event_time) return null
  const start = wallClockMs(e.event_date, e.event_time)
  const end = e.event_end_time ? wallClockMs(e.event_end_date ?? e.event_date, e.event_end_time) : start
  return { start, end: end > start ? end : start + 60 * 60_000, title: e.title }
}

// Titles of whatever each planned event overlaps — existing calendar events and the other planned ones.
export function findConflicts(plan: PlannedEvent[], existing: ExistingEvent[]): Record<string, string[]> {
  const busy = existing.map(existingSpan).filter((s): s is Span => s !== null)
  const result: Record<string, string[]> = {}
  for (const event of plan) {
    const span = planSpan(event)
    const others = [...busy, ...plan.filter(p => p.key !== event.key).map(planSpan)]
    const clashes = others.filter(o => o.start < span.end && span.start < o.end).map(o => o.title)
    if (clashes.length > 0) result[event.key] = clashes
  }
  return result
}

// ---------------------------------------------------------------- invitees

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_RE.test(value)
}

export function inviteeLabel(invitee: Invitee): string {
  return invitee.name?.trim() || invitee.email
}

// Everyone worth suggesting for @-autocomplete: friends with an email, people from upcoming calendar
// events, and anyone already invited by a preset. De-duplicated by email; the first name seen wins.
export function buildInviteePool(opts: {
  friends: Pick<Friend, 'name' | 'email'>[]
  events: Pick<CalendarEvent, 'attendees'>[]
  presets: Pick<WeekPreset, 'invitees'>[]
  selfEmail?: string | null
}): Invitee[] {
  const self = opts.selfEmail?.trim().toLowerCase()
  const byEmail = new Map<string, Invitee>()
  function add(email: string | null | undefined, name: string | null | undefined) {
    const key = email?.trim().toLowerCase()
    if (!key || key === self || !isValidEmail(key)) return
    const known = byEmail.get(key)
    if (known) {
      if (!known.name && name?.trim()) known.name = name.trim()
      return
    }
    byEmail.set(key, { email: key, name: name?.trim() || null })
  }

  for (const f of opts.friends) add(f.email, f.name)
  for (const e of opts.events) for (const a of e.attendees ?? []) if (!a.self) add(a.email, a.name)
  for (const p of opts.presets) for (const i of p.invitees) add(i.email, i.name)

  return [...byEmail.values()].sort((a, b) => inviteeLabel(a).localeCompare(inviteeLabel(b), undefined, { sensitivity: 'base' }))
}

// Matches on the start of the email or of any word in the name first, then anywhere in either.
export function suggestInvitees(pool: Invitee[], query: string, exclude: Iterable<string> = [], limit = 6): Invitee[] {
  const q = query.trim().toLowerCase()
  const taken = new Set([...exclude].map(e => e.toLowerCase()))
  const ranked: { invitee: Invitee; rank: number }[] = []
  for (const invitee of pool) {
    if (taken.has(invitee.email.toLowerCase())) continue
    if (!q) {
      ranked.push({ invitee, rank: 0 })
      continue
    }
    const name = (invitee.name ?? '').toLowerCase()
    const email = invitee.email.toLowerCase()
    if (email.startsWith(q) || name.split(/\s+/).some(w => w.startsWith(q))) ranked.push({ invitee, rank: 0 })
    else if (email.includes(q) || name.includes(q)) ranked.push({ invitee, rank: 1 })
  }
  return ranked.sort((a, b) => a.rank - b.rank).slice(0, limit).map(r => r.invitee)
}

// ---------------------------------------------------------------- preset editing

export type PresetDraft = {
  emoji: string
  title: string
  time: string
  duration: number
  days: number[]
  overrides: Record<string, DayOverride>
  invitees: Invitee[]
}

export const EMOJI_CHOICES = ['🧗', '🍷', '🍽️', '🎬', '🏃', '🏋️', '☕', '🎲', '🎸', '🧘', '🏖️', '📞', '📅']

export const DURATION_OPTIONS = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300, 360, 480, 720]

// The standard choices plus any odd value already in use, so an existing duration is never silently replaced.
export function durationOptions(extra: number[] = []): number[] {
  return [...new Set([...DURATION_OPTIONS, ...extra])].sort((a, b) => a - b)
}

export function emptyDraft(): PresetDraft {
  return { emoji: '📅', title: '', time: '18:00', duration: 60, days: [], overrides: {}, invitees: [] }
}

export function draftFromPreset(p: WeekPreset): PresetDraft {
  return {
    emoji: p.emoji,
    title: p.title,
    time: hhmm(p.default_time),
    duration: p.default_duration_minutes,
    days: [...p.days],
    overrides: Object.fromEntries(Object.entries(p.day_overrides ?? {}).map(([dow, o]) => [dow, { ...o }])),
    invitees: p.invitees.map(i => ({ ...i })),
  }
}

// Offered to someone with no presets yet; each opens the editor pre-filled. The climbing title is the
// Hebrew word the calendar sync looks for (see isClimbingSessionTitle), which is what makes events
// made from it feed the climbing widget and the "Log a climb" task.
export const STARTER_DRAFTS: { label: string; draft: PresetDraft }[] = [
  { label: 'Climbing', draft: { ...emptyDraft(), emoji: '🧗', title: 'טיפוס', time: '18:00', duration: 90 } },
  { label: 'Date night', draft: { ...emptyDraft(), emoji: '🍷', title: 'Date night', time: '20:00', duration: 180 } },
]

// The row to store. An override that only repeats the default is dropped, so changing the
// default later still moves that day with it.
export function presetRow(draft: PresetDraft) {
  const overrides: Record<string, DayOverride> = {}
  for (const [dow, o] of Object.entries(draft.overrides)) {
    const kept: DayOverride = {}
    if (o.time && o.time !== draft.time) kept.time = o.time
    if (o.duration && o.duration !== draft.duration) kept.duration = o.duration
    if (Object.keys(kept).length > 0) overrides[dow] = kept
  }
  return {
    emoji: draft.emoji,
    title: draft.title.trim(),
    default_time: draft.time,
    default_duration_minutes: draft.duration,
    days: [...new Set(draft.days)].sort((a, b) => a - b),
    day_overrides: overrides,
    invitees: draft.invitees.map(i => ({ email: i.email.trim().toLowerCase(), name: i.name?.trim() || null })),
  }
}

// ---------------------------------------------------------------- creating the events

export type CreateFailure = { event: PlannedEvent; reason: string }

export type CreateOutcome =
  | { kind: 'done'; created: PlannedEvent[]; failed: CreateFailure[] }
  // Google refused: the stored login predates the permission to create events.
  | { kind: 'needs-scope' }
  | { kind: 'error'; message: string }

// The body of POST /api/google-calendar-events.
export function toRequestBody(plan: PlannedEvent[]) {
  return {
    events: plan.map(e => ({
      title: e.title,
      date: e.date,
      startTime: e.time,
      durationMinutes: e.duration,
      attendees: e.invitees.map(i => i.email),
    })),
  }
}

const FAILURE_REASONS: Record<string, string> = {
  RATE_LIMITED: 'Google is limiting requests, try again in a minute',
  UPSTREAM_ERROR: 'Google could not create it',
}

// Turns the endpoint's answer for `plan` into what the UI needs: which events were created, which
// weren't and why, or that the user has to grant calendar access again.
export function interpretResponse(plan: PlannedEvent[], status: number, body: unknown): CreateOutcome {
  const { error, results } = (body ?? {}) as { error?: string; results?: unknown }

  if (status === 403 && error === 'INSUFFICIENT_SCOPE') return { kind: 'needs-scope' }
  if (status === 401) return { kind: 'error', message: 'Your session expired. Sign in again.' }
  if (status === 404 && error === 'NOT_CONNECTED') return { kind: 'error', message: 'Google Calendar is not connected.' }
  if (status === 502 && error === 'REFRESH_FAILED') return { kind: 'error', message: 'Google no longer accepts your saved login. Reconnect Google and try again.' }
  if (status < 200 || status >= 300 || !Array.isArray(results)) return { kind: 'error', message: `Could not create the events (${error ?? status}).` }

  const created: PlannedEvent[] = []
  const failed: CreateFailure[] = []
  plan.forEach((event, index) => {
    const result = (results as { index?: number; ok?: boolean; error?: string }[]).find(r => r.index === index)
    if (result?.ok) created.push(event)
    else failed.push({ event, reason: FAILURE_REASONS[result?.error ?? ''] ?? 'Google did not confirm it' })
  })
  return { kind: 'done', created, failed }
}

// How many different people were emailed an invitation by these events.
export function countInvited(events: PlannedEvent[]): number {
  return new Set(events.flatMap(e => e.invitees.map(i => i.email.toLowerCase()))).size
}
