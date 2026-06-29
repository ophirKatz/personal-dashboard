import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'

type Period = 'today' | 'week'

type Todo = { id: string; title: string; notes: string | null; due_date: string | null; due_time: string | null; priority: string }
type Event = { id: string; title: string; date: string; time: string | null; notes: string | null; source: 'local' | 'google' }

type FocusCardItem = {
  type: 'todo' | 'event'
  id: string
  title: string
  date: string | null
  time: string | null
  priority?: string
  source?: 'local' | 'google'
}
type FocusCard = { label: string; insight: string; items: FocusCardItem[] }
type SummaryPayload = { type: 'cards'; cards: FocusCard[]; note: string | null } | { type: 'text'; text: string }

function todayInTZ(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

async function getAutoGenerateEnabledUserIds(supabase: SupabaseClient): Promise<string[]> {
  const ids = new Set<string>()
  const [todosRes, eventsRes, tokensRes] = await Promise.all([
    supabase.from('todos').select('user_id'),
    supabase.from('events').select('user_id'),
    supabase.from('google_accounts').select('user_id'),
  ])
  for (const row of [...(todosRes.data ?? []), ...(eventsRes.data ?? []), ...(tokensRes.data ?? [])]) {
    ids.add((row as { user_id: string }).user_id)
  }

  const { data: disabledRows } = await supabase
    .from('user_settings')
    .select('user_id')
    .eq('auto_generate_focus_summaries_daily', false)
  const disabled = new Set((disabledRows ?? []).map(row => (row as { user_id: string }).user_id))

  return [...ids].filter(id => !disabled.has(id))
}

async function callClaude(
  period: Period,
  context: { today: string; rangeEnd: string; todos: Todo[]; events: Event[] },
  apiKey: string,
): Promise<string> {
  const system =
    `You are a focus assistant inside a personal dashboard app. Given a user's todos and calendar ` +
    `events for ${period === 'today' ? 'today' : 'the next 7 days'}, group related items into short, ` +
    `thematic cards — e.g. a meeting with its prep task, items tied to the same project or person, or a ` +
    `cluster of back-to-back commitments. Items with nothing else to group with still get their own ` +
    `single-item card; never omit an item. Respond with ONLY a JSON object (no markdown fences, no ` +
    `commentary) matching this shape:\n` +
    `{"cards": [{"label": string, "insight": string, "items": [{"type": "todo" | "event", "id": string}]}], "note": string | null}\n` +
    `- "label": a short 2-5 word title for the group.\n` +
    `- "insight": one short sentence about the group — urgency, timing, or conflicts.\n` +
    `- "items": reference ONLY "id" values present in the input data, tagged with their "type". Never invent ids.\n` +
    `- Order cards with the most urgent/important first.\n` +
    `- "note": one short overall remark (e.g. a cross-card conflict, or how light/heavy the period looks), or null.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: period === 'today' ? 1024 : 4096,
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

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return (fenced ? fenced[1] : text).trim()
}

// Resolves the model's id references back against the actual todos/events so the
// stored payload is self-contained (the frontend never has to re-fetch by id).
// Cards that end up with no valid items (hallucinated ids) are dropped; if that
// leaves nothing, the caller falls back to the raw text.
function resolveCards(raw: string, todos: Todo[], events: Event[]): SummaryPayload {
  const parsed = JSON.parse(extractJson(raw)) as {
    cards?: Array<{ label?: string; insight?: string; items?: Array<{ type?: string; id?: string }> }>
    note?: string | null
  }

  const todosById = new Map(todos.map(t => [t.id, t]))
  const eventsById = new Map(events.map(e => [e.id, e]))

  const cards: FocusCard[] = (parsed.cards ?? [])
    .map(card => {
      const items: FocusCardItem[] = (card.items ?? [])
        .map((item): FocusCardItem | null => {
          if (item.type === 'todo' && item.id) {
            const todo = todosById.get(item.id)
            if (!todo) return null
            return { type: 'todo', id: todo.id, title: todo.title, date: todo.due_date, time: todo.due_time, priority: todo.priority }
          }
          if (item.type === 'event' && item.id) {
            const event = eventsById.get(item.id)
            if (!event) return null
            return { type: 'event', id: event.id, title: event.title, date: event.date, time: event.time, source: event.source }
          }
          return null
        })
        .filter((item): item is FocusCardItem => item !== null)
      return { label: card.label?.trim() || 'Untitled', insight: card.insight?.trim() ?? '', items }
    })
    .filter(card => card.items.length > 0)

  if (cards.length === 0) throw new Error('No matched items in model response')

  return { type: 'cards', cards, note: parsed.note?.trim() || null }
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
  secrets: { anthropicApiKey?: string },
): Promise<{ period: Period; summary: string }> {
  const todayStr = todayInTZ('Asia/Jerusalem')
  const rangeEnd = period === 'today' ? todayStr : addDays(todayStr, 6)

  let todosQuery = supabase.from('todos').select('id, title, notes, due_date, due_time, priority').eq('user_id', userId).eq('completed', false)
  todosQuery = period === 'today'
    ? todosQuery.or(`due_date.eq.${todayStr},due_date.is.null`)
    : todosQuery.gte('due_date', todayStr).lte('due_date', rangeEnd)

  const [todosRes, eventsRes] = await Promise.all([
    todosQuery,
    supabase
      .from('events')
      .select('id, title, event_date, event_time, notes, source')
      .eq('user_id', userId)
      .gte('event_date', todayStr)
      .lte('event_date', rangeEnd),
  ])

  const todos = (todosRes.data ?? []) as Todo[]
  const events: Event[] = (eventsRes.data ?? []).map(e => ({
    id: e.id,
    title: e.title,
    date: e.event_date,
    time: e.event_time,
    notes: e.notes,
    source: e.source,
  }))

  let payload: SummaryPayload
  if (todos.length === 0 && events.length === 0) {
    const note = period === 'today'
      ? 'Nothing on the books for today — a clear day. Good time to get ahead on something, or just rest.'
      : 'Nothing scheduled for the week ahead yet. A clean slate.'
    payload = { type: 'cards', cards: [], note }
  } else if (!secrets.anthropicApiKey) {
    throw new Error('MISSING_ANTHROPIC_API_KEY')
  } else {
    const raw = await callClaude(period, { today: todayStr, rangeEnd, todos, events }, secrets.anthropicApiKey)
    try {
      payload = resolveCards(raw, todos, events)
    } catch {
      payload = { type: 'text', text: raw }
    }
  }

  const summary = JSON.stringify(payload)
  await upsertSummary(supabase, userId, period, { summary, status: 'ready' })
  return { period, summary }
}

Deno.serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const cronSecret = Deno.env.get('CRON_SECRET')
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')

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
      const userIds = await getAutoGenerateEnabledUserIds(supabase)
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

  const secrets = { anthropicApiKey }
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
