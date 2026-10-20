import { writeFileSync } from 'node:fs'

// Regenerates the Archaeology data used by the collections page from the RuneScape Wiki:
//   src/features/runescape/archaeology-data.ts            artefacts (with required counts and dig site) + collections
//   src/features/runescape/archaeology-mysteries-data.ts  mysteries (level, requirements, dig site, items, rewards)
//
// Artefacts and counts: the "Artefacts from <hotspot>" tables in the Methods section of
// https://runescape.wiki/w/Archaeology_training; "Needed" is how many of each are required.
// Collections: the "Collections" column of those tables. A collection can first be completed at the guide level
// of the last hotspot that supplies one of its artefacts, which is what the page's prose says too.
// Dig sites: the "Excavation hotspot" list. Mysteries: the "Mysteries" list plus each mystery's own page.
//
// The short "what it is / how to begin" text for each mystery is written by hand in archaeology-mystery-notes.ts.
//
//   node scripts/generate-archaeology-data.mjs

const UA = 'personal-dashboard (rs3 tracker)' // same as api/runescape.ts; the wiki rejects generic user agents
const API = 'https://runescape.wiki/api.php'
const OUT_DATA = new URL('../src/features/runescape/archaeology-data.ts', import.meta.url)
const OUT_MYSTERIES = new URL('../src/features/runescape/archaeology-mysteries-data.ts', import.meta.url)

const sleep = ms => new Promise(r => setTimeout(r, ms))
const clean = s => s.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim()
const dash = s => s.trim().replace(/\s*[-–—]\s*/g, '–') // the wiki mixes hyphens, en dashes and em dashes
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const quote = s => {
  const escaped = s.replace(/\\/g, '\\\\')
  return s.includes("'") && !s.includes('"') ? `"${escaped}"` : `'${escaped.replace(/'/g, "\\'")}'`
}
const list = a => `[${a.map(quote).join(', ')}]`

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', redirects: '1', ...params })}`
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
      if (!res.ok) throw new Error(`Wiki responded ${res.status}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error.info)
      return data
    } catch (err) {
      if (attempt >= 3) throw new Error(`${params.page}: ${err.message}`)
      await sleep(1000 * attempt)
    }
  }
}

async function sectionHtml(page, heading) {
  const { parse } = await api({ action: 'parse', page, prop: 'sections' })
  const section = parse.sections.find(s => s.line === heading)
  if (!section) throw new Error(`No "${heading}" section on ${page}`)
  return (await api({ action: 'parse', page, prop: 'text', section: section.index })).parse.text
}

const pageHtml = async page => (await api({ action: 'parse', page, prop: 'text' })).parse.text

// ---- Fetch everything first. jsdom swaps out Node's global fetch dispatcher, which stops NODE_USE_ENV_PROXY from applying.
const methodsHtml = await sectionHtml('Archaeology_training', 'Methods')
const hotspotsHtml = await sectionHtml('Excavation_hotspot', 'List of excavation hotspots')
const mysteriesHtml = await pageHtml('Mysteries')
const mysteryTitles = [...mysteriesHtml.matchAll(/<tr>\s*<td><a href="\/w\/([^"#]+)"[^>]*>[^<]+<\/a>/g)].map(m => decodeURIComponent(m[1]))
if (mysteryTitles.length === 0) throw new Error('Found no mysteries in the Mysteries list')
const mysteryPages = new Map()
for (const title of mysteryTitles) {
  mysteryPages.set(title, await pageHtml(title))
  await sleep(250)
}

const { JSDOM } = await import('jsdom')
const dom = html => new JSDOM(html).window.document

// ---- Dig site for every excavation hotspot.
const digSites = new Map() // lower-case hotspot name -> dig site
for (const tr of dom(hotspotsHtml).querySelectorAll('table tr')) {
  const cells = [...tr.children].map(c => clean(c.textContent))
  if (cells.length < 5 || !/^\d+$/.test(cells[0])) continue
  const [, hotspot, , , digSite] = cells
  const known = digSites.get(hotspot.toLowerCase())
  if (known && known !== digSite) throw new Error(`"${hotspot}" is listed at more than one dig site`)
  digSites.set(hotspot.toLowerCase(), digSite)
}

// ---- Artefacts (Methods tables), grouped like the guide.
const groups = []
const collectionRows = [] // { collection, artefact, level }
let level = ''
for (const el of dom(methodsHtml).querySelectorAll('h3, h4, table.wikitable')) {
  if (el.tagName === 'H3') {
    groups.push({ group: dash(el.textContent), hotspots: [] })
    level = ''
  } else if (el.tagName === 'H4') {
    level = dash(el.textContent)
  } else {
    const rows = [...el.querySelectorAll('tr')]
    const header = [...rows[0].children].map(c => clean(c.textContent))
    // The header's "Artefact" cell spans the icon column too, so its cells sit one to the left of the body's.
    if (header[0] !== 'Artefact' || header[2] !== 'Needed') throw new Error(`Unexpected table header: ${header}`)
    const caption = clean(el.querySelector('caption')?.textContent ?? '')
    const hotspot = caption.replace(/^Artefacts from /i, '')
    if (!hotspot || !level || groups.length === 0) throw new Error(`Table outside a level range: "${caption}"`)
    const digSite = digSites.get(hotspot.toLowerCase())
    if (!digSite || /^n\/a$/i.test(digSite)) throw new Error(`No dig site for "${hotspot}"`)
    const artefacts = rows.slice(1).map(tr => {
      const c = [...tr.children] // the first cell is the artefact's icon
      const name = clean(c[1].textContent)
      const needed = Number(clean(c[3].textContent).replace(/,/g, ''))
      if (!name || !Number.isInteger(needed) || needed < 1) throw new Error(`Bad row in "${hotspot}": ${clean(tr.textContent)}`)
      const artefact = { key: slug(name), name, needed }
      for (const li of c[5].querySelectorAll('li')) {
        collectionRows.push({ collection: clean(li.textContent), artefact: { key: artefact.key, name, hotspot: hotspot[0].toUpperCase() + hotspot.slice(1), digSite }, level: Number(level.match(/\d+/)[0]) })
      }
      return artefact
    })
    groups.at(-1).hotspots.push({ level, hotspot: hotspot[0].toUpperCase() + hotspot.slice(1), digSite, artefacts })
  }
}

const allArtefacts = groups.flatMap(g => g.hotspots.flatMap(h => h.artefacts))
if (new Set(allArtefacts.map(a => a.key)).size !== allArtefacts.length) throw new Error('Artefact names are not unique, so slugs would collide')
if (groups.some(g => g.hotspots.length === 0)) throw new Error('A level group has no hotspots')

// ---- Collections: "Museum - Zarosian I (Velucia)" and "Zarosian I (Soran, Emissary of Zaros)" are one collection with two places to hand in.
const byCollection = new Map()
for (const { collection, artefact, level } of collectionRows) {
  const m = collection.match(/^(Museum - )?(.+?) \((.+)\)$/)
  if (!m) throw new Error(`Unrecognised collection: "${collection}"`)
  const [, museum, name, handler] = m
  const entry = byCollection.get(name) ?? byCollection.set(name, { name, handlers: new Map(), artefacts: new Map() }).get(name)
  entry.handlers.set(handler, { name: handler, museum: !!museum })
  const variant = `${handler}|${museum ? 1 : 0}`
  if (!entry.artefacts.has(variant)) entry.artefacts.set(variant, [])
  entry.artefacts.get(variant).push({ ...artefact, level })
}
const collections = [...byCollection.values()].map(({ name, handlers, artefacts }) => {
  const variants = [...artefacts.values()].map(a => a.map(x => x.key).sort().join('|'))
  if (new Set(variants).size !== 1) throw new Error(`The versions of "${name}" need different artefacts`)
  const arts = [...artefacts.values()][0]
  const top = Math.max(...arts.map(a => a.level))
  const finalHotspots = [...new Map(arts.filter(a => a.level === top).map(a => [a.hotspot, { hotspot: a.hotspot, digSite: a.digSite }])).values()]
  return {
    name,
    level: top,
    handlers: [...handlers.values()].sort((a, b) => Number(a.museum) - Number(b.museum) || a.name.localeCompare(b.name)),
    finalHotspots,
    artefacts: arts.map(({ key, name, hotspot, digSite }) => ({ key, name, hotspot, digSite })),
  }
}).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
if (!allArtefacts.every(a => collections.some(c => c.artefacts.some(x => x.key === a.key)))) throw new Error('An artefact belongs to no collection')

// ---- Mysteries.
const table = [...dom(mysteriesHtml).querySelectorAll('table')].find(t => [...t.querySelectorAll('th')].slice(0, 5).map(th => clean(th.textContent)).join('|') === 'Name|Requirements|Alignment|Dig site|Rewards')
if (!table) throw new Error('Could not find the mysteries table')
const mysteryRows = [...table.querySelectorAll(':scope > tbody > tr')].slice(1).map(tr => {
  const td = [...tr.children]
  const title = decodeURIComponent(td[0].querySelector('a').getAttribute('href').replace('/w/', ''))
  const reqs = [...td[1].querySelectorAll('li')].map(li => {
    const marker = li.querySelector('sup')?.textContent.trim()
    return { text: clean(li.textContent).replace(/\s*\((?:n?b)\)$/, ''), boostable: marker === '(b)' ? true : marker === '(nb)' ? false : undefined }
  })
  const rewardItems = [...td[4].querySelectorAll('li')].map(li => clean(li.textContent))
  const rewards = (rewardItems.length ? rewardItems : [clean(td[4].textContent)]).map(r => r.replace(/^([\d,.]+) experience$/, '$1 Archaeology XP'))
  return { name: clean(td[0].textContent), title, reqs, alignment: clean(td[2].textContent), digSite: clean(td[3].textContent), rewards }
})
if (mysteryRows.map(r => r.title).join() !== mysteryTitles.join()) throw new Error('Mystery list changed shape while parsing')

// The "Required items" cell is lists, some preceded by an italic label such as "Brought from elsewhere:" or "Recommended:".
// Recommended extras are not required, so they are left out.
function requiredItems(cell) {
  if (!cell) return []
  const items = []
  let recommended = false
  for (const el of cell.querySelectorAll('p, ul')) {
    if (el.tagName === 'P') {
      recommended = /^recommended/i.test(clean(el.textContent))
      continue
    }
    if (recommended || el.parentElement.closest('ul')) continue
    for (const li of el.querySelectorAll('li')) if (!li.querySelector('li')) items.push(clean(li.textContent))
  }
  return items.filter(t => t && !/^none$/i.test(t))
}

const mysteryByName = new Map(mysteryRows.map(r => [r.name, r]))
const mysteries = mysteryRows.map(r => {
  const levelReq = r.reqs.find(q => /^\d+ Archaeology$/.test(q.text))
  if (!levelReq) throw new Error(`"${r.name}" has no Archaeology level`)
  const others = r.reqs.filter(q => q !== levelReq).map(q => q.text)
  // Only whole prerequisites count for ordering; "partial completion" ones can be met long before the mystery is finished.
  const after = others.filter(t => !/partial/i.test(t) && mysteryByName.has(t)).map(t => slug(t))
  const doc = dom(mysteryPages.get(r.title))
  const details = new Map([...doc.querySelectorAll('table.questdetails tr')].map(tr => [clean(tr.querySelector('th')?.textContent ?? ''), tr.querySelector('td')]))
  const items = requiredItems(details.get('Required items'))
  return {
    key: slug(r.name),
    name: r.name,
    title: r.title,
    level: Number(levelReq.text.match(/^\d+/)[0]),
    boostable: levelReq.boostable,
    alignment: r.alignment,
    digSite: r.digSite,
    requirements: others,
    after,
    items,
    rewards: r.rewards,
  }
})
if (new Set(mysteries.map(m => m.key)).size !== mysteries.length) throw new Error('Mystery names are not unique, so slugs would collide')

// Order of availability: by Archaeology level, then after the mysteries they depend on, then by name.
const byKey = new Map(mysteries.map(m => [m.key, m]))
const depth = (m, seen = []) => {
  if (seen.includes(m.key)) throw new Error(`Mystery prerequisites loop: ${[...seen, m.key].join(' -> ')}`)
  return 1 + Math.max(0, ...m.after.map(k => depth(byKey.get(k), [...seen, m.key])))
}
mysteries.sort((a, b) => a.level - b.level || depth(a) - depth(b) || a.name.localeCompare(b.name))
mysteries.forEach((m, i) => {
  for (const k of m.after) if (mysteries.findIndex(x => x.key === k) > i) throw new Error(`"${m.name}" is listed before its prerequisite "${byKey.get(k).name}"`)
})

// ---- Write.
const date = new Date().toISOString().slice(0, 10)
const out = [
  '// Generated by scripts/generate-archaeology-data.mjs — do not edit by hand.',
  '// Source: https://runescape.wiki/w/Archaeology_training (Methods section): the "Needed" column of each',
  "// hotspot's artefact table, and its Collections column; dig sites from https://runescape.wiki/w/Excavation_hotspot.",
  `// Fetched ${date}.`,
  "import type { ArchaeologyCollection, ArchaeologyGroup } from './archaeology'",
  '',
  'export const ARCHAEOLOGY_GROUPS: ArchaeologyGroup[] = [',
]
for (const g of groups) {
  out.push('  {', `    group: ${quote(g.group)},`, '    hotspots: [')
  for (const h of g.hotspots) {
    out.push('      {', `        level: ${quote(h.level)},`, `        hotspot: ${quote(h.hotspot)},`, `        digSite: ${quote(h.digSite)},`, '        artefacts: [')
    for (const a of h.artefacts) out.push(`          { key: ${quote(a.key)}, name: ${quote(a.name)}, needed: ${a.needed} },`)
    out.push('        ],', '      },')
  }
  out.push('    ],', '  },')
}
out.push(']', '', '/** In order of availability: the guide level at which each collection can first be completed. */', 'export const ARCHAEOLOGY_COLLECTIONS: ArchaeologyCollection[] = [')
for (const c of collections) {
  out.push('  {', `    name: ${quote(c.name)},`, `    level: ${c.level},`)
  out.push(`    handlers: [${c.handlers.map(h => `{ name: ${quote(h.name)}, museum: ${h.museum} }`).join(', ')}],`)
  out.push(`    finalHotspots: [${c.finalHotspots.map(h => `{ hotspot: ${quote(h.hotspot)}, digSite: ${quote(h.digSite)} }`).join(', ')}],`)
  out.push('    artefacts: [')
  for (const a of c.artefacts) out.push(`      { key: ${quote(a.key)}, name: ${quote(a.name)}, hotspot: ${quote(a.hotspot)}, digSite: ${quote(a.digSite)} },`)
  out.push('    ],', '  },')
}
out.push(']', '')
writeFileSync(OUT_DATA, out.join('\n'))

const mout = [
  '// Generated by scripts/generate-archaeology-data.mjs — do not edit by hand.',
  '// Source: https://runescape.wiki/w/Mysteries and each mystery\'s own page. In order of availability:',
  '// by Archaeology level, then after the mysteries each one depends on.',
  `// Fetched ${date}.`,
  "import type { ArchaeologyMystery } from './archaeology'",
  '',
  'export const ARCHAEOLOGY_MYSTERIES: ArchaeologyMystery[] = [',
]
for (const m of mysteries) {
  mout.push('  {', `    key: ${quote(m.key)},`, `    name: ${quote(m.name)},`, `    title: ${quote(m.title)},`, `    level: ${m.level},`)
  if (m.boostable !== undefined) mout.push(`    boostable: ${m.boostable},`)
  mout.push(`    alignment: ${quote(m.alignment)},`, `    digSite: ${quote(m.digSite)},`, `    requirements: ${list(m.requirements)},`, `    after: ${list(m.after)},`, `    items: ${list(m.items)},`, `    rewards: ${list(m.rewards)},`, '  },')
}
mout.push(']', '')
writeFileSync(OUT_MYSTERIES, mout.join('\n'))

const total = allArtefacts.reduce((n, a) => n + a.needed, 0)
console.log(`${groups.length} groups, ${groups.reduce((n, g) => n + g.hotspots.length, 0)} hotspots, ${allArtefacts.length} artefacts, ${total} required`)
console.log(`${collections.length} collections, ${mysteries.length} mysteries, ${new Set(groups.flatMap(g => g.hotspots.map(h => h.digSite))).size} dig sites`)
