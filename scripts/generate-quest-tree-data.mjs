import { writeFileSync } from 'node:fs'

// Regenerates the quest prerequisite data behind the Quests tab's tree view:
//   src/features/runescape/quest-tree-data.ts
//
// Source: https://runescape.wiki/w/Module:Questreq/data. Every quest page's "Quests:" requirement list is
// generated from it, so it is the wiki's own record of which quests must be completed before another can be started.
// Each quest is listed once with its direct prerequisites; the wiki expands the sub-requirements by recursion.
//
// Entry syntax (see https://runescape.wiki/w/Module:Questreq/data):
//   ["Quest"] = {"A", "Partial:B", "Full:C", "Misc:..."}   A must be completed; B only partly; C to 100%; Misc is not a quest
//   ["Follows:Quest"] = {...}                              quests recommended for the story, not required to start
//   ["Full:Quest"] = {...}                                 extra requirements for full completion, not to start
// The tree only needs what is required to start, so the last two kinds of key are left out.
//
// The wiki names pages differently from the game in a few places (RuneMetrics, and so the app's quest list, uses the
// in-game title), so titles are mapped to in-game titles below.
//
//   node scripts/generate-quest-tree-data.mjs

const UA = 'personal-dashboard (rs3 tracker)' // same as api/runescape.ts; the wiki rejects generic user agents
const API = 'https://runescape.wiki/api.php'
const OUT = new URL('../src/features/runescape/quest-tree-data.ts', import.meta.url)

const sleep = ms => new Promise(r => setTimeout(r, ms))
const quote = s => {
  const escaped = s.replace(/\\/g, '\\\\')
  return s.includes("'") && !s.includes('"') ? `"${escaped}"` : `'${escaped.replace(/'/g, "\\'")}'`
}

async function moduleSource(title) {
  const url = `${API}?${new URLSearchParams({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', titles: title, format: 'json', formatversion: '2' })}`
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
      if (!res.ok) throw new Error(`Wiki responded ${res.status}`)
      const content = (await res.json()).query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content
      if (!content) throw new Error('No page content')
      return content
    } catch (err) {
      if (attempt >= 3) throw new Error(`${title}: ${err.message}`)
      await sleep(1000 * attempt)
    }
  }
}

// ---- Parse the Lua table. One entry per line: ["Quest"] = {"a", "b"},
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

// ---- Wiki title -> in-game title.
const gameTitle = title => title
  .replace(/ \(quest\)$/, '') // disambiguation: "Tears of Guthix (quest)"
  .replace(/^(?:Once Upon a Time in Gielinor|That Old Black Magic): /, '') // the game lists these chapters by their own names
  .replace(/^(Father and Son|Helping Laniakea) \(miniquest\)$/, '$1') // the game doesn't mark these as miniquests

// Pages in the module that aren't quests.
const NOT_A_QUEST = /\/Wish list$|\(lore activity\)$/

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

// ---- Write the data file.
const names = [...prerequisites.keys()].sort((a, b) => a.localeCompare(b, 'en'))
const rows = names.map(name => `  ${quote(name)}: [${prerequisites.get(name).map(quote).join(', ')}],`)
const edges = [...prerequisites.values()].reduce((n, list) => n + list.length, 0)

writeFileSync(OUT, `// Generated by scripts/generate-quest-tree-data.mjs — do not edit by hand.
// Source: https://runescape.wiki/w/Module:Questreq/data, the table behind the "Quests:" requirement list on every quest page.
// Fetched ${new Date().toISOString().slice(0, 10)}.

/**
 * Quest title → the quests that must be completed before it can be started, as in-game titles (the ones RuneMetrics reports).
 * A "Partial:" prefix means only part of that quest is needed; "Full:" means it must be completed to 100%.
 * Quests with no prerequisites aren't listed.
 */
export const QUEST_PREREQUISITES: Record<string, string[]> = {
${rows.join('\n')}
}
`)

console.log(`Wrote ${names.length} quests with prerequisites (${edges} prerequisite links) to ${OUT.pathname}`)
