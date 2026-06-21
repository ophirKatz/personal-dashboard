import { supabase } from '../../supabase'

export type GoogleCalendarEvent = {
  id: string
  title: string
  event_date: string
  event_time: string | null
  notes: string | null
  htmlLink: string
}

export async function fetchGoogleCalendarEvents(days = 30): Promise<{ connected: boolean; events: GoogleCalendarEvent[] }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { connected: false, events: [] }

  const res = await fetch(`/api/calendar-events?days=${days}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })

  if (res.status === 404) return { connected: false, events: [] }
  if (!res.ok) return { connected: false, events: [] }

  const data = await res.json()
  return { connected: true, events: data.events ?? [] }
}
