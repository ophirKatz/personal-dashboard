import DOMPurify from 'dompurify'
import type { RsDiaryProgress, RsDiaryTask, RsDiaryTier } from '../../supabase'
import { RsApiError } from './api'

export const TIERS: RsDiaryTier[] = ['Easy', 'Medium', 'Hard', 'Elite']

/** Wiki page titles of each area's diary. Areas whose page can't be read or parsed are skipped on sync. */
export const DIARY_AREAS = [
  'Ardougne', 'Desert', 'Falador', 'Fremennik', 'Kandarin', 'Karamja', 'Lumbridge & Draynor',
  'Morytania', "Seers' Village", 'Tirannwn', 'Varrock', 'Wilderness',
]

export const diaryPageTitle = (area: string) => `${area} Diary`

export type ParsedTask = { tier: RsDiaryTier; name: string }

const clean = (t: string) => t.replace(/\[edit( source)?\]/gi, '').replace(/\s+/g, ' ').trim()

const tierOf = (heading: string): RsDiaryTier | null => {
  const m = /\b(easy|medium|hard|elite)\b/i.exec(heading)
  return m ? (TIERS.find(t => t.toLowerCase() === m[1].toLowerCase()) ?? null) : null
}

const HEADING = 'h2, h3, h4'

/**
 * Pulls tasks out of a rendered diary page. Tasks are the list items (or the first non-header
 * cell of table rows) that sit under a heading naming a tier; everything before the first tier
 * heading, or under a non-tier heading such as "Rewards", is ignored.
 */
export function parseDiaryTasks(html: string): ParsedTask[] {
  const doc = new DOMParser().parseFromString(DOMPurify.sanitize(html), 'text/html')
  const root = doc.querySelector('.mw-parser-output') ?? doc.body
  root.querySelectorAll('.navbox, .toc, #toc, sup.reference, .reference, .references, .mw-editsection, .noprint').forEach(el => el.remove())

  const out: ParsedTask[] = []
  const seen = new Set<string>()
  let tier: RsDiaryTier | null = null
  const add = (raw: string) => {
    const name = clean(raw)
    if (!tier || name.length < 4 || name.length > 300) return
    const key = `${tier}|${name.toLowerCase()}`
    if (seen.has(key)) return
    seen.add(key)
    out.push({ tier, name })
  }

  const walk = (el: Element) => {
    if (el.matches(HEADING)) {
      tier = tierOf(clean(el.textContent ?? ''))
      return
    }
    if (el.matches('div.mw-heading')) {
      const h = el.querySelector(HEADING)
      if (h) tier = tierOf(clean(h.textContent ?? ''))
      return
    }
    if (el.matches('table')) {
      el.querySelectorAll('tr').forEach(tr => {
        const cell = Array.from(tr.children).find(c => c.matches('td'))
        if (cell && !cell.querySelector('table')) add(cell.textContent ?? '')
      })
      return
    }
    if (el.matches('ul, ol')) {
      el.querySelectorAll(':scope > li').forEach(li => {
        const own = li.cloneNode(true) as Element
        own.querySelectorAll('ul, ol').forEach(n => n.remove())
        add(own.textContent ?? '')
      })
      return
    }
    Array.from(el.children).forEach(walk)
  }
  Array.from(root.children).forEach(walk)
  return out
}

export type DiaryTaskGroup = { area: string; tiers: { tier: RsDiaryTier; tasks: RsDiaryTask[] }[]; done: number; total: number }

/** Groups the catalogue by area, then tier, with completion counts for the given set of done task ids. */
export function groupDiaries(tasks: RsDiaryTask[], doneIds: Set<string>): DiaryTaskGroup[] {
  const byArea = new Map<string, RsDiaryTask[]>()
  for (const t of tasks) byArea.set(t.area, [...(byArea.get(t.area) ?? []), t])
  return [...byArea.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([area, list]) => ({
      area,
      tiers: TIERS
        .map(tier => ({ tier, tasks: list.filter(t => t.tier === tier).sort((a, b) => a.position - b.position) }))
        .filter(t => t.tasks.length > 0),
      done: list.filter(t => doneIds.has(t.id)).length,
      total: list.length,
    }))
}

async function fetchDiaryPage(area: string, signal?: AbortSignal): Promise<ParsedTask[]> {
  const res = await fetch(`/api/runescape?kind=wiki-page&title=${encodeURIComponent(diaryPageTitle(area))}`, { signal })
  if (!res.ok) throw new RsApiError(res.status === 404 ? 'NOT_FOUND' : 'UPSTREAM_ERROR')
  const data = (await res.json()) as { parse?: { text?: string } }
  if (!data.parse?.text) throw new RsApiError('NOT_FOUND')
  return parseDiaryTasks(data.parse.text)
}

// Loaded lazily: the supabase client throws at import time without env vars, which would break unit tests of the pure helpers.
const db = async () => (await import('../../supabase')).supabase

export type SyncResult = { areas: number; tasks: number; added: number; failed: string[] }

/** Re-reads every area's wiki page and upserts its tasks. Existing rows are kept so progress survives. */
export async function syncDiaryCatalogue(existing: RsDiaryTask[], signal?: AbortSignal): Promise<SyncResult> {
  const known = new Set(existing.map(t => `${t.area}|${t.tier}|${t.name.toLowerCase()}`))
  const rows: { area: string; tier: RsDiaryTier; name: string; position: number; updated_at: string }[] = []
  const failed: string[] = []
  await Promise.all(DIARY_AREAS.map(async area => {
    try {
      const tasks = await fetchDiaryPage(area, signal)
      if (tasks.length === 0) { failed.push(area); return }
      const pos = new Map<RsDiaryTier, number>()
      for (const t of tasks) {
        const position = pos.get(t.tier) ?? 0
        pos.set(t.tier, position + 1)
        rows.push({ area, tier: t.tier, name: t.name, position, updated_at: new Date().toISOString() })
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err
      failed.push(area)
    }
  }))
  if (rows.length > 0) {
    const { error } = await (await db()).from('rs_diary_tasks').upsert(rows, { onConflict: 'area,tier,name' })
    if (error) throw error
  }
  const areas = new Set(rows.map(r => r.area)).size
  const added = rows.filter(r => !known.has(`${r.area}|${r.tier}|${r.name.toLowerCase()}`)).length
  return { areas, tasks: rows.length, added, failed: failed.sort() }
}

export async function loadDiaryTasks(): Promise<RsDiaryTask[]> {
  const { data, error } = await (await db()).from('rs_diary_tasks').select('*').order('area').order('position').limit(2000)
  if (error) throw error
  return data ?? []
}

export async function loadDiaryProgress(characterId: string): Promise<RsDiaryProgress[]> {
  const { data, error } = await (await db()).from('rs_diary_progress').select('*').eq('character_id', characterId).limit(2000)
  if (error) throw error
  return data ?? []
}

export async function setTaskDone(userId: string, characterId: string, taskIds: string[], done: boolean) {
  if (taskIds.length === 0) return
  const supabase = await db()
  const { error } = done
    ? await supabase.from('rs_diary_progress').upsert(
        taskIds.map(task_id => ({ user_id: userId, character_id: characterId, task_id })),
        { onConflict: 'character_id,task_id', ignoreDuplicates: true },
      )
    : await supabase.from('rs_diary_progress').delete().eq('character_id', characterId).in('task_id', taskIds)
  if (error) throw error
}
