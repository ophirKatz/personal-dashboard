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
}

async function getAllAccounts(supabase: SupabaseClient): Promise<AccountRow[]> {
  const { data } = await supabase.from('google_accounts').select('id, user_id, refresh_token, access_token, access_token_expires_at')
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
    .filter(ev => ev.status !== 'cancelled' && (ev.start.date || ev.start.dateTime))
    .map(ev => ({
      id: ev.id,
      title: ev.summary ?? '(No title)',
      eventDate: ev.start.date ?? ev.start.dateTime!.slice(0, 10),
      eventTime: ev.start.dateTime ? ev.start.dateTime.slice(11, 19) : null,
      notes: ev.location ?? null,
      htmlLink: ev.htmlLink,
    }))

  const { data: existingRows } = await supabase
    .from('events')
    .select('google_event_id')
    .eq('user_id', account.user_id)
    .eq('google_account_id', account.id)
  const existingIds = new Set((existingRows ?? []).map(r => r.google_event_id as string))

  const rows = events.map(e => ({
    user_id: account.user_id,
    title: e.title,
    event_date: e.eventDate,
    event_time: e.eventTime,
    notes: e.notes,
    source: 'google',
    google_event_id: e.id,
    google_account_id: account.id,
    html_link: e.htmlLink,
  }))

  if (rows.length > 0) {
    await supabase.from('events').upsert(rows, { onConflict: 'user_id,google_account_id,google_event_id' })
  }

  const currentIds = new Set(events.map(e => e.id))
  const staleIds = [...existingIds].filter(id => !currentIds.has(id))
  if (staleIds.length > 0) {
    await supabase.from('events').delete().eq('user_id', account.user_id).eq('google_account_id', account.id).in('google_event_id', staleIds)
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
