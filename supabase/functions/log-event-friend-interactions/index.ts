import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { todayInTZ } from '../_shared/time.ts'

type EventLink = { event_id: string; friend_id: string; user_id: string }
type EventRow = { id: string; title: string; event_date: string }

// For every friend linked to a calendar event whose date has passed, logs a
// friend_interactions row (event title as note, event date as interaction
// date). Starts from event_friends (small — only events a friend was
// explicitly linked to) rather than scanning the whole events table, and
// dedupes via the friend_id/source_event_id unique index so re-running this
// daily is a no-op for events already logged.
async function logPassedEventInteractions(supabase: SupabaseClient, today: string): Promise<{ created: number }> {
  const { data: links } = await supabase
    .from('event_friends')
    .select('event_id, friend_id, user_id')
  const linkRows = (links ?? []) as EventLink[]
  if (linkRows.length === 0) return { created: 0 }

  const eventIds = [...new Set(linkRows.map(l => l.event_id))]
  const { data: events } = await supabase
    .from('events')
    .select('id, title, event_date')
    .in('id', eventIds)
    .lt('event_date', today)
  const eventById = new Map(((events ?? []) as EventRow[]).map(e => [e.id, e]))
  if (eventById.size === 0) return { created: 0 }

  const rows = linkRows
    .filter(l => eventById.has(l.event_id))
    .map(l => {
      const event = eventById.get(l.event_id)!
      return {
        friend_id: l.friend_id,
        user_id: l.user_id,
        interaction_date: event.event_date,
        note: event.title,
        source_event_id: event.id,
      }
    })
  if (rows.length === 0) return { created: 0 }

  const { data: inserted, error } = await supabase
    .from('friend_interactions')
    .upsert(rows, { onConflict: 'friend_id,source_event_id', ignoreDuplicates: true })
    .select('id')
  if (error) throw error

  return { created: inserted?.length ?? 0 }
}

Deno.serve(async (req: Request) => {
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'MISSING_CONFIG' }), { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const today = todayInTZ()

  try {
    const result = await logPassedEventInteractions(supabase, today)
    return new Response(JSON.stringify({ today, ...result }), { status: 200 })
  } catch (err) {
    console.error('log-event-friend-interactions: failed for date', today, err)
    return new Response(JSON.stringify({ error: 'LOG_FAILED' }), { status: 500 })
  }
})
