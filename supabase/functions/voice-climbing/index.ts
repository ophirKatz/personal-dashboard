import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'

const MAX_ATTEMPTS = 50
const VALID_GRADES = ['v0-1', 'v1-2', 'v2-3', 'v3-4', 'v4-5', 'v5-6', 'v6-7', 'v7-8', 'v8-9', 'v9-10']

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

const SYSTEM_PROMPT =
  'You extract bouldering climbing attempts from a short spoken transcript dictated right after a ' +
  'climbing session (e.g. "three v three, one v five six, fell on a v six seven"). Grades are spoken ' +
  'as a single V-grade or a range ("five six" means V5/6) and must be normalized to one of these exact ' +
  `bands: ${VALID_GRADES.join(', ')} (round a single grade to its nearest band, e.g. spoken "v4" -> ` +
  '"v3-4" or "v4-5", picking whichever is closer; prefer the lower band on a tie). Each attempt has a ' +
  'result: "sent" by default, or "project" if the speaker says they fell, failed, didn\'t finish, or ' +
  'it\'s still a project. Respond with ONLY strict JSON, no markdown fences, no commentary, in this ' +
  'exact shape: {"attempts": [{"grade": "v3-4", "result": "sent"}]}. If there are no climbing ' +
  'attempts, respond with {"attempts": []}.'

type Attempt = { grade: string; result: 'sent' | 'project' }

async function extractAttempts(apiKey: string, transcript: string): Promise<Attempt[]> {
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
      system: SYSTEM_PROMPT,
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

  const attempts = (parsed as { attempts?: unknown }).attempts
  if (!Array.isArray(attempts)) {
    throw new Error('Claude response missing attempts array')
  }

  return attempts
    .filter((a): a is Attempt => {
      if (typeof a !== 'object' || a === null) return false
      const { grade, result } = a as Attempt
      return VALID_GRADES.includes(grade) && (result === 'sent' || result === 'project')
    })
    .slice(0, MAX_ATTEMPTS)
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

  let attempts: Attempt[]
  try {
    attempts = await extractAttempts(anthropicApiKey, transcript)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: 'EXTRACTION_FAILED', message }), { status: 502 })
  }

  if (attempts.length === 0) {
    return new Response(
      JSON.stringify({ attempts: [], message: "I didn't catch any climbs in that." }),
      { status: 200 },
    )
  }

  const sessionDate = new Date().toISOString().slice(0, 10)

  const { data: session, error: sessionError } = await auth.supabase
    .from('climbing_sessions')
    .insert({ session_date: sessionDate, notes: null, user_id: auth.userId })
    .select()
    .single()

  if (sessionError || !session) {
    return new Response(JSON.stringify({ error: 'DB_ERROR' }), { status: 500 })
  }

  const { data, error } = await auth.supabase
    .from('climbing_attempts')
    .insert(attempts.map(a => ({ ...a, session_id: session.id, user_id: auth.userId })))
    .select()

  if (error) {
    return new Response(JSON.stringify({ error: 'DB_ERROR' }), { status: 500 })
  }

  const summary = attempts.map(a => `${a.grade}${a.result === 'project' ? ' (project)' : ''}`).join(', ')
  const message = `Logged ${attempts.length} climb${attempts.length === 1 ? '' : 's'}: ${summary}.`
  return new Response(JSON.stringify({ attempts: data, message }), { status: 200 })
})
