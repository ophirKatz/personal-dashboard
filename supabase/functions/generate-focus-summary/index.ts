import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'

type Period = 'today' | 'week'

type Todo = { title: string; notes: string | null; due_date: string | null; due_time: string | null; priority: string }
type LocalEvent = { title: string; date: string; time: string | null; notes: string | null; source: 'local' }
type GoogleEvent = { title: string; date: string; time: string | null; source: 'google' }

function todayInTZ(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

async function getAllUserIds(supabase: SupabaseClient): Promise<string[]> {
  const ids = new Set<string>()
  const [todosRes, eventsRes, tokensRes] = await Promise.all([
    supabase.from('todos').select('user_id'),
    supabase.from('events').select('user_id'),
    supabase.from('google_oauth_tokens').select('user_id'),
  ])
  for (const row of [...(todosRes.data ?? []), ...(eventsRes.data ?? []), ...(tokensRes.data ?? [])]) {
    ids.add((row as { user_id: string }).user_id)
  }
  return [...ids]
}

async function getGoogleEvents(
  supabase: SupabaseClient,
  userId: string,
  timeMin: string,
  timeMax: string,
  clientId?: string,
  clientSecret?: string,
): Promise<GoogleEvent[]> {
  if (!clientId || !clientSecret) return []

  const { data: tokenRow } = await supabase
    .from('google_oauth_tokens')
    .select('refresh_token, access_token, access_token_expires_at')
    .eq('user_id', userId)
    .maybeSingle<{ refresh_token: string; access_token: string | null; access_token_expires_at: string | null }>()
  if (!tokenRow) return []

  let accessToken = tokenRow.access_token
  const expiresAt = tokenRow.access_token_expires_at ? new Date(tokenRow.access_token_expires_at).getTime() : 0
  if (!accessToken || expiresAt - Date.now() < 60_000) {
    try {
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: tokenRow.refresh_token,
          grant_type: 'refresh_token',
        }),
      })
      if (!refreshRes.ok) return []
      const refreshed = await refreshRes.json()
      accessToken = refreshed.access_token
      const newExpiresAt = new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000).toISOString()
      await supabase
        .from('google_oauth_tokens')
        .update({ access_token: accessToken, access_token_expires_at: newExpiresAt, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
    } catch {
      return []
    }
  }

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  })

  try {
    const eventsRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!eventsRes.ok) return []
    const data: { items?: Array<{ summary?: string; status?: string; start: { date?: string; dateTime?: string } }> } =
      await eventsRes.json()
    return (data.items ?? [])
      .filter(ev => ev.status !== 'cancelled' && (ev.start.date || ev.start.dateTime))
      .map(ev => ({
        title: ev.summary ?? '(No title)',
        date: ev.start.date ?? ev.start.dateTime!.slice(0, 10),
        time: ev.start.dateTime ? ev.start.dateTime.slice(11, 16) : null,
        source: 'google' as const,
      }))
  } catch {
    return []
  }
}

async function callClaude(
  period: Period,
  context: { today: string; rangeEnd: string; todos: Todo[]; events: Array<LocalEvent | GoogleEvent> },
  apiKey: string,
): Promise<string> {
  const system =
    `You are a focus assistant inside a personal dashboard app. Given a user's todos and calendar ` +
    `events for ${period === 'today' ? 'today' : 'the next 7 days'}, write a short, warm, prioritized ` +
    `focus briefing in plain text (no markdown headers; 2-5 sentences, or a short list using "-" for bullets). ` +
    `Call out urgent or time-sensitive items first, flag any scheduling conflicts (overlapping or ` +
    `back-to-back events), and mention if the period looks light or heavy. Only reference items present ` +
    `in the data — never invent items.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system,
      messages: [{ role: 'user', content: JSON.stringify(context) }],
    }),
  })

  if (!res.ok) {
    throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`)
  }

  const data: { content?: Array<{ text?: string }> } = await res.json()
  return data.content?.[0]?.text?.trim() ?? ''
}

async function upsertSummary(
  supabase: SupabaseClient,
  userId: string,
  period: Period,
  patch: { summary?: string; status: 'ready' | 'error'; error?: string | null },
) {
  const payload: Record<string, unknown> = {
    user_id: userId,
    period,
    status: patch.status,
    updated_at: new Date().toISOString(),
  }
  if (patch.status === 'ready') {
    payload.summary = patch.summary
    payload.error = null
    payload.generated_at = new Date().toISOString()
  } else {
    payload.error = patch.error ?? 'Unknown error'
  }
  await supabase.from('focus_summaries').upsert(payload, { onConflict: 'user_id,period' })
}

async function generateFocusSummary(
  supabase: SupabaseClient,
  userId: string,
  period: Period,
  secrets: { anthropicApiKey?: string; googleClientId?: string; googleClientSecret?: string },
): Promise<{ period: Period; summary: string }> {
  const todayStr = todayInTZ('Asia/Jerusalem')
  const rangeEnd = period === 'today' ? todayStr : addDays(todayStr, 6)

  let todosQuery = supabase.from('todos').select('title, notes, due_date, due_time, priority').eq('user_id', userId).eq('completed', false)
  todosQuery = period === 'today'
    ? todosQuery.or(`due_date.eq.${todayStr},due_date.is.null`)
    : todosQuery.gte('due_date', todayStr).lte('due_date', rangeEnd)

  const [todosRes, eventsRes] = await Promise.all([
    todosQuery,
    supabase
      .from('events')
      .select('title, event_date, event_time, notes')
      .eq('user_id', userId)
      .gte('event_date', todayStr)
      .lte('event_date', rangeEnd),
  ])

  const googleEvents = await getGoogleEvents(
    supabase,
    userId,
    new Date(`${todayStr}T00:00:00Z`).toISOString(),
    new Date(`${rangeEnd}T23:59:59Z`).toISOString(),
    secrets.googleClientId,
    secrets.googleClientSecret,
  )

  const todos = (todosRes.data ?? []) as Todo[]
  const localEvents: LocalEvent[] = (eventsRes.data ?? []).map(e => ({
    title: e.title,
    date: e.event_date,
    time: e.event_time,
    notes: e.notes,
    source: 'local' as const,
  }))
  const events = [...localEvents, ...googleEvents]

  let summary: string
  if (todos.length === 0 && events.length === 0) {
    summary = period === 'today'
      ? 'Nothing on the books for today — a clear day. Good time to get ahead on something, or just rest.'
      : 'Nothing scheduled for the week ahead yet. A clean slate.'
  } else if (!secrets.anthropicApiKey) {
    throw new Error('MISSING_ANTHROPIC_API_KEY')
  } else {
    summary = await callClaude(period, { today: todayStr, rangeEnd, todos, events }, secrets.anthropicApiKey)
  }

  await upsertSummary(supabase, userId, period, { summary, status: 'ready' })
  return { period, summary }
}

Deno.serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const cronSecret = Deno.env.get('CRON_SECRET')
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
  const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'MISSING_CONFIG' }), { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const authHeader = req.headers.get('authorization') ?? ''
  const isCron = Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`

  let body: { user_id?: string; period?: Period } = {}
  try {
    body = await req.json()
  } catch {
    // empty body is fine (e.g. the daily cron call)
  }

  let targets: Array<{ userId: string; period: Period }>
  let isManual = false

  if (isCron) {
    if (body.user_id && body.period) {
      targets = [{ userId: body.user_id, period: body.period }]
    } else {
      const userIds = await getAllUserIds(supabase)
      targets = userIds.flatMap(userId => [{ userId, period: 'today' as Period }, { userId, period: 'week' as Period }])
    }
  } else {
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401 })
    }
    const jwt = authHeader.slice('Bearer '.length)
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt)
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401 })
    }
    const period: Period = body.period === 'week' ? 'week' : 'today'
    targets = [{ userId: userData.user.id, period }]
    isManual = true
  }

  const secrets = { anthropicApiKey, googleClientId, googleClientSecret }
  const results: Array<{ userId: string; period: Period; summary?: string; error?: string }> = []

  for (const target of targets) {
    try {
      const { summary } = await generateFocusSummary(supabase, target.userId, target.period, secrets)
      results.push({ userId: target.userId, period: target.period, summary })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      await upsertSummary(supabase, target.userId, target.period, { status: 'error', error: message })
      results.push({ userId: target.userId, period: target.period, error: message })
    }
  }

  if (isManual) {
    const [result] = results
    if (result.error) {
      return new Response(JSON.stringify({ error: result.error }), { status: 502 })
    }
    return new Response(JSON.stringify({ period: result.period, summary: result.summary }), { status: 200 })
  }

  return new Response(JSON.stringify({ processed: results.length, errors: results.filter(r => r.error).length }), { status: 200 })
})
