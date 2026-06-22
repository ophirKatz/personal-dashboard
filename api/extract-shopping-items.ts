import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateRequest } from './_supabaseAuth.js'

const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_BASE64_LENGTH = 6_000_000 // ~4.5MB decoded, under Vercel's request body limit
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
    return
  }

  const auth = await authenticateRequest(req)
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error })
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'MISSING_ANTHROPIC_API_KEY' })
    return
  }

  const { image, mediaType } = req.body ?? {}
  if (typeof image !== 'string' || !image) {
    res.status(400).json({ error: 'INVALID_BODY' })
    return
  }
  if (typeof mediaType !== 'string' || !ALLOWED_MEDIA_TYPES.has(mediaType)) {
    res.status(400).json({ error: 'UNSUPPORTED_MEDIA_TYPE' })
    return
  }
  if (image.length > MAX_BASE64_LENGTH) {
    res.status(413).json({ error: 'IMAGE_TOO_LARGE' })
    return
  }

  let names: string[]
  try {
    names = await callClaude(apiKey, image, mediaType)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(502).json({ error: 'EXTRACTION_FAILED', message })
    return
  }

  if (names.length === 0) {
    res.status(200).json({ items: [] })
    return
  }

  const { data, error } = await auth.supabase
    .from('shopping_items')
    .insert(names.map(name => ({ user_id: auth.userId, name })))
    .select()

  if (error) {
    res.status(500).json({ error: 'DB_ERROR' })
    return
  }

  res.status(200).json({ items: data })
}
