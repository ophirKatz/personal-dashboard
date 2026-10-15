import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { supabase } from '../../supabase'
import type { CalendarEvent } from '../../supabase'
import { formatTime } from '../../utils'

// Calendar event titles that mark a climbing session — Hebrew for "training" and
// "climbing". Keep in sync with CLIMBING_TITLE_KEYWORDS in
// supabase/functions/fetch-google-calendar/index.ts, which uses the same rule to
// create the "Log a climb" tasks.
export const CLIMBING_TITLE_KEYWORDS = ['אימון', 'טיפוס']

export function isClimbingSessionTitle(title: string): boolean {
  return CLIMBING_TITLE_KEYWORDS.some(keyword => title.includes(keyword))
}

type SessionEvent = Pick<CalendarEvent, 'title' | 'event_date' | 'event_time' | 'event_end_date' | 'event_end_time'>

// Event times are wall-clock strings, parsed as the browser's local time like
// everywhere else in the app (due_date/due_time).
function hasEnded(event: SessionEvent, now: Date): boolean {
  // All-day events have no time of day, so they stay "upcoming" through their date.
  if (!event.event_time) return event.event_date < format(now, 'yyyy-MM-dd')
  const endDate = event.event_end_date ?? event.event_date
  const endTime = event.event_end_time ?? event.event_time
  return new Date(`${endDate}T${endTime}`) < now
}

// The soonest climbing session that hasn't finished yet (one in progress still counts).
export function pickNextClimbingSession<T extends SessionEvent>(events: T[], now: Date = new Date()): T | null {
  const upcoming = events
    .filter(e => isClimbingSessionTitle(e.title) && !hasEnded(e, now))
    .sort((a, b) =>
      a.event_date.localeCompare(b.event_date) ||
      (a.event_time ?? '99:99:99').localeCompare(b.event_time ?? '99:99:99'),
    )
  return upcoming[0] ?? null
}

// "Today · 6:00 PM", "Tomorrow · 6:00 PM", "Sat · 6:00 PM" within the coming
// week, "Oct 24 · 6:00 PM" beyond it. All-day events read "… · All day".
export function nextSessionLabel(event: SessionEvent | null, now: Date = new Date()): string {
  if (!event) return 'No session scheduled'
  const date = parseISO(event.event_date)
  const daysAway = differenceInCalendarDays(date, now)
  const day = daysAway <= 0 ? 'Today'
    : daysAway === 1 ? 'Tomorrow'
    : daysAway < 7 ? format(date, 'EEE')
    : format(date, 'MMM d')
  return `${day} · ${event.event_time ? formatTime(event.event_time) : 'All day'}`
}

// Reads the whole synced window (not just the dashboard's 7 days) so a session
// further out still shows up. Throws if the query fails.
export async function fetchNextClimbingSession(now: Date = new Date()): Promise<CalendarEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .gte('event_date', format(now, 'yyyy-MM-dd'))
    .or(CLIMBING_TITLE_KEYWORDS.map(keyword => `title.ilike.%${keyword}%`).join(','))
    .order('event_date')
    .order('event_time')
    .limit(10)
  if (error) throw error
  return pickNextClimbingSession(data ?? [], now)
}
