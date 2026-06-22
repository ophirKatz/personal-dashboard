import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'

const MAX_TODOS = 50
const VALID_PRIORITIES = ['low', 'medium', 'high']

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

type Todo = { title: string; due_date: string | null; due_time: string | null; priority: 'low' | 'medium' | 'high' }

function buildSystemPrompt(today: string): string {
  return (
    'You extract one or more to-do/task items from a short spoken transcript dictated via Siri ' +
    '(e.g. "add a todo to call the dentist tomorrow at 3pm, high priority" or "remind me to pay ' +
    `rent on the first"). Today's date is ${today}. Resolve relative dates ("tomorrow", "next ` +
    'Friday", "in two days") to absolute dates relative to today. Respond with ONLY strict JSON, ' +
    'no markdown fences, no commentary, in this exact shape: {"todos": [{"title": "Call the ' +
    'dentist", "due_date": "2026-06-23", "due_time": "15:00", "priority": "medium"}]}. "due_date" ' +
    'must be an ISO "YYYY-MM-DD" string or null if no date was mentioned. "due_time" must be a ' +
    '24-hour "HH:MM" string or null if no time was mentioned (never set a time without also ' +
    'setting a date). "priority" is "medium" by default, "high" if the speaker says "high ' +
    'priority", "urgent", or similar, and "low" if they say "low priority", "whenever", "no rush", ' +
    'or similar. If there are no to-do items, respond with {"todos": []}.'
  )
}

async function extractTodos(apiKey: string, transcript: string, today: string): Promise<Todo[]> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: buildSystemPrompt(today),
      messages: [{ role: 'user', content: transcript }],
    }),
  })

  if (!res.ok) {
    throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`)
  }

  const data: { content?: Array<{ text?: string }> } = await res.json()
  const text = data.content?.[0]?.text?.trim() ?? ''

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Claude returned non-JSON output')
  }

  const todos = (parsed as { todos?: unknown }).todos
  if (!Array.isArray(todos)) {
    throw new Error('Claude response missing todos array')
  }

  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  const timeRe = /^\d{2}:\d{2}$/

  return todos
    .filter((t): t is Todo => {
      if (typeof t !== 'object' || t === null) return false
      const { title, due_date, due_time, priority } = t as Todo
      if (typeof title !== 'string' || !title.trim()) return false
      if (due_date !== null && !dateRe.test(due_date)) return false
      if (due_time !== null && !timeRe.test(due_time)) return false
      if (!VALID_PRIORITIES.includes(priority)) return false
      return true
    })
    .map(t => ({ ...t, title: t.title.trim() }))
    .slice(0, MAX_TODOS)
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

  let body: { transcript?: string } = {}
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'INVALID_BODY' }), { status: 400 })
  }

  const transcript = body.transcript
  if (typeof transcript !== 'string' || !transcript.trim()) {
    return new Response(JSON.stringify({ error: 'INVALID_BODY' }), { status: 400 })
  }

  const today = new Date().toISOString().slice(0, 10)

  let todos: Todo[]
  try {
    todos = await extractTodos(anthropicApiKey, transcript, today)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: 'EXTRACTION_FAILED', message }), { status: 502 })
  }

  if (todos.length === 0) {
    return new Response(
      JSON.stringify({ todos: [], message: "I didn't catch any tasks in that." }),
      { status: 200 },
    )
  }

  const rows = todos.map(t => {
    const remindAt = t.due_date && t.due_time ? new Date(`${t.due_date}T${t.due_time}`).toISOString() : null
    return {
      user_id: auth.userId,
      title: t.title,
      due_date: t.due_date,
      due_time: t.due_date ? t.due_time : null,
      priority: t.priority,
      reminder_enabled: !!remindAt,
      remind_at: remindAt,
    }
  })

  const { data, error } = await auth.supabase.from('todos').insert(rows).select()

  if (error) {
    return new Response(JSON.stringify({ error: 'DB_ERROR' }), { status: 500 })
  }

  const summary = todos.map(t => t.title).join(', ')
  const message = `Added ${todos.length} task${todos.length === 1 ? '' : 's'}: ${summary}.`
  return new Response(JSON.stringify({ todos: data, message }), { status: 200 })
})
