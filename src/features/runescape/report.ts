import type { CharacterStats, QuestStatus } from './api'
import { fetchGuide, type Guide } from './guide'
import { questKey } from './goals'
import { SKILL_BY_NAME, skillLevel } from './skills'

/** Structured quest requirements, as extracted by the extract-quest-requirements edge function. */
export type QuestRequirements = {
  skills: { skill: string; level: number }[]
  quests: string[]
  /** Anything that isn't a skill level or a quest (quest points, items, area access…). */
  other: string[]
}

export type ReportQuest = { name: string; status: QuestStatus }

export type MissingRequirements = {
  skills: { skill: string; required: number; current: number | null }[]
  /** `status` is null when RuneMetrics doesn't list the quest under that name. */
  quests: { name: string; status: QuestStatus | null }[]
  other: string[]
}

export type ReportEntry = ReportQuest & {
  /** null = requirements couldn't be fetched or extracted. */
  missing: MissingRequirements | null
}

const CACHE_KEY = 'rs_quest_requirements_v1'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const WIKI_CONCURRENCY = 4
const EXTRACT_BATCH_SIZE = 15
const MAX_TEXT_LENGTH = 3000
const MAX_FETCH_RETRIES = 2

/** Plain text of the infobox "Requirements" cell, one line per list item; null if the page has none. */
export function requirementsText(guide: Guide): string | null {
  const html = guide.facts.find(f => f.key === 'requirements')?.html
  if (!html) return null
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('li, br, p, div').forEach(el => el.append('\n'))
  const text = (doc.body.textContent ?? '')
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
  return text || null
}

const NO_REQUIREMENTS: QuestRequirements = { skills: [], quests: [], other: [] }

export function compareRequirements(
  req: QuestRequirements,
  stats: CharacterStats,
  questStatus: Map<string, QuestStatus>,
): MissingRequirements {
  const skills: MissingRequirements['skills'] = []
  for (const { skill: name, level } of req.skills) {
    const skill = SKILL_BY_NAME.get(name.toLowerCase())
    const stat = skill ? stats.skills.get(skill.id) : undefined
    const current = skill && stat ? skillLevel(skill, stat) : null
    if (current === null || current < level) skills.push({ skill: skill?.name ?? name, required: level, current })
  }
  const quests: MissingRequirements['quests'] = []
  for (const name of req.quests) {
    const status = questStatus.get(questKey(name)) ?? null
    if (status !== 'COMPLETED') quests.push({ name, status })
  }
  return { skills, quests, other: req.other }
}

export const isReady = (m: MissingRequirements) => m.skills.length === 0 && m.quests.length === 0

type Cache = Record<string, { at: number; req: QuestRequirements }>

function readCache(): Cache {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Cache
    const now = Date.now()
    return Object.fromEntries(Object.entries(raw).filter(([, v]) => v && now - v.at < CACHE_TTL_MS))
  } catch {
    return {}
  }
}

function writeCache(cache: Cache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)) } catch { /* storage unavailable or full */ }
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }))
  return out
}

async function extractBatch(batch: { name: string; text: string }[]): Promise<(QuestRequirements | null)[]> {
  // Loaded lazily: the supabase client throws at import time without env vars, which would break unit tests of the pure helpers.
  const { supabase } = await import('../../supabase')
  for (let attempt = 1; ; attempt++) {
    const { data, error } = await supabase.functions.invoke('extract-quest-requirements', { body: { quests: batch } })
    if (!error) return (data as { requirements: (QuestRequirements | null)[] }).requirements
    // Network-level failures are safe to retry: the function has no side effects.
    if (error.name === 'FunctionsFetchError' && attempt < MAX_FETCH_RETRIES) continue
    const body = await error.context?.json?.().catch(() => null)
    throw new Error(body?.message ?? body?.error ?? error.message ?? 'Requirement extraction failed')
  }
}

export type ReportProgress = { phase: 'wiki' | 'ai'; done: number; total: number }

/**
 * Requirements for each quest (null when unavailable), from the wiki + Haiku. Results are cached
 * in localStorage so repeat exports only pay for quests that haven't been seen recently.
 */
export async function fetchQuestRequirements(
  names: string[],
  onProgress?: (p: ReportProgress) => void,
  signal?: AbortSignal,
): Promise<Map<string, QuestRequirements | null>> {
  const cache = readCache()
  const result = new Map<string, QuestRequirements | null>()
  const todo = names.filter(name => {
    const hit = cache[questKey(name)]
    if (hit) result.set(questKey(name), hit.req)
    return !hit
  })

  let fetched = 0
  const pages = await mapPool(todo, WIKI_CONCURRENCY, async name => {
    try {
      const text = requirementsText(await fetchGuide(name, 'full', signal))
      return { name, text }
    } catch (err) {
      if (signal?.aborted) throw err
      return { name, text: null }
    } finally {
      onProgress?.({ phase: 'wiki', done: ++fetched, total: todo.length })
    }
  })

  const toExtract: { name: string; text: string }[] = []
  for (const { name, text } of pages) {
    if (text === null) result.set(questKey(name), null)
    else if (/^none\.?$/i.test(text)) result.set(questKey(name), NO_REQUIREMENTS)
    else toExtract.push({ name, text: text.slice(0, MAX_TEXT_LENGTH) })
  }

  let extracted = 0
  for (let i = 0; i < toExtract.length; i += EXTRACT_BATCH_SIZE) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    onProgress?.({ phase: 'ai', done: extracted, total: toExtract.length })
    const batch = toExtract.slice(i, i + EXTRACT_BATCH_SIZE)
    let reqs: (QuestRequirements | null)[]
    try {
      reqs = await extractBatch(batch)
    } catch (err) {
      // A whole-batch failure of the first batch means the function itself is broken; surface it.
      if (extracted === 0 && i === 0) throw err
      reqs = batch.map(() => null)
    }
    batch.forEach((q, j) => {
      result.set(questKey(q.name), reqs[j] ?? null)
      if (reqs[j]) cache[questKey(q.name)] = { at: Date.now(), req: reqs[j]! }
    })
    extracted += batch.length
    onProgress?.({ phase: 'ai', done: extracted, total: toExtract.length })
  }
  for (const name of names) {
    // "None" pages are cheap to recompute, but caching them saves the wiki round trip next time.
    const req = result.get(questKey(name))
    if (req === NO_REQUIREMENTS) cache[questKey(name)] = { at: Date.now(), req }
  }
  writeCache(cache)
  return result
}

const STATUS_LABEL: Record<QuestStatus, string> = {
  COMPLETED: 'Completed',
  STARTED: 'In progress',
  NOT_STARTED: 'Not started',
}

function wikiLink(name: string) {
  return `https://runescape.wiki/w/${encodeURIComponent(name.replace(/ /g, '_')).replace(/%2F/g, '/')}`
}

function entryLines(e: ReportEntry): string[] {
  const head = `### [${e.name}](${wikiLink(e.name)}) — ${STATUS_LABEL[e.status]}`
  if (!e.missing) return [head, '', '- ⚠️ Requirements could not be read from the wiki.', '']
  const lines = [head, '']
  for (const s of e.missing.skills) {
    lines.push(`- **${s.skill}** ${s.required} needed (you have ${s.current ?? 'unknown'})`)
  }
  for (const q of e.missing.quests) {
    lines.push(`- **Quest:** ${q.name} (${q.status ? STATUS_LABEL[q.status].toLowerCase() : 'status unknown'})`)
  }
  for (const o of e.missing.other) lines.push(`- Check manually: ${o}`)
  if (lines.length === 2) lines.push('- ✅ All requirements met')
  lines.push('')
  return lines
}

export function buildReport(character: string, entries: ReportEntry[], completed: number, date = new Date()): string {
  const ready = entries.filter(e => e.missing && isReady(e.missing))
  const blocked = entries.filter(e => e.missing && !isReady(e.missing))
  const unknown = entries.filter(e => !e.missing)
  const byName = (a: ReportEntry, b: ReportEntry) => a.name.localeCompare(b.name)

  const lines = [
    `# RuneScape quest report — ${character}`,
    '',
    `Generated ${date.toISOString().slice(0, 10)}`,
    '',
    `- Completed quests: ${completed}`,
    `- Incomplete quests: ${entries.length}`,
    `- Requirements met (ready to do): ${ready.length}`,
    `- Missing requirements: ${blocked.length}`,
    ...(unknown.length ? [`- Requirements unavailable: ${unknown.length}`] : []),
    '',
    '_Requirements are read from the RuneScape Wiki and interpreted by AI, so double-check anything important. Skill levels include virtual levels; "check manually" items (quest points, items, etc.) are not compared._',
    '',
  ]
  const section = (title: string, list: ReportEntry[]) => {
    if (list.length === 0) return
    lines.push(`## ${title} (${list.length})`, '')
    list.sort(byName).forEach(e => lines.push(...entryLines(e)))
  }
  section('Missing requirements', blocked)
  section('Ready to do', ready)
  section('Requirements unavailable', unknown)
  return lines.join('\n').trimEnd() + '\n'
}

export function downloadMarkdown(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
