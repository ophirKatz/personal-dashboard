import { supabase } from '../../supabase'

/**
 * Whether a climbing session has ended without being logged.
 *
 * `endedOn` is the date of the latest calendar climbing session that finished (recorded by the
 * calendar sync, see supabase/functions/fetch-google-calendar); `lastLoggedOn` is the date of the
 * latest logged session. Logging any session dated on or after the one that ended dismisses it.
 */
export function isClimbLogPending(endedOn: string | null, lastLoggedOn: string | null): boolean {
  if (!endedOn) return false
  return lastLoggedOn === null || lastLoggedOn < endedOn
}

// Resolves false (no glow) if either read fails, e.g. before the migration adding the column is applied.
export async function fetchClimbLogPending(): Promise<boolean> {
  const { data: settings, error } = await supabase
    .from('user_settings')
    .select('climbing_session_ended_on')
    .maybeSingle()
  const endedOn = (settings as { climbing_session_ended_on: string | null } | null)?.climbing_session_ended_on ?? null
  if (error || !endedOn) return false

  const { data: latest, error: latestError } = await supabase
    .from('climbing_sessions')
    .select('session_date')
    .order('session_date', { ascending: false })
    .limit(1)
  if (latestError) return false
  return isClimbLogPending(endedOn, latest?.[0]?.session_date ?? null)
}
