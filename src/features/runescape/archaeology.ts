import type { RsArchaeologyProgress } from '../../supabase'

export type ArchaeologyArtefact = { key: string; name: string; needed: number }
/** `level` is the wiki's level range for the step in the guide (e.g. "76–77"); `digSite` is where the hotspot is. */
export type ArchaeologyHotspot = { level: string; hotspot: string; digSite: string; artefacts: ArchaeologyArtefact[] }
export type ArchaeologyGroup = { group: string; hotspots: ArchaeologyHotspot[] }

/**
 * A collection that can be handed in (the NPC's and the Museum's versions need the same artefacts, so they share a row).
 * `level` is the guide level at which its last artefact becomes available, i.e. when it can first be completed.
 */
export type ArchaeologyCollection = {
  name: string
  level: number
  handlers: { name: string; museum: boolean }[]
  finalHotspots: { hotspot: string; digSite: string }[]
  artefacts: { key: string; name: string; hotspot: string; digSite: string }[]
}

export type ArchaeologyMystery = {
  key: string
  name: string
  /** Wiki page title, for the link. */
  title: string
  level: number
  /** Whether the Archaeology level can be boosted; undefined when the wiki doesn't say. */
  boostable?: boolean
  alignment: string
  digSite: string
  /** Everything required besides the Archaeology level: other skills, quests, qualifications, earlier mysteries. */
  requirements: string[]
  /** Keys of the mysteries that must come first. */
  after: string[]
  items: string[]
  rewards: string[]
}

export type ArchaeologyMysteryNote = {
  /** One line on what the mystery is about. */
  about: string
  /** How to begin it. */
  start: string
}

/** How many of each artefact have been found, by `ArchaeologyArtefact.key`. A missing key means none. */
export type FoundMap = Record<string, number>

/**
 * Mysteries are saved in the same table as artefacts, under a prefixed key with found 1 once solved,
 * so they use the same "found >= needed" check (needed is 1). Artefact keys never contain a colon.
 */
export const mysteryProgressKey = (key: string) => `mystery:${key}`

/** Upper bound for a typed count; the largest requirement is 7. */
export const MAX_COUNT = 999

export const isComplete = (found: number, needed: number) => found >= needed

/** Whole number in 0..MAX_COUNT; anything that isn't a number counts as 0. */
export function clampCount(n: number) {
  return Number.isFinite(n) ? Math.min(MAX_COUNT, Math.max(0, Math.trunc(n))) : 0
}

export type ArchaeologySummary = {
  complete: number
  total: number
  /** Items found, counting at most `needed` per artefact so extras don't hide what's still missing elsewhere. */
  found: number
  needed: number
}

export function summarize(artefacts: ArchaeologyArtefact[], found: FoundMap): ArchaeologySummary {
  const s: ArchaeologySummary = { complete: 0, total: artefacts.length, found: 0, needed: 0 }
  for (const a of artefacts) {
    const n = found[a.key] ?? 0
    if (isComplete(n, a.needed)) s.complete++
    s.found += Math.min(n, a.needed)
    s.needed += a.needed
  }
  return s
}

export const groupArtefacts = (group: ArchaeologyGroup) => group.hotspots.flatMap(h => h.artefacts)

export const toFoundMap = (rows: Pick<RsArchaeologyProgress, 'artefact_key' | 'found'>[]): FoundMap =>
  Object.fromEntries(rows.map(r => [r.artefact_key, r.found]))

// Loaded lazily: the supabase client throws at import time without env vars, which would break unit tests of the pure helpers.
const db = async () => (await import('../../supabase')).supabase

/** The artefact list is fixed (a few hundred rows), well under PostgREST's 1000-row response cap, so no paging. */
export async function loadArchaeologyProgress(characterId: string): Promise<RsArchaeologyProgress[]> {
  const supabase = await db()
  const { data, error } = await supabase.from('rs_archaeology_progress').select('*').eq('character_id', characterId)
  if (error) throw error
  return data ?? []
}

export async function setArtefactFound(userId: string, characterId: string, artefactKey: string, found: number) {
  const supabase = await db()
  const { error } = await supabase.from('rs_archaeology_progress').upsert(
    { user_id: userId, character_id: characterId, artefact_key: artefactKey, found, updated_at: new Date().toISOString() },
    { onConflict: 'character_id,artefact_key' },
  )
  if (error) throw error
}
