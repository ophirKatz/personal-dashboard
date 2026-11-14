import { SKILL_BY_NAME } from './skills'

export type SkillStat = { id: number; level: number; xp: number; rank: number | null }

export type Activity = { text: string; details: string; date: string }

export type CharacterStats = {
  name: string
  skills: Map<number, SkillStat>
  totalLevel: number
  totalXp: number
  combatLevel: number | null
  activities: Activity[]
}

export type QuestStatus = 'COMPLETED' | 'STARTED' | 'NOT_STARTED'

export type QuestEntry = {
  title: string
  status: QuestStatus
  difficulty: string | null
  members: boolean | null
  questPoints: number | null
  /** Whether the game says the player meets the requirements to start the quest; only meaningful before it's done. */
  eligible: boolean | null
}

export type QuestProgress = {
  entries: QuestEntry[]
  /** Quest points earned, as the game counts them (summing the completed quests is wrong in some cases). */
  questPoints: number | null
  /** Most quest points that can currently be earned. */
  questPointsMax: number | null
}

/** Quest difficulty as the Adventurer's Log numbers it. */
const DIFFICULTY_NAMES: Record<string, string> = {
  '0': 'Novice', '1': 'Intermediate', '2': 'Experienced', '3': 'Master', '4': 'Grandmaster',
  // The "parent" node of a grouped quest such as Recipe for Disaster.
  '250': 'Multi',
}

/** Quest rows store difficulty as the API's number ("2"); show its name. Anything else is shown as stored. */
export function difficultyLabel(difficulty: string | null): string | null {
  if (!difficulty) return null
  if (!/^\d+$/.test(difficulty)) return difficulty
  return DIFFICULTY_NAMES[difficulty] ?? null
}

export type RsErrorCode = 'NOT_FOUND' | 'UPSTREAM_ERROR' | 'INVALID_PLAYER'

export class RsApiError extends Error {
  code: RsErrorCode
  constructor(code: RsErrorCode) {
    super(code)
    this.code = code
  }
}

async function call(kind: string, player: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(`/api/runescape?kind=${kind}&player=${encodeURIComponent(player)}`, { signal })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const code = (body as { error?: RsErrorCode } | null)?.error
    throw new RsApiError(code ?? 'UPSTREAM_ERROR')
  }
  return res.json()
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

type Row = Record<string, unknown>
const rows = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : [])
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

type SkillMap = Map<number, SkillStat>

/** Public hiscores: level, xp and rank per skill ("Overall" is skipped; totals are summed from the skills). */
export function parseHiscores(data: unknown): SkillMap {
  const skills: SkillMap = new Map()
  for (const row of rows((data as Row | null)?.skills)) {
    const skill = SKILL_BY_NAME.get(String(row.name ?? '').toLowerCase())
    if (!skill) continue
    const rank = num(row.rank)
    skills.set(skill.id, { id: skill.id, level: num(row.level), xp: num(row.xp), rank: rank > 0 ? rank : null })
  }
  return skills
}

/** Adventurer's Log Player Data (`includeSkills`): fresher than hiscores but has no rank. `fine_xp` is xp × 10. */
export function parseSkills(data: unknown): SkillMap {
  const skills: SkillMap = new Map()
  const raw = (data as Row | null)?.skills
  for (const [key, row] of Object.entries(isObject(raw) ? raw : {})) {
    const skill = SKILL_BY_NAME.get(key.toLowerCase())
    if (!skill || !isObject(row)) continue
    skills.set(skill.id, { id: skill.id, level: num(row.level), xp: Math.floor(num(row.fine_xp) / 10), rank: null })
  }
  return skills
}

/** RS3 combat level (https://runescape.wiki/w/Combat_level); null when a contributing skill is missing. */
export function combatLevel(skills: SkillMap): number | null {
  const lvl = (name: string) => skills.get(SKILL_BY_NAME.get(name)!.id)?.level
  const att = lvl('attack'), str = lvl('strength'), def = lvl('defence'), con = lvl('hitpoints')
  const rng = lvl('ranged'), mag = lvl('magic'), necro = lvl('necromancy'), pray = lvl('prayer'), summ = lvl('summoning')
  if ([att, str, def, con, rng, mag, necro, pray, summ].some(v => v === undefined)) return null
  const offence = Math.max(att! + str!, 2 * mag!, 2 * rng!, 2 * necro!)
  // floor((13/10 × offence + def + con + ⌊pray/2⌋ + ⌊summ/2⌋) / 4), kept in integers to avoid float error.
  return Math.floor((13 * offence + 10 * (def! + con! + Math.floor(pray! / 2) + Math.floor(summ! / 2))) / 40)
}

/** Adventurer's Log Player Events: the 20 most recent events, newest first. */
export function parseEvents(data: unknown): Activity[] {
  return rows((data as Row | null)?.events).map(e => ({
    text: String(e.text ?? ''),
    details: String(e.details ?? ''),
    date: String(e.date ?? ''),
  }))
}

/** Player Events dates are ISO 8601 ("2026-03-31T22:31:07+01:00"); render them in Israel time as "01-Apr-2026 00:31". */
export function formatActivityDate(raw: string): string {
  const time = Date.parse(raw.trim())
  if (!Number.isFinite(time)) return raw
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jerusalem', day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(time)).map(x => [x.type, x.value]),
  )
  return `${p.day}-${p.month}-${p.year} ${p.hour}:${p.minute}`
}

const displayName = (r: PromiseSettledResult<unknown>): string | null => {
  const name = r.status === 'fulfilled' ? (r.value as Row | null)?.name : null
  return typeof name === 'string' && name ? name : null
}

/**
 * Levels and xp come from the Adventurer's Log (freshest); ranks come from the public hiscores, which also
 * stand in for the levels if the Adventurer's Log is down. Recent activity is optional.
 */
export async function fetchCharacterStats(name: string, signal?: AbortSignal): Promise<CharacterStats> {
  const [log, hiscores, events] = await Promise.allSettled([
    call('skills', name, signal),
    call('hiscores', name, signal),
    call('events', name, signal),
  ])
  const live = log.status === 'fulfilled' ? parseSkills(log.value) : new Map<number, SkillStat>()
  const ranked = hiscores.status === 'fulfilled' ? parseHiscores(hiscores.value) : new Map<number, SkillStat>()

  if (live.size === 0 && ranked.size === 0) {
    const failures = [log, hiscores].flatMap(r => (r.status === 'rejected' ? [r.reason] : []))
    const aborted = failures.find(e => (e as Error)?.name === 'AbortError')
    if (aborted) throw aborted
    const unknownPlayer = failures.length === 2 && failures.every(e => e instanceof RsApiError && e.code === 'NOT_FOUND')
    throw new RsApiError(unknownPlayer ? 'NOT_FOUND' : 'UPSTREAM_ERROR')
  }

  const skills: SkillMap = new Map()
  for (const id of new Set([...live.keys(), ...ranked.keys()])) {
    skills.set(id, { ...(live.get(id) ?? ranked.get(id)!), rank: ranked.get(id)?.rank ?? null })
  }
  const all = [...skills.values()]
  return {
    name: displayName(log) ?? displayName(hiscores) ?? name,
    skills,
    totalLevel: all.reduce((a, s) => a + s.level, 0),
    totalXp: all.reduce((a, s) => a + s.xp, 0),
    combatLevel: combatLevel(skills),
    activities: events.status === 'fulfilled' ? parseEvents(events.value) : [],
  }
}

/** Adventurer's Log Player Data (`includeQuests`): quests as an object keyed by internal quest id, plus quest points. */
export function parseQuestProgress(data: unknown): QuestProgress {
  const d = (data ?? {}) as Row
  const raw = d.quests
  const entries = (isObject(raw) ? Object.values(raw) : []).flatMap(q => {
    if (!isObject(q)) return []
    const title = String(q.title ?? '').trim()
    if (!title) return []
    const status: QuestStatus = q.status === 'COMPLETED' || q.status === 'STARTED' ? q.status : 'NOT_STARTED'
    const difficulty = q.difficulty === undefined ? null : String(q.difficulty)
    return [{
      title,
      status,
      difficulty,
      members: typeof q.members === 'boolean' ? q.members : null,
      questPoints: q.qp === undefined ? null : num(q.qp),
      eligible: typeof q.eligible === 'boolean' ? q.eligible : null,
    }]
  })
  return {
    entries,
    questPoints: d.qp === undefined ? null : num(d.qp),
    questPointsMax: d.qp_max === undefined ? null : num(d.qp_max),
  }
}

export const parseQuests = (data: unknown): QuestEntry[] => parseQuestProgress(data).entries

export async function fetchQuestProgress(name: string, signal?: AbortSignal): Promise<QuestProgress> {
  return parseQuestProgress(await call('quests', name, signal))
}

export async function fetchQuests(name: string, signal?: AbortSignal): Promise<QuestEntry[]> {
  return (await fetchQuestProgress(name, signal)).entries
}

/** Fallback catalogue (names only) from the RS Wiki when the Adventurer's Log can't be reached. */
export async function fetchWikiQuestNames(signal?: AbortSignal): Promise<string[]> {
  const data = (await call('wiki-quests', 'x', signal)) as { query?: { categorymembers?: { title?: string }[] } }
  return (data.query?.categorymembers ?? [])
    .map(m => m.title ?? '')
    .filter(t => t && !t.includes(':') && !t.startsWith('List of'))
}

async function fetchCategoryNames(kind: 'wiki-miniquests' | 'wiki-sagas', signal?: AbortSignal): Promise<string[]> {
  const data = (await call(kind, 'x', signal)) as { query?: { categorymembers?: { title?: string }[] } }
  return (data.query?.categorymembers ?? []).map(m => m.title ?? '').filter(t => t && !t.includes(':'))
}

/** Miniquests and sagas live outside the main quest list, so they're looked up by name. */
export const fetchMiniquestNames = (signal?: AbortSignal) => fetchCategoryNames('wiki-miniquests', signal)
export const fetchSagaNames = (signal?: AbortSignal) => fetchCategoryNames('wiki-sagas', signal)

export function errorMessage(err: unknown): string {
  const code = err instanceof RsApiError ? err.code : 'UPSTREAM_ERROR'
  switch (code) {
    case 'NOT_FOUND':
      return 'No RuneScape 3 player found with that name (or the account is hidden from public view).'
    default:
      return 'Could not reach RuneScape right now. Try again in a moment.'
  }
}
