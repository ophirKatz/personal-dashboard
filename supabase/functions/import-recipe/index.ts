import { createClient } from 'npm:@supabase/supabase-js@2'

type Mode = 'prompt' | 'paste' | 'link'

const MAX_INPUT_LENGTH = 20_000
const MAX_PAGE_BYTES = 500_000
const MAX_PAGE_TEXT_LENGTH = 15_000
const FETCH_TIMEOUT_MS = 10_000

const MAX_TITLE_LENGTH = 200
const MAX_DESCRIPTION_LENGTH = 2000
const MAX_INGREDIENTS = 60
const MAX_STEPS = 60
const MAX_STEP_LENGTH = 2000
const MAX_NOTE_LENGTH = 200
const MAX_COLLECTIONS = 8

// Keep in sync by hand with UNIT_OPTIONS in src/features/recipes/units.ts —
// Deno edge functions can't import from src/, so this list is duplicated.
const UNIT_VOCABULARY = [
  'cup', 'tablespoon', 'teaspoon', 'pinch', 'milliliter', 'liter', 'gram', 'kilogram',
  'ounce', 'pound', 'clove', 'whole', 'slice', 'can', 'pack',
]

type RawIngredient = { quantity?: unknown; unit?: unknown; name?: unknown; note?: unknown }
type RecipeDraft = {
  title: string
  description: string | null
  servings: number
  ingredients: Array<{ quantity: number | null; unit: string | null; name: string; note: string | null }>
  steps: string[]
  suggested_collections: string[]
}

const SYSTEM_PROMPT =
  'You extract or invent cooking recipes for a recipe-keeping app. Respond with ONLY strict JSON, no ' +
  'markdown fences, no commentary, in this exact shape:\n' +
  '{"title": string, "description": string|null, "servings": number, ' +
  '"ingredients": [{"quantity": number|null, "unit": string|null, "name": string, "note": string|null}], ' +
  '"steps": [string], "suggested_collections": [string]}\n' +
  `- "unit" must be the closest match from this vocabulary, or null if none fits: ${UNIT_VOCABULARY.join(', ')}. ` +
  'Fold any other size/prep qualifier (e.g. "diced", "to taste", "for the poolish") into "note" instead.\n' +
  '- Convert written fractions ("1/2", "a half") to decimal "quantity" (e.g. 0.5).\n' +
  '- "quantity" is null when there is no sensible amount (e.g. "salt, to taste").\n' +
  '- "steps" are short, clear, ordered instructions, one step per array entry.\n' +
  '- "suggested_collections" is 1-4 short category names for this recipe (e.g. "Baking", "Dessert", "Weeknight").\n' +
  '- "servings" is a whole number of servings this recipe makes; default to 4 if unclear.'

function modePreamble(mode: Mode): string {
  if (mode === 'prompt') {
    return 'The user describes a dish they want. Invent a complete, plausible, well-formed recipe for it.'
  }
  return (
    'The user provided recipe text (possibly copy-pasted from a webpage, with unrelated boilerplate mixed in). ' +
    'Extract and normalize it faithfully — do not invent ingredients or steps that are not implied by the text.'
  )
}

function stripHtml(html: string): string {
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  const withoutTags = withoutScripts.replace(/<[^>]+>/g, ' ')
  return withoutTags.replace(/\s+/g, ' ').trim().slice(0, MAX_PAGE_TEXT_LENGTH)
}

async function fetchAndStripPage(url: string): Promise<string> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Invalid URL')
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Invalid URL')
  }

  const res = await fetch(parsed.toString(), {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; PersonalDashboardRecipeImport/1.0)' },
  })
  if (!res.ok) {
    throw new Error(`Could not fetch page (HTTP ${res.status})`)
  }
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('text/html') && !contentType.includes('text')) {
    throw new Error('URL did not return an HTML page')
  }

  const buf = await res.arrayBuffer()
  const bytes = buf.byteLength > MAX_PAGE_BYTES ? buf.slice(0, MAX_PAGE_BYTES) : buf
  const html = new TextDecoder('utf-8').decode(bytes)
  return stripHtml(html)
}

async function callClaude(apiKey: string, mode: Mode, input: string): Promise<string> {
  const userMessage = `${modePreamble(mode)}\n\n---\n${input}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3072,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
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

function clampString(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function toDraft(raw: string): RecipeDraft {
  const parsed = JSON.parse(extractJson(raw)) as {
    title?: unknown
    description?: unknown
    servings?: unknown
    ingredients?: unknown
    steps?: unknown
    suggested_collections?: unknown
  }

  const title = clampString(parsed.title, MAX_TITLE_LENGTH) || 'Untitled recipe'
  const description = clampString(parsed.description, MAX_DESCRIPTION_LENGTH) || null

  const servingsNum = Number(parsed.servings)
  const servings = Number.isFinite(servingsNum) ? Math.min(100, Math.max(1, Math.round(servingsNum))) : 4

  const rawIngredients = Array.isArray(parsed.ingredients) ? parsed.ingredients : []
  const ingredients = rawIngredients
    .slice(0, MAX_INGREDIENTS)
    .map((item): RecipeDraft['ingredients'][number] | null => {
      const raw = item as RawIngredient
      const name = clampString(raw.name, MAX_TITLE_LENGTH)
      if (!name) return null
      const quantityNum = Number(raw.quantity)
      const quantity = raw.quantity != null && Number.isFinite(quantityNum) ? quantityNum : null
      const unit = clampString(raw.unit, 40) || null
      const note = clampString(raw.note, MAX_NOTE_LENGTH) || null
      return { quantity, unit, name, note }
    })
    .filter((item): item is RecipeDraft['ingredients'][number] => item !== null)

  const rawSteps = Array.isArray(parsed.steps) ? parsed.steps : []
  const steps = rawSteps
    .map(step => clampString(step, MAX_STEP_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_STEPS)

  const rawCollections = Array.isArray(parsed.suggested_collections) ? parsed.suggested_collections : []
  const suggested_collections = rawCollections
    .map(name => clampString(name, 40))
    .filter(Boolean)
    .slice(0, MAX_COLLECTIONS)

  return { title, description, servings, ingredients, steps, suggested_collections }
}

Deno.serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'MISSING_CONFIG' }), { status: 500 })
  }

  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const jwt = authHeader.slice('Bearer '.length)
  const { data: userData, error: userError } = await supabase.auth.getUser(jwt)
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401 })
  }

  if (!anthropicApiKey) {
    return new Response(JSON.stringify({ error: 'MISSING_ANTHROPIC_API_KEY' }), { status: 500 })
  }

  let body: { mode?: string; input?: string } = {}
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'INVALID_BODY' }), { status: 400 })
  }

  const { mode, input } = body
  if (mode !== 'prompt' && mode !== 'paste' && mode !== 'link') {
    return new Response(JSON.stringify({ error: 'INVALID_MODE' }), { status: 400 })
  }
  if (typeof input !== 'string' || !input.trim()) {
    return new Response(JSON.stringify({ error: 'INVALID_BODY' }), { status: 400 })
  }
  if (input.length > MAX_INPUT_LENGTH) {
    return new Response(JSON.stringify({ error: 'INPUT_TOO_LARGE' }), { status: 413 })
  }

  let sourceText: string
  let sourceUrl: string | null = null
  try {
    if (mode === 'link') {
      sourceUrl = input.trim()
      sourceText = await fetchAndStripPage(sourceUrl)
      if (!sourceText) throw new Error('Could not read any content from that page')
    } else {
      sourceText = input.trim()
    }
  } catch (err) {
    console.error('import-recipe: link fetch failed for user', userData.user.id, sourceUrl, err)
    const message = err instanceof Error ? err.message : 'Could not read that link'
    return new Response(JSON.stringify({ error: 'FETCH_FAILED', message }), { status: 502 })
  }

  let draft: RecipeDraft
  try {
    const raw = await callClaude(anthropicApiKey, mode, sourceText)
    draft = toDraft(raw)
  } catch (err) {
    console.error('import-recipe: import failed for user', userData.user.id, mode, err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: 'IMPORT_FAILED', message }), { status: 502 })
  }

  if (draft.ingredients.length === 0 && draft.steps.length === 0) {
    return new Response(JSON.stringify({ error: 'NO_RECIPE_FOUND' }), { status: 422 })
  }

  return new Response(JSON.stringify({ draft, source_url: sourceUrl }), { status: 200 })
})
