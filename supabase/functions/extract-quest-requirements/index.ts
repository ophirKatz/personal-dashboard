import { createClient } from 'npm:@supabase/supabase-js@2'

const MAX_QUESTS = 25
const MAX_TEXT_LENGTH = 3000
const MAX_NAME_LENGTH = 120
const MAX_SKILL_LEVEL = 150
const MAX_LIST_ITEMS = 40

// Keep in sync by hand with SKILLS in src/features/runescape/skills.ts —
// Deno edge functions can't import from src/, so this list is duplicated.
const SKILLS = [
  'Attack', 'Defence', 'Strength', 'Constitution', 'Ranged', 'Prayer', 'Magic', 'Cooking', 'Woodcutting',
  'Fletching', 'Fishing', 'Firemaking', 'Crafting', 'Smithing', 'Mining', 'Herblore', 'Agility', 'Thieving',
  'Slayer', 'Farming', 'Runecrafting', 'Hunter', 'Construction', 'Summoning', 'Dungeoneering', 'Divination',
  'Invention', 'Archaeology', 'Necromancy',
]
const SKILL_LOOKUP = new Map(SKILLS.map(s => [s.toLowerCase(), s]))

type Requirements = {
  skills: Array<{ skill: string; level: number }>
  quests: string[]
  other: string[]
}

const SYSTEM_PROMPT =
  'You read the "Requirements" text of RuneScape 3 quests (from the RuneScape Wiki) and turn each into structured data. ' +
  'Respond with ONLY strict JSON, no markdown fences, no commentary, in this exact shape:\n' +
  '{"results": [{"id": number, "skills": [{"skill": string, "level": number}], "quests": [string], "other": [string]}]}\n' +
  'Return one result per input quest, using the same "id".\n' +
  `- "skills": a minimum skill level needed. "skill" must be one of: ${SKILLS.join(', ')}. ` +
  'If the text says a level can be boosted, still list the level. If several levels are given for one skill, use the highest.\n' +
  '- "quests": the full names of other quests (or miniquests) that must be completed first, without any "(partial)" or "started" qualifiers. ' +
  'If a quest only needs to be started, still list it.\n' +
  '- "other": every requirement that is neither a skill level nor a quest (quest points, combat level, membership, items, access to an area, etc.), as short strings.\n' +
  '- The text is one line per requirement. Indentation shows a prerequisite tree: the quest itself is often the top line, its indented lines are its DIRECT requirements, ' +
  'and deeper indentation lists those quests\' own prerequisites. Only report DIRECT requirements (and never the quest itself); ignore the deeper levels. ' +
  'Lines such as "Complete the X mystery" or "Meet Y in Z" are requirements for "other" unless they are plainly a quest name.\n' +
  '- "None" or empty requirements means all three arrays are empty.\n' +
  '- Only use information present in the text. Do not invent requirements.'

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders() },
  })
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return (fenced ? fenced[1] : text).trim()
}

function clampString(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function stringList(value: unknown, maxLength: number): string[] {
  if (!Array.isArray(value)) return []
  return value.map(v => clampString(v, maxLength)).filter(Boolean).slice(0, MAX_LIST_ITEMS)
}

function toRequirements(raw: Record<string, unknown>): Requirements {
  const skills: Requirements['skills'] = []
  const seen = new Set<string>()
  for (const item of Array.isArray(raw.skills) ? raw.skills : []) {
    const entry = item as { skill?: unknown; level?: unknown }
    const skill = SKILL_LOOKUP.get(clampString(entry.skill, 40).toLowerCase())
    const level = Math.round(Number(entry.level))
    // Drop made-up skills and nonsense levels instead of passing them on.
    if (!skill || seen.has(skill) || !Number.isFinite(level) || level < 1 || level > MAX_SKILL_LEVEL) continue
    seen.add(skill)
    skills.push({ skill, level })
  }
  return { skills, quests: stringList(raw.quests, MAX_NAME_LENGTH), other: stringList(raw.other, 200) }
}

async function callClaude(apiKey: string, quests: Array<{ id: number; name: string; text: string }>): Promise<string> {
  const userMessage = quests.map(q => `### id ${q.id}: ${q.name}\n${q.text}`).join('\n\n')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8192,
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')

  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'MISSING_CONFIG' }, 500)

  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'UNAUTHORIZED' }, 401)

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.slice('Bearer '.length))
  if (userError || !userData.user) return json({ error: 'UNAUTHORIZED' }, 401)

  if (!anthropicApiKey) return json({ error: 'MISSING_ANTHROPIC_API_KEY' }, 500)

  let body: { quests?: unknown } = {}
  try {
    body = await req.json()
  } catch {
    return json({ error: 'INVALID_BODY' }, 400)
  }

  if (!Array.isArray(body.quests) || body.quests.length === 0) return json({ error: 'INVALID_BODY' }, 400)
  if (body.quests.length > MAX_QUESTS) return json({ error: 'INPUT_TOO_LARGE' }, 413)

  const quests = body.quests.map((q, id) => {
    const entry = q as { name?: unknown; text?: unknown }
    return { id, name: clampString(entry.name, MAX_NAME_LENGTH), text: clampString(entry.text, MAX_TEXT_LENGTH) }
  })
  if (quests.some(q => !q.name)) return json({ error: 'INVALID_BODY' }, 400)

  try {
    const raw = await callClaude(anthropicApiKey, quests)
    const parsed = JSON.parse(extractJson(raw)) as { results?: unknown }
    const results: Array<Record<string, unknown>> = Array.isArray(parsed.results) ? parsed.results : []
    const byId = new Map(results.map(r => [Number(r.id), r]))
    // Quests the model skipped come back as null so the client can say "unavailable" instead of "none".
    const requirements = quests.map(q => {
      const r = byId.get(q.id)
      return r ? toRequirements(r) : null
    })
    return json({ requirements })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return json({ error: 'EXTRACT_FAILED', message }, 502)
  }
})
