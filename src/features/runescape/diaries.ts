import DOMPurify from 'dompurify'
import type { RsDiaryProgress, RsDiaryTask, RsDiaryTier } from '../../supabase'
import { RsApiError } from './api'

export const TIERS: RsDiaryTier[] = ['Beginner', 'Easy', 'Medium', 'Hard', 'Elite', 'All']

export type DiaryCategory = 'Area Tasks' | 'Exploration'

/** Wiki sets of achievements. Every page is "<Area> achievements"; Area Tasks pages are split by tier. */
export const DIARY_AREAS: { category: DiaryCategory; areas: string[] }[] = [
  {
    category: 'Area Tasks',
    areas: [
      'Ardougne', 'Daemonheim', 'Desert', 'Falador', 'Fremennik', 'Karamja', 'Lumbridge', 'Morytania',
      "Seers' Village", 'Tirannwn', 'Underworld', 'Varrock', 'Wilderness',
    ],
  },
  {
    category: 'Exploration',
    areas: [
      'Anachronia', 'The Arc', 'City of Um', 'Fort Forinthry', 'Free to Play Lodestones', 'Havenhythe',
      "Het's Oasis", "Members' Lodestones", 'Menaphos', 'New Varrock', 'Prifddinas', 'Senntisten',
      'Wendlewick', 'Zolarea',
    ],
  },
]

export const diaryPageTitle = (area: string) => `${area} achievements`

export type ParsedTask = { tier: RsDiaryTier; name: string; description: string }

const clean = (t: string) => t.replace(/\[edit( source)?\]/gi, '').replace(/\s+/g, ' ').trim()

const tierOf = (heading: string): RsDiaryTier | null => {
  const m = /\b(beginner|easy|medium|hard|elite)\b/i.exec(heading)
  return m ? (TIERS.find(t => t.toLowerCase() === m[1].toLowerCase()) ?? null) : null
}

/**
 * Pulls achievements out of a rendered "<Area> achievements" page. Each list is a wikitable whose
 * header row has "Name" and "Description" columns; its tier comes from the nearest preceding
 * "Easy achievements"-style heading, or "All" on pages without tiers (exploration areas).
 */
export function parseDiaryTasks(html: string): ParsedTask[] {
  const doc = new DOMParser().parseFromString(DOMPurify.sanitize(html), 'text/html')
  const root = doc.querySelector('.mw-parser-output') ?? doc.body
  root.querySelectorAll('.navbox, .toc, #toc, sup.reference, .reference, .references, .mw-editsection, .noprint').forEach(el => el.remove())

  const out: ParsedTask[] = []
  const seen = new Set<string>()
  let tier: RsDiaryTier = 'All'

  const walk = (el: Element) => {
    // A heading only moves the tier when it names one ("List of achievements", "Rewards" keep the current tier).
    const heading = el.matches('h2, h3, h4') ? el : el.matches('div.mw-heading') ? el.querySelector('h2, h3, h4') : null
    if (heading) {
      const t = tierOf(clean(heading.textContent ?? ''))
      if (t) tier = t
      return
    }
    if (el.matches('table.wikitable')) {
      const rows = Array.from(el.querySelectorAll(':scope > tbody > tr, :scope > tr'))
      const headers = Array.from(rows[0]?.children ?? []).map(c => clean(c.textContent ?? '').toLowerCase())
      const nameCol = headers.indexOf('name')
      const descCol = headers.indexOf('description')
      if (nameCol < 0 || descCol < 0) return
      for (const tr of rows.slice(1)) {
        const cells = Array.from(tr.children)
        const name = clean(cells[nameCol]?.textContent ?? '')
        const description = clean(cells[descCol]?.textContent ?? '')
        const key = `${tier}|${name.toLowerCase()}`
        if (!name || seen.has(key)) continue
        seen.add(key)
        out.push({ tier, name, description })
      }
      return
    }
    Array.from(el.children).forEach(walk)
  }
  Array.from(root.children).forEach(walk)
  // Tiered pages open with a few "Set Tasks" meta achievements (one per tier) before the first tier heading; they aren't tasks to track.
  return out.some(t => t.tier !== 'All') ? out.filter(t => t.tier !== 'All') : out
}

export type DiaryArea = {
  category: string
  area: string
  tiers: { tier: RsDiaryTier; tasks: RsDiaryTask[] }[]
  done: number
  total: number
}

/** Groups the catalogue by area, then tier (in tier order), with completion counts. */
export function groupDiaries(tasks: RsDiaryTask[], doneIds: Set<string>): DiaryArea[] {
  const byArea = new Map<string, RsDiaryTask[]>()
  for (const t of tasks) byArea.set(`${t.category}|${t.area}`, [...(byArea.get(`${t.category}|${t.area}`) ?? []), t])
  return [...byArea.values()]
    .map(list => ({
      category: list[0].category,
      area: list[0].area,
      tiers: TIERS
        .map(tier => ({ tier, tasks: list.filter(t => t.tier === tier).sort((a, b) => a.position - b.position) }))
        .filter(t => t.tasks.length > 0),
      done: list.filter(t => doneIds.has(t.id)).length,
      total: list.length,
    }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.area.localeCompare(b.area))
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

const SYNC_CONCURRENCY = 4

/** Re-reads every area's wiki page and upserts its tasks. Existing rows are kept so progress survives. */
export async function syncDiaryCatalogue(existing: RsDiaryTask[], signal?: AbortSignal): Promise<SyncResult> {
  const known = new Set(existing.map(t => `${t.area}|${t.tier}|${t.name.toLowerCase()}`))
  const rows: { category: string; area: string; tier: RsDiaryTier; name: string; description: string | null; position: number; updated_at: string }[] = []
  const failed: string[] = []
  const queue = DIARY_AREAS.flatMap(g => g.areas.map(area => ({ category: g.category, area })))
  await Promise.all(Array.from({ length: SYNC_CONCURRENCY }, async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      try {
        const tasks = await fetchDiaryPage(item.area, signal)
        if (tasks.length === 0) { failed.push(item.area); continue }
        const pos = new Map<RsDiaryTier, number>()
        for (const t of tasks) {
          const position = pos.get(t.tier) ?? 0
          pos.set(t.tier, position + 1)
          rows.push({ category: item.category, area: item.area, tier: t.tier, name: t.name, description: t.description || null, position, updated_at: new Date().toISOString() })
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') throw err
        failed.push(item.area)
      }
    }
  }))
  // Upsert in chunks: the full catalogue is several thousand rows.
  const supabase = await db()
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('rs_diary_tasks').upsert(rows.slice(i, i + 500), { onConflict: 'area,tier,name' })
    if (error) throw error
  }
  const areas = new Set(rows.map(r => r.area)).size
  const added = rows.filter(r => !known.has(`${r.area}|${r.tier}|${r.name.toLowerCase()}`)).length
  return { areas, tasks: rows.length, added, failed: failed.sort() }
}

/** PostgREST caps responses at 1000 rows by default, so page through the catalogue. */
export async function loadDiaryTasks(): Promise<RsDiaryTask[]> {
  const supabase = await db()
  const all: RsDiaryTask[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('rs_diary_tasks').select('*').order('id').range(from, from + 999)
    if (error) throw error
    all.push(...(data ?? []))
    if ((data?.length ?? 0) < 1000) return all
  }
}

export async function loadDiaryProgress(characterId: string): Promise<RsDiaryProgress[]> {
  const supabase = await db()
  const all: RsDiaryProgress[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('rs_diary_progress').select('*').eq('character_id', characterId).order('id').range(from, from + 999)
    if (error) throw error
    all.push(...(data ?? []))
    if ((data?.length ?? 0) < 1000) return all
  }
}

export async function setTaskDone(userId: string, characterId: string, taskIds: string[], done: boolean) {
  if (taskIds.length === 0) return
  const supabase = await db()
  for (let i = 0; i < taskIds.length; i += 200) {
    const chunk = taskIds.slice(i, i + 200)
    const { error } = done
      ? await supabase.from('rs_diary_progress').upsert(
          chunk.map(task_id => ({ user_id: userId, character_id: characterId, task_id })),
          { onConflict: 'character_id,task_id', ignoreDuplicates: true },
        )
      : await supabase.from('rs_diary_progress').delete().eq('character_id', characterId).in('task_id', chunk)
    if (error) throw error
  }
}
