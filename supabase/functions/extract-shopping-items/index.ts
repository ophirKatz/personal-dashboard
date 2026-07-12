import { createClient } from 'npm:@supabase/supabase-js@2'

const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_BASE64_LENGTH = 6_000_000 // ~4.5MB decoded
const MAX_ITEMS = 100

const SYSTEM_PROMPT =
  'You extract shopping list items from a photo (e.g. a handwritten list, a printed receipt, or a ' +
  'recipe ingredients section). Respond with ONLY strict JSON, no markdown fences, no commentary, in ' +
  'this exact shape: {"items": ["item one", "item two"]}. Each item should be a short, clean string ' +
  '(e.g. "Milk", "Eggs x2", "Olive oil"). Skip anything that is not a shopping item. If you cannot find ' +
  'any items, respond with {"items": []}.'

async function callClaude(apiKey: string, base64: string, mediaType: string): Promise<string[]> {
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
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: 'Extract the shopping list items from this image.' },
          ],
        },
      ],
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

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'MISSING_CONFIG' }), {
      status: 500,
      headers: { 'content-type': 'application/json', ...corsHeaders() },
    })
  }

  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
      status: 401,
      headers: { 'content-type': 'application/json', ...corsHeaders() },
    })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const jwt = authHeader.slice('Bearer '.length)
  const { data: userData, error: userError } = await supabase.auth.getUser(jwt)
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
      status: 401,
      headers: { 'content-type': 'application/json', ...corsHeaders() },
    })
  }

  if (!anthropicApiKey) {
    return new Response(JSON.stringify({ error: 'MISSING_ANTHROPIC_API_KEY' }), {
      status: 500,
      headers: { 'content-type': 'application/json', ...corsHeaders() },
    })
  }

  let body: { image?: string; mediaType?: string } = {}
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'INVALID_BODY' }), {
      status: 400,
      headers: { 'content-type': 'application/json', ...corsHeaders() },
    })
  }

  const { image, mediaType } = body
  if (typeof image !== 'string' || !image) {
    return new Response(JSON.stringify({ error: 'INVALID_BODY' }), {
      status: 400,
      headers: { 'content-type': 'application/json', ...corsHeaders() },
    })
  }
  if (typeof mediaType !== 'string' || !ALLOWED_MEDIA_TYPES.has(mediaType)) {
    return new Response(JSON.stringify({ error: 'UNSUPPORTED_MEDIA_TYPE' }), {
      status: 400,
      headers: { 'content-type': 'application/json', ...corsHeaders() },
    })
  }
  if (image.length > MAX_BASE64_LENGTH) {
    return new Response(JSON.stringify({ error: 'IMAGE_TOO_LARGE' }), {
      status: 413,
      headers: { 'content-type': 'application/json', ...corsHeaders() },
    })
  }

  let names: string[]
  try {
    names = await callClaude(anthropicApiKey, image, mediaType)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: 'EXTRACTION_FAILED', message }), {
      status: 502,
      headers: { 'content-type': 'application/json', ...corsHeaders() },
    })
  }

  if (names.length === 0) {
    return new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json', ...corsHeaders() },
    })
  }

  const { data, error } = await supabase
    .from('shopping_items')
    .insert(names.map(name => ({ user_id: userData.user.id, name })))
    .select()

  if (error) {
    return new Response(JSON.stringify({ error: 'DB_ERROR' }), {
      status: 500,
      headers: { 'content-type': 'application/json', ...corsHeaders() },
    })
  }

  return new Response(JSON.stringify({ items: data }), {
    status: 200,
    headers: { 'content-type': 'application/json', ...corsHeaders() },
  })
})
