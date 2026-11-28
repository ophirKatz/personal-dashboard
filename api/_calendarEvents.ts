// Pure helpers for api/google-calendar-events.ts: request validation, the Google Calendar
// event payload, and telling Google's error responses apart. No I/O, so they're unit-tested.

// Event times are wall-clock in the app's timezone, the same assumption the calendar sync
// (supabase/functions/fetch-google-calendar) and the rest of the app make for this single-user app.
export const CALENDAR_TIME_ZONE = 'Asia/Jerusalem'

export const MAX_EVENTS_PER_REQUEST = 50
export const MAX_ATTENDEES_PER_EVENT = 50

export type NewEvent = {
  title: string
  date: string // YYYY-MM-DD
  startTime: string // HH:MM
  durationMinutes: number
  attendees: string[] // lower-cased, de-duplicated emails
}

type Parsed = { ok: true; events: NewEvent[] } | { ok: false; detail: string }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_RE.test(value)
}

function isRealDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(y, m - 1, d))
  return parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d
}

export function parseNewEvents(body: unknown): Parsed {
  const raw = (body as { events?: unknown } | null | undefined)?.events
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, detail: 'events must be a non-empty array' }
  if (raw.length > MAX_EVENTS_PER_REQUEST) return { ok: false, detail: `at most ${MAX_EVENTS_PER_REQUEST} events per request` }

  const events: NewEvent[] = []
  for (const [i, item] of raw.entries()) {
    const e = item as Record<string, unknown> | null
    const title = typeof e?.title === 'string' ? e.title.trim() : ''
    if (!title || title.length > 200) return { ok: false, detail: `events[${i}].title must be 1-200 characters` }
    if (typeof e?.date !== 'string' || !isRealDate(e.date)) return { ok: false, detail: `events[${i}].date must be YYYY-MM-DD` }
    if (typeof e?.startTime !== 'string' || !TIME_RE.test(e.startTime)) return { ok: false, detail: `events[${i}].startTime must be HH:MM` }
    const duration = e?.durationMinutes
    if (typeof duration !== 'number' || !Number.isInteger(duration) || duration < 5 || duration > 1440) {
      return { ok: false, detail: `events[${i}].durationMinutes must be a whole number from 5 to 1440` }
    }

    const rawAttendees = e?.attendees ?? []
    if (!Array.isArray(rawAttendees) || rawAttendees.length > MAX_ATTENDEES_PER_EVENT) {
      return { ok: false, detail: `events[${i}].attendees must be an array of at most ${MAX_ATTENDEES_PER_EVENT} emails` }
    }
    const attendees = new Set<string>()
    for (const a of rawAttendees) {
      const email = typeof a === 'string' ? a.trim().toLowerCase() : ''
      if (!isValidEmail(email)) return { ok: false, detail: `events[${i}].attendees has an invalid email` }
      attendees.add(email)
    }

    events.push({ title, date: e!.date as string, startTime: e!.startTime as string, durationMinutes: duration, attendees: [...attendees] })
  }
  return { ok: true, events }
}

// Wall-clock arithmetic: the end is computed on the naked date+time (no offset) and handed to
// Google together with the timeZone, so DST transitions are Google's problem, not ours.
export function addMinutesToWallClock(date: string, time: string, minutes: number): { date: string; time: string } {
  const d = new Date(`${date}T${time}:00Z`)
  d.setUTCMinutes(d.getUTCMinutes() + minutes)
  return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16) }
}

export function toGoogleEvent(event: NewEvent) {
  const end = addMinutesToWallClock(event.date, event.startTime, event.durationMinutes)
  return {
    summary: event.title,
    start: { dateTime: `${event.date}T${event.startTime}:00`, timeZone: CALENDAR_TIME_ZONE },
    end: { dateTime: `${end.date}T${end.time}:00`, timeZone: CALENDAR_TIME_ZONE },
    ...(event.attendees.length > 0 ? { attendees: event.attendees.map(email => ({ email })) } : {}),
  }
}

type GoogleErrorBody = {
  error?: { message?: string; errors?: { reason?: string }[]; details?: { reason?: string }[] }
} | null

function reasons(body: GoogleErrorBody): string[] {
  const error = body?.error
  return [...(error?.errors ?? []), ...(error?.details ?? [])].map(r => r.reason ?? '')
}

// A token issued before the write scope was granted is rejected with 403 "insufficient
// authentication scopes" — the cue for the UI to ask for consent again.
export function isInsufficientScope(status: number, body: GoogleErrorBody): boolean {
  if (status !== 403) return false
  return reasons(body).some(r => r === 'insufficientPermissions' || r === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT')
    || /insufficient authentication scopes/i.test(body?.error?.message ?? '')
}

// Google reports per-user rate limiting as 403 as well as 429, so this has to be checked
// separately from (and after) isInsufficientScope.
export function isRateLimited(status: number, body: GoogleErrorBody): boolean {
  if (status === 429) return true
  return status === 403 && reasons(body).some(r => r === 'rateLimitExceeded' || r === 'userRateLimitExceeded' || r === 'quotaExceeded')
}
