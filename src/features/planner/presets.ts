import { supabase } from '../../supabase'
import type { CalendarEvent, WeekPreset } from '../../supabase'
import { interpretResponse, presetRow, toRequestBody, type CreateOutcome, type ExistingEvent, type PlannedEvent, type PresetDraft } from './planner'

export async function loadPresets(): Promise<WeekPreset[]> {
  const { data, error } = await supabase.from('week_presets').select('*').order('position').order('created_at')
  if (error) throw error
  return (data ?? []) as WeekPreset[]
}

export async function savePreset(draft: PresetDraft, id: string | null, position: number): Promise<void> {
  const row = presetRow(draft)
  const { error } = id
    ? await supabase.from('week_presets').update(row).eq('id', id)
    : await supabase.from('week_presets').insert({ ...row, position })
  if (error) throw error
}

export async function deletePreset(id: string): Promise<void> {
  const { error } = await supabase.from('week_presets').delete().eq('id', id)
  if (error) throw error
}

// What is already on the calendar between two dates (inclusive), from the synced events cache.
export async function loadEventsBetween(from: string, to: string): Promise<(ExistingEvent & { id: string })[]> {
  const { data, error } = await supabase
    .from('events')
    .select('id, title, event_date, event_time, event_end_date, event_end_time')
    .gte('event_date', from)
    .lte('event_date', to)
  if (error) throw error
  return data ?? []
}

// People who are on upcoming events, as suggestions for who to invite.
export async function loadUpcomingAttendees(from: string): Promise<Pick<CalendarEvent, 'attendees'>[]> {
  const { data } = await supabase.from('events').select('attendees').gte('event_date', from).not('attendees', 'is', null)
  return data ?? []
}

export async function loadFriendContacts(): Promise<{ name: string; email: string | null }[]> {
  // select('*'): works whether or not the friends.email column exists yet
  const { data } = await supabase.from('friends').select('*')
  return (data ?? []).map(f => ({ name: f.name as string, email: (f.email as string | null | undefined) ?? null }))
}

// Creates the events on the primary Google Calendar, which emails the invitations.
export async function createCalendarEvents(plan: PlannedEvent[]): Promise<CreateOutcome> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { kind: 'error', message: 'Your session expired. Sign in again.' }

  let res: Response
  try {
    res = await fetch('/api/google-calendar-events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(toRequestBody(plan)),
    })
  } catch {
    return { kind: 'error', message: 'Could not reach the server. Check your connection and try again.' }
  }
  const body = await res.json().catch(() => null)
  return interpretResponse(plan, res.status, body)
}
