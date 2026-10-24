import { writeFileSync } from 'node:fs'

// Regenerates the quest requirement data behind the Quests tab's tree views and "available" marks:
//   src/features/runescape/quest-requirements-data.ts
//
// Prerequisite quests: https://runescape.wiki/w/Module:Questreq/data. Every quest page's "Quests:" requirement list is
// generated from it, so it is the wiki's own record of which quests must be completed before another can be started.
// Each quest is listed once with its direct prerequisites; the wiki expands the sub-requirements by recursion.
//
// Entry syntax (see https://runescape.wiki/w/Module:Questreq/data):
//   ["Quest"] = {"A", "Partial:B", "Full:C", "Misc:..."}   A must be completed; B only partly; C to 100%; Misc is not a quest
//   ["Follows:Quest"] = {...}                              quests recommended for the story, not required to start
//   ["Full:Quest"] = {...}                                 extra requirements for full completion, not to start
// The tree only needs what is required to start, so the last two kinds of key are left out.
//
// Skill levels and quest points: the "requirements" text of every quest in the wiki's quest bucket, the same text
// https://runescape.wiki/w/Module:Quest_skill_requirement reads. Each one is a <span class="skillreq" data-skill data-level>.
// Left out, because they can't be checked against a character's levels:
//   - requirements the wiki marks "not required to start"
//   - a requirement with a non-level alternative ("or a deathtouched dart") and the Warriors' Guild entry rule
// Several spans on one line joined by "or" mean any one of them is enough.
//
// The wiki names pages differently from the game in a few places (RuneMetrics, and so the app's quest list, uses the
// in-game title), so titles are mapped to in-game titles below.
//
//   node scripts/generate-quest-requirements-data.mjs

const UA = 'personal-dashboard (rs3 tracker)' // same as api/runescape.ts; the wiki rejects generic user agents
const API = 'https://runescape.wiki/api.php'
const OUT = new URL('../src/features/runescape/quest-requirements-data.ts', import.meta.url)

const sleep = ms => new Promise(r => setTimeout(r, ms))
const quote = s => {
  const escaped = s.replace(/\\/g, '\\\\')
  return s.includes("'") && !s.includes('"') ? `"${escaped}"` : `'${escaped.replace(/'/g, "\\'")}'`
}

async function wiki(label, params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
      if (!res.ok) throw new Error(`Wiki responded ${res.status}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error.info ?? data.error.code)
      return data
    } catch (err) {
      if (attempt >= 3) throw new Error(`${label}: ${err.message}`)
      await sleep(1000 * attempt)
    }
  }
}

async function moduleSource(title) {
  const data = await wiki(title, { action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', titles: title })
  const content = data.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content
  if (!content) throw new Error(`${title}: no page content`)
  return content
}

// Bucket queries are capped per request, so read them a page at a time.
async function questBucket() {
  const PAGE = 500
  const rows = []
  for (let offset = 0; ; offset += PAGE) {
    const query = `bucket('quest').select('page_name','requirements').limit(${PAGE}).offset(${offset}).run()`
    const { bucket } = await wiki('quest bucket', { action: 'bucket', query })
    if (!Array.isArray(bucket)) throw new Error('Unexpected reply from the quest bucket')
    rows.push(...bucket)
    if (bucket.length < PAGE) return rows
  }
}

// ---- Wiki title -> in-game title.
const gameTitle = title => title
  .replace(/ \(quest\)$/, '') // disambiguation: "Tears of Guthix (quest)"
  .replace(/^(?:Once Upon a Time in Gielinor|That Old Black Magic): /, '') // the game lists these chapters by their own names
  .replace(/^(Father and Son|Helping Laniakea) \(miniquest\)$/, '$1') // the game doesn't mark these as miniquests

// Pages in the module that aren't quests.
const NOT_A_QUEST = /\/Wish list$|\(lore activity\)$/

// ---- Prerequisite quests: parse the Lua table. One entry per line: ["Quest"] = {"a", "b"},
const unescapeLua = s => s.replace(/\\(.)/g, '$1')
const source = await moduleSource('Module:Questreq/data')
const entries = new Map()
for (const line of source.split('\n')) {
  if (!/^\s*\["/.test(line)) continue
  const m = line.match(/^\s*\["((?:[^"\\]|\\.)*)"\]\s*=\s*\{(.*)\},?\s*(?:--.*)?$/)
  if (!m) throw new Error(`Unrecognised entry in Module:Questreq/data: ${line}`)
  const items = [...m[2].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(x => unescapeLua(x[1]))
  entries.set(unescapeLua(m[1]), items)
}
if (entries.size < 300) throw new Error(`Only found ${entries.size} entries in Module:Questreq/data`)

// A quest listed both ways (e.g. "Missing My Mummy" and "Full:Missing My Mummy") needs the stricter one.
const STRICTNESS = { partial: 0, complete: 1, full: 2 }

const prerequisites = new Map()
for (const [key, items] of entries) {
  if (/^(Follows|Full):/.test(key) || NOT_A_QUEST.test(key)) continue
  const needed = new Map() // in-game title -> mode
  for (const item of items) {
    if (item.startsWith('Misc:')) continue
    const mode = item.startsWith('Partial:') ? 'partial' : item.startsWith('Full:') ? 'full' : 'complete'
    const title = gameTitle(item.replace(/^(?:Partial|Full):/, ''))
    if (!needed.has(title) || STRICTNESS[mode] > STRICTNESS[needed.get(title)]) needed.set(title, mode)
  }
  if (needed.size === 0) continue
  prerequisites.set(gameTitle(key), [...needed].map(([title, mode]) => (mode === 'complete' ? title : `${mode === 'partial' ? 'Partial' : 'Full'}:${title}`)))
}

// ---- Sanity checks: a quest can't (transitively) require itself.
const nameOf = item => item.replace(/^(?:Partial|Full):/, '')
const visiting = new Set()
const done = new Set()
const visit = (title, trail) => {
  if (done.has(title)) return
  if (visiting.has(title)) throw new Error(`Prerequisite cycle: ${[...trail, title].join(' -> ')}`)
  visiting.add(title)
  for (const item of prerequisites.get(title) ?? []) visit(nameOf(item), [...trail, title])
  visiting.delete(title)
  done.add(title)
}
for (const title of prerequisites.keys()) visit(title, [])

// ---- Skill levels and quest points, from the requirement text of each quest page.
const SKILLS = new Set([
  'Agility', 'Archaeology', 'Attack', 'Constitution', 'Construction', 'Cooking', 'Crafting', 'Defence', 'Divination',
  'Dungeoneering', 'Farming', 'Firemaking', 'Fishing', 'Fletching', 'Herblore', 'Hunter', 'Invention', 'Magic', 'Mining',
  'Necromancy', 'Prayer', 'Ranged', 'Runecrafting', 'Slayer', 'Smithing', 'Strength', 'Summoning', 'Thieving', 'Woodcutting',
])
const SPAN = /<span class="skillreq"[^>]*?data-skill="([^"]*)"[^>]*?data-level="(\d+)"[^>]*>.*?<\/span>/gs
const NOT_TO_START = /can be started without this requirement/
const skillName = raw => (raw.toLowerCase() === 'quest points' ? 'Quest points' : raw[0].toUpperCase() + raw.slice(1).toLowerCase())

// The text of a line besides its skill spans and their markers, without the list bullet or the "or" between spans.
const leftover = line => line
  .replace(SPAN, '')
  .replace(/<sup>.*?<\/sup>/gs, '')
  .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
  .replace(/<br\s*\/?>/g, ' ')
  .replace(/^\s*\*/, '')
  .replace(/\s+/g, ' ')
  .trim()

/** The "Skill level" strings for one quest's requirement text. */
function skillRequirements(text) {
  const out = []
  for (const line of text.split('\n')) {
    // Past this heading the quest page lists what is only needed to finish the quest.
    if (/following are not required to/i.test(line)) break
    const spans = [...line.matchAll(SPAN)]
    if (spans.length === 0) continue
    if (NOT_TO_START.test(line)) continue
    const rest = leftover(line)
    if (spans.length === 1 && /\bor\b/i.test(rest)) continue // "or a deathtouched dart"
    // The Warriors' Guild rule (Attack + Strength >= 130, or either at 99) leaves text besides the "or"s.
    if (spans.length > 1 && rest.replace(/''or''/g, '').trim()) continue
    const needs = spans.map(m => {
      const skill = skillName(m[1])
      if (skill !== 'Quest points' && !SKILLS.has(skill)) throw new Error(`Unknown skill "${m[1]}"`)
      return `${skill} ${Number(m[2])}`
    })
    out.push(needs.join(' or '))
  }
  return out
}

const skills = new Map()
for (const row of await questBucket()) {
  const title = gameTitle(row.page_name)
  if (NOT_A_QUEST.test(row.page_name) || !row.requirements) continue
  const needs = skillRequirements(row.requirements)
  if (needs.length > 0) skills.set(title, needs)
}
if (skills.size < 150) throw new Error(`Only found skill requirements for ${skills.size} quests`)

// ---- Write the data file.
const sorted = map => [...map.keys()].sort((a, b) => a.localeCompare(b, 'en'))
const rows = map => sorted(map).map(name => `  ${quote(name)}: [${map.get(name).map(quote).join(', ')}],`)
const count = map => [...map.values()].reduce((n, list) => n + list.length, 0)

writeFileSync(OUT, `// Generated by scripts/generate-quest-requirements-data.mjs — do not edit by hand.
// Source: https://runescape.wiki/w/Module:Questreq/data (prerequisite quests, the table behind the "Quests:" requirement list
// on every quest page) and the requirement text of each quest page (skill levels and quest points).
// Fetched ${new Date().toISOString().slice(0, 10)}.

/**
 * Quest title → the quests that must be completed before it can be started, as in-game titles (the ones RuneMetrics reports).
 * A "Partial:" prefix means only part of that quest is needed; "Full:" means it must be completed to 100%.
 * Quests with no prerequisites aren't listed.
 */
export const QUEST_PREREQUISITES: Record<string, string[]> = {
${rows(prerequisites).join('\n')}
}

/**
 * Quest title → the skill levels and quest points needed to start it, written as on the quest's wiki page:
 * "Magic 70", "Quest points 33", or "Strength 60 or Agility 60" when any one of several will do.
 * Requirements the wiki says aren't needed to start, or that can be met without the level, are left out.
 * Quests with none aren't listed.
 */
export const QUEST_SKILL_REQUIREMENTS: Record<string, string[]> = {
${rows(skills).join('\n')}
}
`)

console.log(`Wrote prerequisites for ${prerequisites.size} quests (${count(prerequisites)} links) and skill requirements for ${skills.size} quests (${count(skills)} requirements) to ${OUT.pathname}`)
