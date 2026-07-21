import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'

const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

// How far ahead to keep cached — covers every page that reads from the events
// table today (dashboard: 7d, calendar list: 30d, month view: up to 90d).
const SYNC_DAYS = 90

type AccountRow = { id: string; user_id: string; refresh_token: string; access_token: string | null; access_token_expires_at: string | null }

type GoogleEventItem = {
  id: string
  summary?: string
  htmlLink: string
  location?: string
  status?: string
  start: { date?: string; dateTime?: string }
  end: { date?: string; dateTime?: string }
  attendees?: { self?: boolean; responseStatus?: string }[]
}

// Calendar event titles that mark a climbing session — Hebrew for "training" and "climbing".
const CLIMBING_TITLE_KEYWORDS = ['אימון', 'טיפוס']

function isClimbingSessionTitle(title: string): boolean {
  return CLIMBING_TITLE_KEYWORDS.some(keyword => title.includes(keyword))
}

// Events with no attendees list are the user's own (no guests invited), which
// Google never asks you to RSVP to — treat those as accepted. Otherwise only
// keep events the user has explicitly accepted; declined/tentative/needsAction
// invites are excluded from sync entirely so they never reach the dashboard,
// calendar views, or AI focus summaries.
function isAcceptedByMe(ev: GoogleEventItem): boolean {
  const self = ev.attendees?.find(a => a.self)
  return !self || self.responseStatus === 'accepted'
}

// Event end times are plain wall-clock strings (no offset) in the calendar's own
// timezone, which for this single-user app is always Asia/Jerusalem — same
// assumption the rest of the app makes (due_date/due_time are parsed as local time).
function addMinutesToWallClock(dateStr: string, timeStr: string, minutes: number): { date: string; time: string } {
  const d = new Date(`${dateStr}T${timeStr}Z`)
  d.setUTCMinutes(d.getUTCMinutes() + minutes)
  return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 19) }
}

// Converts an Asia/Jerusalem wall-clock date+time into the actual UTC instant,
// without assuming a fixed offset (so it's correct across DST transitions).
function jerusalemWallClockToUtcIso(dateStr: string, timeStr: string): string {
  const guess = new Date(`${dateStr}T${timeStr}Z`)
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const parts: Record<string, string> = {}
  for (const p of fmt.formatToParts(guess)) parts[p.type] = p.value
  const wallClockOfGuessAsUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour) === 24 ? 0 : Number(parts.hour), Number(parts.minute), Number(parts.second),
  )
  const offsetMs = wallClockOfGuessAsUtc - guess.getTime()
  return new Date(guess.getTime() - offsetMs).toISOString()
}

async function getAllAccounts(supabase: SupabaseClient): Promise<AccountRow[]> {
  const { data } = await supabase
    .from('google_accounts')
    .select('id, user_id, refresh_token, access_token, access_token_expires_at')
    .is('deleted_at', null)
  return (data ?? []) as AccountRow[]
}

async function getAccessToken(
  supabase: SupabaseClient,
  account: AccountRow,
  clientId: string,
  clientSecret: string,
): Promise<string | null> {
  let accessToken = account.access_token
  const expiresAt = account.access_token_expires_at ? new Date(account.access_token_expires_at).getTime() : 0
  if (accessToken && expiresAt - Date.now() >= 60_000) return accessToken

  const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: account.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  if (!refreshRes.ok) return null

  const refreshed = await refreshRes.json()
  accessToken = refreshed.access_token
  const newExpiresAt = new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000).toISOString()
  await supabase
    .from('google_accounts')
    .update({ access_token: accessToken, access_token_expires_at: newExpiresAt, updated_at: new Date().toISOString() })
    .eq('id', account.id)
  return accessToken
}

async function syncCalendarForAccount(supabase: SupabaseClient, account: AccountRow, clientId: string, clientSecret: string) {
  const accessToken = await getAccessToken(supabase, account, clientId, clientSecret)
  if (!accessToken) return

  const timeMin = new Date(new Date().toISOString().slice(0, 10)).toISOString()
  const timeMax = new Date(Date.now() + SYNC_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  })

  const res = await fetch(`${CALENDAR_BASE}?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) return // insufficient scope / upstream error — best-effort, leave cache as-is

  const data: { items?: GoogleEventItem[] } = await res.json()
  const events = (data.items ?? [])
    .filter(ev => ev.status !== 'cancelled' && (ev.start.date || ev.start.dateTime) && isAcceptedByMe(ev))
    .map(ev => ({
      id: ev.id,
      title: ev.summary ?? '(No title)',
      eventDate: ev.start.date ?? ev.start.dateTime!.slice(0, 10),
      eventTime: ev.start.dateTime ? ev.start.dateTime.slice(11, 19) : null,
      eventEndDate: ev.end.date ?? ev.end.dateTime?.slice(0, 10) ?? null,
      eventEndTime: ev.end.dateTime ? ev.end.dateTime.slice(11, 19) : null,
      location: ev.location ?? null,
      htmlLink: ev.htmlLink,
    }))

  const { data: existingRows, error: selectError } = await supabase
    .from('events')
    .select('google_event_id')
    .eq('user_id', account.user_id)
    .eq('google_account_id', account.id)
  if (selectError) return
  const existingIds = new Set((existingRows ?? []).map(r => r.google_event_id).filter((id): id is string => id !== null))

  const rows = events.map(e => ({
    user_id: account.user_id,
    title: e.title,
    event_date: e.eventDate,
    event_time: e.eventTime,
    event_end_date: e.eventEndDate,
    event_end_time: e.eventEndTime,
    location: e.location,
    source: 'google',
    google_event_id: e.id,
    google_account_id: account.id,
    html_link: e.htmlLink,
  }))

  if (rows.length > 0) {
    const { error: upsertError } = await supabase.from('events').upsert(rows, { onConflict: 'user_id,google_account_id,google_event_id' })
    if (upsertError) return
  }

  const currentIds = new Set(events.map(e => e.id))
  const staleIds = [...existingIds].filter(id => !currentIds.has(id))
  if (staleIds.length > 0) {
    await supabase.from('events').delete().eq('user_id', account.user_id).eq('google_account_id', account.id).in('google_event_id', staleIds)
  }

  await createClimbingLogTasks(supabase, account.user_id, events)
}

// Every climbing session synced from the calendar gets a matching "Log a climb"
// task, due 15 minutes after the session ends, so logging the climb is never
// forgotten. Deduped per event via todos.source_event_id since this sync runs
// on a recurring schedule.
async function createClimbingLogTasks(
  supabase: SupabaseClient,
  userId: string,
  events: { id: string; title: string; eventDate: string; eventEndDate: string | null; eventEndTime: string | null }[],
) {
  const climbingEvents = events.filter(e => isClimbingSessionTitle(e.title))
  if (climbingEvents.length === 0) return

  const { data: existingTasks } = await supabase
    .from('todos')
    .select('source_event_id')
    .eq('user_id', userId)
    .in('source_event_id', climbingEvents.map(e => e.id))
  const alreadyCreated = new Set((existingTasks ?? []).map(t => t.source_event_id as string))

  const newTasks = climbingEvents
    .filter(e => !alreadyCreated.has(e.id))
    .map(e => {
      const endDate = e.eventEndDate ?? e.eventDate
      if (!e.eventEndTime) {
        return {
          user_id: userId,
          title: 'Log a climb',
          notes: `Auto-created from calendar event "${e.title}"`,
          due_date: endDate,
          due_time: null,
          reminder_enabled: false,
          remind_at: null,
          source: 'local',
          source_event_id: e.id,
        }
      }
      const due = addMinutesToWallClock(endDate, e.eventEndTime, 15)
      return {
        user_id: userId,
        title: 'Log a climb',
        notes: `Auto-created from calendar event "${e.title}"`,
        due_date: due.date,
        due_time: due.time,
        reminder_enabled: true,
        remind_at: jerusalemWallClockToUtcIso(due.date, due.time),
        source: 'local',
        source_event_id: e.id,
      }
    })

  if (newTasks.length > 0) {
    await supabase.from('todos').insert(newTasks)
  }
}

Deno.serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const cronSecret = Deno.env.get('CRON_SECRET')
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')

  if (!supabaseUrl || !serviceRoleKey || !clientId || !clientSecret) {
    return new Response(JSON.stringify({ error: 'MISSING_CONFIG' }), { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const authHeader = req.headers.get('authorization') ?? ''
  const isCron = Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`

  if (isCron) {
    const accounts = await getAllAccounts(supabase)
    const results = await Promise.allSettled(accounts.map(account => syncCalendarForAccount(supabase, account, clientId, clientSecret)))
    const errors = results.filter(r => r.status === 'rejected').length
    return new Response(JSON.stringify({ processed: results.length, errors }), { status: 200 })
  }

  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401 })
  }
  const jwt = authHeader.slice('Bearer '.length)
  const { data: userData, error: userError } = await supabase.auth.getUser(jwt)
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401 })
  }

  try {
    const accounts = (await getAllAccounts(supabase)).filter(a => a.user_id === userData.user.id)
    await Promise.all(accounts.map(account => syncCalendarForAccount(supabase, account, clientId, clientSecret)))
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), { status: 502 })
  }
})
