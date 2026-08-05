import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

type TokenAuthResult =
  | { ok: true; supabase: SupabaseClient; userId: string }
  | { ok: false; status: number; error: string }

// Validates the long-lived personal API token used by external callers (e.g. an iOS Shortcut)
// that can't hold a short-lived Supabase session JWT, resolving to a user via a hash lookup
// in api_tokens rather than supabase.auth.getUser.
async function authenticateApiToken(req: Request): Promise<TokenAuthResult> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return { ok: false, status: 500, error: 'MISSING_CONFIG' }
  }

  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'UNAUTHORIZED' }
  }
  const rawToken = authHeader.slice('Bearer '.length).trim()
  if (!rawToken) {
    return { ok: false, status: 401, error: 'UNAUTHORIZED' }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const tokenHash = await sha256Hex(rawToken)

  const { data, error } = await supabase
    .from('api_tokens')
    .select('id, user_id')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error || !data) {
    return { ok: false, status: 401, error: 'UNAUTHORIZED' }
  }

  await supabase.from('api_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', data.id)

  return { ok: true, supabase, userId: data.user_id }
}

// Same single-user assumption as fetch-weather/generate-focus-summary/send-rain-notification.
function todayInTZ(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

type Todo = { title: string; due_date: string | null; due_time: string | null; priority: string }
type Event = { title: string; event_time: string | null; location: string | null }

async function fetchDailyContext(supabase: SupabaseClient, userId: string, today: string) {
  const [todosRes, eventsRes] = await Promise.all([
    supabase
      .from('todos')
      .select('title, due_date, due_time, priority')
      .eq('user_id', userId)
      .eq('completed', false)
      .eq('due_date', today),
    supabase
      .from('events')
      .select('title, event_time, location')
      .eq('user_id', userId)
      .eq('event_date', today)
      .order('event_time', { ascending: true, nullsFirst: false }),
  ])

  const todos: Todo[] = todosRes.data ?? []
  const events: Event[] = eventsRes.data ?? []

  return { todos, events }
}

function buildSystemPrompt(today: string): string {
  return (
    `You are a personal assistant giving the user a spoken daily briefing via Siri. Today's date is ` +
    `${today}. You'll receive JSON with today's calendar events and today's to-do items. Write a ` +
    `concise, natural-sounding spoken summary — 2 to 4 short sentences, plain text only, no markdown, ` +
    `no bullet points, no headers — that a text-to-speech voice can read aloud in one breath. Mention ` +
    `the day's calendar events first, in chronological order with their times, then the tasks due ` +
    `today. Skip any section that has nothing to report — never say "no events" or "nothing due", ` +
    `just omit it entirely. Be warm but brief; this is meant to be heard, not read.`
  )
}

async function generateBriefing(
  apiKey: string,
  today: string,
  context: { todos: Todo[]; events: Event[] },
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: buildSystemPrompt(today),
      messages: [{ role: 'user', content: JSON.stringify(context) }],
    }),
  })

  if (!res.ok) {
    throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`)
  }

  const data: { content?: Array<{ text?: string }> } = await res.json()
  const text = data.content?.[0]?.text?.trim()
  if (!text) throw new Error('Claude returned an empty response')
  return text
}

Deno.serve(async (req: Request) => {
  const auth = await authenticateApiToken(req)
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), { status: auth.status })
  }

  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicApiKey) {
    return new Response(JSON.stringify({ error: 'MISSING_ANTHROPIC_API_KEY' }), { status: 500 })
  }

  const today = todayInTZ('Asia/Jerusalem')
  const context = await fetchDailyContext(auth.supabase, auth.userId, today)

  let message: string
  try {
    message = await generateBriefing(anthropicApiKey, today, context)
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: 'SUMMARY_FAILED', message: errMessage }), { status: 502 })
  }

  return new Response(JSON.stringify({ message }), { status: 200 })
})
