import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'

const MAX_ITEMS = 50

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
  'You extract shopping list items from a short spoken transcript (it may be informal or run-on, ' +
  'dictated by voice). Respond with ONLY strict JSON, no markdown fences, no commentary, in this ' +
  'exact shape: {"items": ["item one", "item two"]}. Each item should be a short, clean string ' +
  '(e.g. "Milk", "Eggs x2", "Olive oil"). Split on natural list boundaries ("and", commas, "also"). ' +
  'If the transcript contains no shopping items, respond with {"items": []}.'

async function extractItems(apiKey: string, transcript: string): Promise<string[]> {
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

  const items = (parsed as { items?: unknown }).items
  if (!Array.isArray(items)) {
    throw new Error('Claude response missing items array')
  }

  return items
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, MAX_ITEMS)
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

  let names: string[]
  try {
    names = await extractItems(anthropicApiKey, transcript)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: 'EXTRACTION_FAILED', message }), { status: 502 })
  }

  if (names.length === 0) {
    return new Response(
      JSON.stringify({ items: [], message: "I didn't catch any shopping items in that." }),
      { status: 200 },
    )
  }

  const { data, error } = await auth.supabase
    .from('shopping_items')
    .insert(names.map(name => ({ user_id: auth.userId, name })))
    .select()

  if (error) {
    return new Response(JSON.stringify({ error: 'DB_ERROR' }), { status: 500 })
  }

  const message = `Added ${names.join(', ')} to your shopping list.`
  return new Response(JSON.stringify({ items: data, message }), { status: 200 })
})
