// Pure logic for the baby tracker (no React, no Supabase), so it can be unit-tested.
import {
  addDays,
  differenceInCalendarDays,
  differenceInMonths,
  format,
  isToday,
  isYesterday,
  parseISO,
  startOfDay,
} from 'date-fns'

export type BabyEventType = 'feed' | 'diaper' | 'sleep' | 'pump' | 'temperature' | 'medication' | 'growth' | 'note'
export type FeedMethod = 'breast' | 'bottle' | 'solids'
export type BreastSide = 'left' | 'right' | 'both'
export type MilkContent = 'breast_milk' | 'formula'
export type DiaperKind = 'wet' | 'dirty' | 'both' | 'dry'
export type StoolColor = 'black' | 'green' | 'yellow' | 'brown' | 'orange' | 'red' | 'grey_white'
export type BabyRole = 'parent' | 'viewer'

export type Baby = {
  id: string
  name: string
  birth_date: string | null
  sex: 'female' | 'male' | null
}

export type BabyMember = {
  baby_id: string
  user_id: string
  role: BabyRole
  display_name: string
  created_at: string
  removed_at: string | null
}

export type BabyInvite = {
  id: string
  baby_id: string
  token: string
  role: BabyRole
  invited_email: string | null
  expires_at: string
  accepted_at: string | null
  revoked_at: string | null
  created_at: string
}

export type BabyEvent = {
  id: string
  baby_id: string
  type: BabyEventType
  started_at: string
  ended_at: string | null
  in_progress: boolean
  details: Record<string, unknown>
  note: string | null
  logged_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

/** What the app sends when it saves an entry; everything else is filled in by the database. */
export type EventDraft = {
  type: BabyEventType
  started_at: string
  ended_at: string | null
  in_progress: boolean
  details: Record<string, unknown>
  note: string | null
}

export const MAX_BOTTLE_ML = 600
/** The most one side can give in one session; the database accepts the same. */
export const MAX_PUMP_ML = 1000
export const MAX_NOTE_LENGTH = 500

export const STOOL_COLORS: { value: StoolColor; label: string; swatch: string }[] = [
  { value: 'yellow', label: 'Yellow', swatch: '#eab308' },
  { value: 'brown', label: 'Brown', swatch: '#92400e' },
  { value: 'green', label: 'Green', swatch: '#16a34a' },
  { value: 'orange', label: 'Orange', swatch: '#f97316' },
  { value: 'black', label: 'Black / tarry', swatch: '#1f2937' },
  { value: 'red', label: 'Red', swatch: '#dc2626' },
  { value: 'grey_white', label: 'Grey / white', swatch: '#d1d5db' },
]

export function stoolColorLabel(color: unknown): string | null {
  return STOOL_COLORS.find(c => c.value === color)?.label ?? null
}

// --- Reading an entry ---------------------------------------------------------------------

export const startMs = (e: BabyEvent) => new Date(e.started_at).getTime()

export function newestFirst(events: BabyEvent[]): BabyEvent[] {
  return [...events].sort((a, b) => startMs(b) - startMs(a) || (a.id < b.id ? -1 : 1))
}

export function feedMethod(e: BabyEvent): FeedMethod | null {
  const m = e.details.method
  return m === 'breast' || m === 'bottle' || m === 'solids' ? m : null
}

export function diaperKind(e: BabyEvent): DiaperKind | null {
  const k = e.details.kind
  return k === 'wet' || k === 'dirty' || k === 'both' || k === 'dry' ? k : null
}

function detailNumber(e: BabyEvent, key: string): number | null {
  const v = e.details[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** What a pumping session gave from each side, in ml; null for a side that wasn't recorded. */
export function pumpAmounts(e: BabyEvent): { left: number | null; right: number | null } {
  return { left: detailNumber(e, 'ml_left'), right: detailNumber(e, 'ml_right') }
}

/** How long an entry lasted. A running timer counts up to `now`; a point-in-time entry is 0. */
export function durationMs(e: BabyEvent, now: number): number {
  const end = e.in_progress ? now : e.ended_at ? new Date(e.ended_at).getTime() : startMs(e)
  return Math.max(0, end - startMs(e))
}

/** "<1m", "45m", "1h 20m", "2d 3h". */
export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return '<1m'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return minutes % 60 ? `${hours}h ${minutes % 60}m` : `${hours}h`
  const days = Math.floor(hours / 24)
  return hours % 24 ? `${days}d ${hours % 24}h` : `${days}d`
}

/** "just now" or "1h 20m ago". */
export function formatSince(ms: number): string {
  return ms < 60_000 ? 'just now' : `${formatDuration(ms)} ago`
}

export function latestOf(events: BabyEvent[], match: (e: BabyEvent) => boolean): BabyEvent | null {
  let best: BabyEvent | null = null
  for (const e of events) {
    if (e.deleted_at || !match(e)) continue
    if (!best || startMs(e) > startMs(best)) best = e
  }
  return best
}

/** The running timer of a kind, if any. The database allows at most one per baby. */
export function runningTimer(events: BabyEvent[], type: BabyEventType): BabyEvent | null {
  return events.find(e => e.in_progress && !e.deleted_at && e.type === type) ?? null
}

// --- Days ---------------------------------------------------------------------------------

export type DayGroup = { key: string; date: Date; events: BabyEvent[] }

/** Entries grouped by local calendar day, newest day first and newest entry first within it. */
export function groupByDay(events: BabyEvent[]): DayGroup[] {
  const groups = new Map<string, DayGroup>()
  for (const e of newestFirst(events)) {
    const date = startOfDay(new Date(e.started_at))
    const key = format(date, 'yyyy-MM-dd')
    const group = groups.get(key) ?? { key, date, events: [] }
    group.events.push(e)
    groups.set(key, group)
  }
  return [...groups.values()].sort((a, b) => (a.key < b.key ? 1 : -1))
}

export function dayLabel(date: Date): string {
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'EEE, MMM d')
}

export type DaySummary = {
  feeds: number
  bottleMl: number
  wet: number
  dirty: number
  sleepMs: number
  /** Pumping sessions, and what they gave in total and from each side. */
  pumps: number
  pumpedMl: number
  pumpedLeftMl: number
  pumpedRightMl: number
}

/** Totals for the local day starting at `dayStart`. A sleep that crosses midnight counts in both days. */
export function daySummary(events: BabyEvent[], dayStart: Date, now: number): DaySummary {
  const from = dayStart.getTime()
  const to = addDays(dayStart, 1).getTime()
  const summary: DaySummary = { feeds: 0, bottleMl: 0, wet: 0, dirty: 0, sleepMs: 0, pumps: 0, pumpedMl: 0, pumpedLeftMl: 0, pumpedRightMl: 0 }

  for (const e of events) {
    if (e.deleted_at) continue
    const start = startMs(e)
    const inDay = start >= from && start < to

    if (e.type === 'sleep') {
      const end = e.in_progress ? now : e.ended_at ? new Date(e.ended_at).getTime() : start
      summary.sleepMs += Math.max(0, Math.min(end, to) - Math.max(start, from))
    } else if (e.type === 'feed' && inDay) {
      summary.feeds++
      if (feedMethod(e) === 'bottle') summary.bottleMl += detailNumber(e, 'ml') ?? 0
    } else if (e.type === 'diaper' && inDay) {
      const kind = diaperKind(e)
      if (kind === 'wet' || kind === 'both') summary.wet++
      if (kind === 'dirty' || kind === 'both') summary.dirty++
    } else if (e.type === 'pump' && inDay) {
      const { left, right } = pumpAmounts(e)
      summary.pumps++
      summary.pumpedLeftMl += left ?? 0
      summary.pumpedRightMl += right ?? 0
      summary.pumpedMl += (left ?? 0) + (right ?? 0)
    }
  }
  return summary
}

// --- The baby -----------------------------------------------------------------------------

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** "5 days old", "3 weeks old", "4 months old"; a date still ahead reads as "Expected in 6 days". */
export function ageLabel(birthDate: string | null, now: Date): string | null {
  if (!birthDate) return null
  const birth = parseISO(birthDate)
  const days = differenceInCalendarDays(now, birth)
  if (days < 0) return `Expected in ${plural(-days, 'day')}`
  if (days === 0) return 'Born today'
  if (days < 14) return `${plural(days, 'day')} old`
  if (days < 56) return `${plural(Math.floor(days / 7), 'week')} old`
  return `${plural(differenceInMonths(now, birth), 'month')} old`
}

/**
 * A soft benchmark for the first month, from pediatric guidance: about as many wet diapers a day
 * as the baby's age in days during the first week (1, 2, 3, ...), then six or more. A prompt to
 * ask the pediatrician, never an alert; sources differ slightly, so it is worded as a guide.
 */
export function wetDiaperGuide(birthDate: string | null, now: Date): { dayOfLife: number; expectedWet: number } | null {
  if (!birthDate) return null
  const dayOfLife = differenceInCalendarDays(now, parseISO(birthDate)) + 1
  if (dayOfLife < 1 || dayOfLife > 30) return null
  return { dayOfLife, expectedWet: Math.min(dayOfLife, 6) }
}

// --- Describing an entry ------------------------------------------------------------------

export type EventFlag = 'pale_stool' | 'fever'

export type EventDescription = {
  title: string
  detail: string | null
  /** Worth drawing attention to: something to mention to the pediatrician. */
  flag: EventFlag | null
}

export const FEVER_C = 38

const SIDE_LABEL: Record<BreastSide, string> = { left: 'Left', right: 'Right', both: 'Both sides' }
const CONTENT_LABEL: Record<MilkContent, string> = { breast_milk: 'breast milk', formula: 'formula' }

export function describeEvent(e: BabyEvent, now: number): EventDescription {
  const parts: string[] = []
  let flag: EventFlag | null = null
  let title: string

  switch (e.type) {
    case 'feed': {
      const method = feedMethod(e)
      if (method === 'bottle') {
        title = 'Bottle'
        const ml = detailNumber(e, 'ml')
        if (ml !== null) parts.push(`${ml} ml`)
        const content = e.details.content
        if (content === 'breast_milk' || content === 'formula') parts.push(CONTENT_LABEL[content])
      } else if (method === 'solids') {
        title = 'Solids'
        if (typeof e.details.food === 'string' && e.details.food) parts.push(e.details.food)
      } else {
        title = 'Breastfeed'
        const side = e.details.side
        if (side === 'left' || side === 'right' || side === 'both') parts.push(SIDE_LABEL[side])
        if (e.in_progress) parts.push(`feeding ${formatDuration(durationMs(e, now))}`)
        else if (e.ended_at) parts.push(formatDuration(durationMs(e, now)))
      }
      break
    }
    case 'diaper': {
      const kind = diaperKind(e)
      title = kind === 'both' ? 'Wet + dirty diaper' : kind ? `${kind[0].toUpperCase()}${kind.slice(1)} diaper` : 'Diaper'
      const color = stoolColorLabel(e.details.stool_color)
      if (color) parts.push(color)
      if (e.details.stool_color === 'grey_white') flag = 'pale_stool'
      break
    }
    case 'sleep':
      title = 'Sleep'
      if (e.in_progress) parts.push(`sleeping ${formatDuration(durationMs(e, now))}`)
      else if (e.ended_at) parts.push(formatDuration(durationMs(e, now)))
      break
    case 'pump': {
      title = 'Pumping'
      const { left, right } = pumpAmounts(e)
      if (left !== null) parts.push(`Left ${left} ml`)
      if (right !== null) parts.push(`Right ${right} ml`)
      if (left !== null && right !== null) parts.push(`${left + right} ml total`)
      if (e.in_progress) parts.push(`pumping ${formatDuration(durationMs(e, now))}`)
      else if (e.ended_at) parts.push(formatDuration(durationMs(e, now)))
      break
    }
    case 'temperature': {
      title = 'Temperature'
      const c = detailNumber(e, 'c')
      if (c !== null) {
        parts.push(`${c} °C`)
        if (c >= FEVER_C) flag = 'fever'
      }
      break
    }
    case 'medication':
      title = typeof e.details.name === 'string' && e.details.name ? e.details.name : 'Medication'
      break
    case 'growth':
      title = 'Growth'
      break
    default:
      title = 'Note'
  }

  if (e.note) parts.push(e.note)
  return { title, detail: parts.length ? parts.join(' · ') : null, flag }
}

export const FLAG_LABEL: Record<EventFlag, string> = {
  pale_stool: 'Pale stool: tell your pediatrician',
  fever: 'Fever: call your pediatrician',
}

// --- Saving an entry ----------------------------------------------------------------------

const FUTURE_SLACK_MS = 2 * 60_000

/** The first thing wrong with a draft, in words for the person logging it, or null if it can be saved. */
export function validateDraft(draft: EventDraft, now: number): string | null {
  const start = new Date(draft.started_at).getTime()
  if (Number.isNaN(start)) return 'Pick a start time.'
  if (start > now + FUTURE_SLACK_MS) return "That time hasn't happened yet."

  if (draft.in_progress && draft.ended_at) return 'A running timer has no end time.'
  if (draft.ended_at) {
    const end = new Date(draft.ended_at).getTime()
    if (Number.isNaN(end)) return 'Pick an end time.'
    if (end < start) return 'The end is before the start.'
    if (end > now + FUTURE_SLACK_MS) return "The end time hasn't happened yet."
  }

  if (draft.note && draft.note.length > MAX_NOTE_LENGTH) return `Notes can be up to ${MAX_NOTE_LENGTH} characters.`
  if (draft.type === 'note' && !draft.note) return 'Write something first.'
  if (draft.type === 'sleep' && !draft.in_progress && !draft.ended_at) return 'Pick when the sleep ended.'

  if (draft.type === 'feed') {
    const method = draft.details.method
    if (method !== 'breast' && method !== 'bottle' && method !== 'solids') return 'Pick breast, bottle or solids.'
    const ml = draft.details.ml
    if (method === 'bottle' && ml !== undefined && (typeof ml !== 'number' || ml < 1 || ml > MAX_BOTTLE_ML)) {
      return `Enter an amount from 1 to ${MAX_BOTTLE_ML} ml.`
    }
  }
  if (draft.type === 'pump') {
    const sides = [draft.details.ml_left, draft.details.ml_right]
    if (sides.some(v => v !== undefined && (typeof v !== 'number' || !(v >= 0 && v <= MAX_PUMP_ML)))) {
      return `Enter amounts from 0 to ${MAX_PUMP_ML} ml.`
    }
    const total = sides.reduce<number>((sum, v) => sum + (typeof v === 'number' ? v : 0), 0)
    if (!draft.in_progress && total <= 0) return 'Enter how much you pumped.'
  }
  if (draft.type === 'diaper') {
    const kind = draft.details.kind
    if (kind !== 'wet' && kind !== 'dirty' && kind !== 'both' && kind !== 'dry') return 'Pick what the diaper was.'
  }
  return null
}

// --- Merging changes from the other phone -------------------------------------------------

/** Applies one entry that arrived from the database: deleted ones leave the list, others replace or join it. */
export function upsertEvent(events: BabyEvent[], incoming: BabyEvent): BabyEvent[] {
  const rest = events.filter(e => e.id !== incoming.id)
  return incoming.deleted_at ? rest : newestFirst([...rest, incoming])
}

// --- Time inputs --------------------------------------------------------------------------

/** The value format of <input type="datetime-local">, in local time. */
export function toLocalInput(value: Date | string): string {
  return format(typeof value === 'string' ? new Date(value) : value, "yyyy-MM-dd'T'HH:mm")
}

/** ISO string for a datetime-local value, or null if it isn't a date. */
export function fromLocalInput(value: string): string | null {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function minutesAgo(minutes: number, now: number): string {
  return new Date(now - minutes * 60_000).toISOString()
}

/** A new entry's id is made on the device, so saving it twice (a retry) can't duplicate it. */
export function newEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}
