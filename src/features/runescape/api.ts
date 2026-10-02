import { SKILL_BY_ID, SKILL_BY_NAME } from './skills'

export type SkillStat = { id: number; level: number; xp: number; rank: number | null }

export type Activity = { text: string; details: string; date: string }

export type CharacterStats = {
  name: string
  skills: Map<number, SkillStat>
  totalLevel: number
  totalXp: number
  combatLevel: number | null
  questsComplete: number | null
  activities: Activity[]
  /** 'profile' has activities/combat/quests; 'hiscores' is the public fallback. */
  source: 'profile' | 'hiscores'
}

export type QuestStatus = 'COMPLETED' | 'STARTED' | 'NOT_STARTED'

export type QuestEntry = {
  title: string
  status: QuestStatus
  difficulty: string | null
  members: boolean | null
  questPoints: number | null
}

export type RsErrorCode = 'PROFILE_PRIVATE' | 'NOT_FOUND' | 'UPSTREAM_ERROR' | 'INVALID_PLAYER'

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

export function parseHiscores(name: string, data: unknown): CharacterStats {
  const skills = new Map<number, SkillStat>()
  let totalLevel = 0
  let totalXp = 0
  for (const row of rows((data as Row | null)?.skills)) {
    const skillName = String(row.name ?? '').toLowerCase()
    if (skillName === 'overall') {
      totalLevel = num(row.level)
      totalXp = num(row.xp)
      continue
    }
    const skill = SKILL_BY_NAME.get(skillName)
    if (!skill) continue
    const rank = num(row.rank)
    skills.set(skill.id, { id: skill.id, level: num(row.level), xp: num(row.xp), rank: rank > 0 ? rank : null })
  }
  if (skills.size === 0) throw new RsApiError('NOT_FOUND')
  if (!totalLevel) totalLevel = [...skills.values()].reduce((a, s) => a + s.level, 0)
  if (!totalXp) totalXp = [...skills.values()].reduce((a, s) => a + s.xp, 0)
  return { name, skills, totalLevel, totalXp, combatLevel: null, questsComplete: null, activities: [], source: 'hiscores' }
}

export function parseProfile(name: string, data: unknown): CharacterStats {
  const d = (data ?? {}) as Row
  const skills = new Map<number, SkillStat>()
  for (const row of rows(d.skillvalues)) {
    const id = num(row.id)
    if (!SKILL_BY_ID.has(id)) continue
    const rank = num(row.rank)
    // RuneMetrics reports xp multiplied by 10.
    skills.set(id, { id, level: num(row.level), xp: Math.floor(num(row.xp) / 10), rank: rank > 0 ? rank : null })
  }
  if (skills.size === 0) throw new RsApiError('NOT_FOUND')
  const activities = rows(d.activities).map(a => ({
    text: String(a.text ?? ''),
    details: String(a.details ?? ''),
    date: String(a.date ?? ''),
  }))
  return {
    name: typeof d.name === 'string' ? d.name : name,
    skills,
    totalLevel: num(d.totalskill) || [...skills.values()].reduce((a, s) => a + s.level, 0),
    totalXp: Math.floor(num(d.totalxp)) || [...skills.values()].reduce((a, s) => a + s.xp, 0),
    combatLevel: num(d.combatlevel) || null,
    questsComplete: d.questscomplete === undefined ? null : num(d.questscomplete),
    activities,
    source: 'profile',
  }
}

/** Prefer the RuneMetrics profile (richer); fall back to public hiscores when it's private. */
export async function fetchCharacterStats(name: string, signal?: AbortSignal): Promise<CharacterStats> {
  try {
    return parseProfile(name, await call('profile', name, signal))
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    // Private/missing RuneMetrics profile: hiscores may still know the player.
  }
  return parseHiscores(name, await call('hiscores', name, signal))
}

export function parseQuests(data: unknown): QuestEntry[] {
  return rows((data as Row | null)?.quests).flatMap(q => {
    const title = String(q.title ?? '').trim()
    if (!title) return []
    const status: QuestStatus = q.status === 'COMPLETED' || q.status === 'STARTED' ? q.status : 'NOT_STARTED'
    const difficulty = q.difficulty === undefined ? null : String(q.difficulty)
    return [{
      title,
      status,
      difficulty,
      members: typeof q.members === 'boolean' ? q.members : null,
      questPoints: q.questPoints === undefined ? null : num(q.questPoints),
    }]
  })
}

export async function fetchQuests(name: string, signal?: AbortSignal): Promise<QuestEntry[]> {
  return parseQuests(await call('quests', name, signal))
}

/** Fallback catalogue (names only) from the RS Wiki when the profile is private. */
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
    case 'PROFILE_PRIVATE':
      return 'This RuneMetrics profile is private. Turn on "Show RuneMetrics profile" in your RuneScape account settings.'
    case 'NOT_FOUND':
      return 'No RuneScape 3 player found with that name.'
    default:
      return 'Could not reach RuneScape right now. Try again in a moment.'
  }
}
