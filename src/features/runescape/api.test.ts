import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  RsApiError, combatLevel, difficultyLabel, fetchCharacterStats, formatActivityDate, parseEvents, parseHiscores,
  parseQuestProgress, parseQuests, parseSkills,
} from './api'
import type { SkillStat } from './api'

// Skill names as the Adventurer's Log spells them (note hitpoints / runecraft).
const NAMES = [
  'attack', 'defence', 'strength', 'hitpoints', 'ranged', 'prayer', 'magic', 'cooking', 'woodcutting', 'fletching',
  'fishing', 'firemaking', 'crafting', 'smithing', 'mining', 'herblore', 'agility', 'thieving', 'slayer', 'farming',
  'runecraft', 'hunter', 'construction', 'summoning', 'dungeoneering', 'divination', 'invention', 'archaeology', 'necromancy',
]

/** Player Data `skills` object with every skill at `base` unless overridden. */
const playerDataSkills = (over: Record<string, number> = {}, base = 1) =>
  Object.fromEntries(NAMES.map(n => [n, { level: over[n] ?? base, fine_xp: (over[n] ?? base) * 10_000 }]))

/** Hiscores index_lite.json with every skill at `base` unless overridden; ranks are 101, 102, … by skill. */
const hiscoresPayload = (over: Record<string, number> = {}, base = 1) => ({
  name: 'Test Player',
  skills: [
    { id: 0, name: 'Overall', rank: 1, level: 0, xp: 0 },
    ...NAMES.map((n, i) => ({ id: i + 1, name: n[0].toUpperCase() + n.slice(1), rank: 101 + i, level: over[n] ?? base, xp: (over[n] ?? base) * 1_000 })),
  ],
})

const stat = (level: number): SkillStat => ({ id: 0, level, xp: 0, rank: null })
const skillMap = (levels: Record<string, number>) => {
  // Skill ids as the app numbers them (RuneMetrics order).
  const ids: Record<string, number> = {
    attack: 0, defence: 1, strength: 2, hitpoints: 3, ranged: 4, prayer: 5, magic: 6, summoning: 23, necromancy: 28,
  }
  return new Map(Object.entries(levels).map(([n, l]) => [ids[n], { ...stat(l), id: ids[n] }]))
}

describe('formatActivityDate', () => {
  it('converts UTC timestamps to Israel time (summer, UTC+3)', () => {
    expect(formatActivityDate('2026-10-05T07:24:00Z')).toBe('05-Oct-2026 10:24')
  })
  it('handles winter time and day rollover (UTC+2)', () => {
    expect(formatActivityDate('2026-12-31T22:30:00Z')).toBe('01-Jan-2027 00:30')
  })
  it('honours the offset in the timestamp', () => {
    expect(formatActivityDate('2026-03-31T22:31:07+01:00')).toBe('01-Apr-2026 00:31')
  })
  it('returns unparseable input unchanged', () => {
    expect(formatActivityDate('whenever')).toBe('whenever')
  })
})

describe('parseHiscores', () => {
  it('maps skills by name, including the old Hitpoints and Runecraft names', () => {
    const skills = parseHiscores(hiscoresPayload({ hitpoints: 90, runecraft: 70 }))
    expect(skills.size).toBe(29)
    expect(skills.get(3)).toMatchObject({ level: 90 }) // Constitution
    expect(skills.get(20)).toMatchObject({ level: 70 }) // Runecrafting
    expect(skills.get(0)?.rank).toBe(101)
  })
  it('treats unranked skills (rank -1) as having no rank', () => {
    const data = { skills: [{ id: 1, name: 'Attack', rank: -1, level: 5, xp: 400 }] }
    expect(parseHiscores(data).get(0)).toMatchObject({ level: 5, xp: 400, rank: null })
  })
  it('returns nothing for a page that is not hiscores data', () => {
    expect(parseHiscores(null).size).toBe(0)
    expect(parseHiscores({ skills: 'nope' }).size).toBe(0)
  })
})

describe('parseSkills', () => {
  it('reads Player Data, dividing fine_xp by 10', () => {
    const skills = parseSkills({ skills: { attack: { level: 70, fine_xp: 81_370_220 }, hitpoints: { level: 80, fine_xp: 1_000 } } })
    expect(skills.get(0)).toMatchObject({ level: 70, xp: 8_137_022, rank: null })
    expect(skills.get(3)).toMatchObject({ level: 80, xp: 100 })
  })
  it('ignores unknown skills and malformed input', () => {
    expect(parseSkills({ skills: { sailing: { level: 5, fine_xp: 1 } } }).size).toBe(0)
    expect(parseSkills({ skills: 'nope' }).size).toBe(0)
    expect(parseSkills(undefined).size).toBe(0)
  })
})

describe('combatLevel', () => {
  it('gives 152 for the maximum build (120 offence, 99 support)', () => {
    const levels = { attack: 120, strength: 120, magic: 120, ranged: 120, necromancy: 120, defence: 99, hitpoints: 99, prayer: 99, summoning: 99 }
    expect(combatLevel(skillMap(levels))).toBe(152)
  })
  it('gives 3 for a brand-new account', () => {
    const levels = { attack: 1, strength: 1, magic: 1, ranged: 1, necromancy: 1, defence: 1, hitpoints: 10, prayer: 1, summoning: 1 }
    expect(combatLevel(skillMap(levels))).toBe(3)
  })
  it('rounds down (138.35 → 138) for a melee build', () => {
    const levels = { attack: 99, strength: 99, magic: 1, ranged: 1, necromancy: 1, defence: 99, hitpoints: 99, prayer: 99, summoning: 99 }
    expect(combatLevel(skillMap(levels))).toBe(138)
  })
  it('is null when a contributing skill is missing', () => {
    expect(combatLevel(skillMap({ attack: 99 }))).toBeNull()
  })
})

describe('parseEvents', () => {
  it('maps text, details and the ISO date', () => {
    const data = { name: 'x', events: [{ date: '2026-03-31T22:31:07+01:00', details: 'Quest Complete!', text: 'Quest complete: X', type: 'rs_plog_quest' }] }
    expect(parseEvents(data)).toEqual([{ text: 'Quest complete: X', details: 'Quest Complete!', date: '2026-03-31T22:31:07+01:00' }])
  })
  it('is empty without events', () => {
    expect(parseEvents({})).toEqual([])
  })
})

describe('parseQuests', () => {
  it('reads the id-keyed quest object', () => {
    const data = {
      name: 'x', qp: 5, qp_max: 400,
      quests: {
        257: { difficulty: 0, eligible: true, members: false, title: "Cook's Assistant", qp: 1, status: 'COMPLETED' },
        289: { difficulty: 3, eligible: false, members: true, title: 'Mourning\'s End Part I', qp: 2, status: 'NOT_STARTED' },
        307: { difficulty: 2, eligible: false, members: true, title: ' Recipe for Disaster ', qp: 1, status: 'STARTED' },
        308: { difficulty: 2, status: 'COMPLETED' }, // no title: skipped
      },
    }
    expect(parseQuests(data)).toEqual([
      { title: "Cook's Assistant", status: 'COMPLETED', difficulty: '0', members: false, questPoints: 1, eligible: true },
      { title: "Mourning's End Part I", status: 'NOT_STARTED', difficulty: '3', members: true, questPoints: 2, eligible: false },
      { title: 'Recipe for Disaster', status: 'STARTED', difficulty: '2', members: true, questPoints: 1, eligible: false },
    ])
  })
  it('treats an unknown status as not started and tolerates missing fields', () => {
    expect(parseQuests({ quests: { 1: { title: 'A', status: 'WEIRD' } } })).toEqual([
      { title: 'A', status: 'NOT_STARTED', difficulty: null, members: null, questPoints: null, eligible: null },
    ])
  })
  it('is empty for missing or malformed data', () => {
    expect(parseQuests({})).toEqual([])
    expect(parseQuests({ quests: 'nope' })).toEqual([])
    expect(parseQuests(null)).toEqual([])
  })
})

describe('parseQuestProgress', () => {
  it('reads the quest points the game counts alongside the quests', () => {
    const progress = parseQuestProgress({ qp: 469, qp_max: 476, quests: { 1: { title: 'A', status: 'COMPLETED', qp: 2 } } })
    expect(progress.questPoints).toBe(469)
    expect(progress.questPointsMax).toBe(476)
    expect(progress.entries).toHaveLength(1)
  })
  it('leaves quest points unknown when the response has none', () => {
    expect(parseQuestProgress({ quests: {} })).toEqual({ entries: [], questPoints: null, questPointsMax: null })
    expect(parseQuestProgress(null)).toEqual({ entries: [], questPoints: null, questPointsMax: null })
  })
  it('keeps the game\'s own count when it differs from adding up the completed quests', () => {
    // Sheep Shearer-style special cases: the completed quests below add up to 3, the game says 4.
    const data = { qp: 4, qp_max: 10, quests: { 1: { title: 'A', status: 'COMPLETED', qp: 2 }, 2: { title: 'B', status: 'COMPLETED', qp: 1 } } }
    const { entries, questPoints } = parseQuestProgress(data)
    expect(entries.reduce((sum, q) => sum + (q.status === 'COMPLETED' ? q.questPoints ?? 0 : 0), 0)).toBe(3)
    expect(questPoints).toBe(4)
  })
})

describe('difficultyLabel', () => {
  it('names the numbers the Adventurer\'s Log uses', () => {
    expect(['0', '1', '2', '3', '4', '250'].map(difficultyLabel)).toEqual(['Novice', 'Intermediate', 'Experienced', 'Master', 'Grandmaster', 'Multi'])
  })
  it('shows text as stored and hides numbers it does not know', () => {
    expect(difficultyLabel('Novice')).toBe('Novice')
    expect(difficultyLabel('7')).toBeNull()
    expect(difficultyLabel(null)).toBeNull()
    expect(difficultyLabel('')).toBeNull()
  })
})

describe('fetchCharacterStats', () => {
  afterEach(() => vi.unstubAllGlobals())

  /** Stubs /api/runescape: a number is an upstream failure status, anything else is the JSON body. */
  function stubApi(routes: Record<string, unknown>) {
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      const kind = new URL(input, 'http://localhost').searchParams.get('kind') ?? ''
      const route = routes[kind]
      if (typeof route === 'number') {
        return new Response(JSON.stringify({ error: route === 404 ? 'NOT_FOUND' : 'UPSTREAM_ERROR' }), { status: route })
      }
      return new Response(JSON.stringify(route), { status: 200 })
    }))
  }

  const events = { name: 'Test Player', events: [{ date: '2026-03-31T22:31:07+01:00', details: 'd', text: 't', type: 'x' }] }

  it('takes levels from the Adventurer\'s Log and ranks from hiscores', async () => {
    stubApi({
      skills: { name: 'Canonical Name', skills: playerDataSkills({ attack: 99 }) },
      hiscores: hiscoresPayload({ attack: 98 }),
      events,
    })
    const stats = await fetchCharacterStats('canonical name')
    expect(stats.name).toBe('Canonical Name')
    expect(stats.skills.get(0)).toMatchObject({ level: 99, xp: 99_000, rank: 101 })
    expect(stats.skills.size).toBe(29)
    expect(stats.totalLevel).toBe(99 + 28)
    expect(stats.activities).toHaveLength(1)
  })

  it('computes combat level and totals from the skills', async () => {
    const max = { attack: 120, strength: 120, magic: 120, ranged: 120, necromancy: 120, defence: 99, hitpoints: 99, prayer: 99, summoning: 99 }
    stubApi({ skills: { skills: playerDataSkills(max) }, hiscores: 404, events })
    const stats = await fetchCharacterStats('x')
    expect(stats.combatLevel).toBe(152)
    expect(stats.totalLevel).toBe(Object.values(max).reduce((a, b) => a + b, 0) + 20)
  })

  it('falls back to hiscores when the Adventurer\'s Log is down', async () => {
    stubApi({ skills: 502, hiscores: hiscoresPayload({ hitpoints: 50, runecraft: 40 }), events: 502 })
    const stats = await fetchCharacterStats('x')
    expect(stats.name).toBe('Test Player')
    expect(stats.skills.get(3)).toMatchObject({ level: 50, rank: 104 })
    expect(stats.skills.get(20)).toMatchObject({ level: 40 })
    expect(stats.activities).toEqual([])
  })

  it('works for a player who is not on the hiscores (no ranks)', async () => {
    stubApi({ skills: { name: 'Unranked', skills: playerDataSkills({}, 5) }, hiscores: 404, events })
    const stats = await fetchCharacterStats('x')
    expect([...stats.skills.values()].every(s => s.rank === null)).toBe(true)
    expect(stats.totalLevel).toBe(5 * 29)
  })

  it('does not need recent activity', async () => {
    stubApi({ skills: { skills: playerDataSkills() }, hiscores: 502, events: 404 })
    expect((await fetchCharacterStats('x')).activities).toEqual([])
  })

  it('reports NOT_FOUND only when both sources do not know the player', async () => {
    stubApi({ skills: 404, hiscores: 404, events: 404 })
    await expect(fetchCharacterStats('x')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('reports UPSTREAM_ERROR when a source is unreachable and the other has nothing', async () => {
    stubApi({ skills: 404, hiscores: 502, events: 502 })
    await expect(fetchCharacterStats('x')).rejects.toBeInstanceOf(RsApiError)
    await expect(fetchCharacterStats('x')).rejects.toMatchObject({ code: 'UPSTREAM_ERROR' })
  })

  it('rethrows an abort instead of reporting an upstream error', async () => {
    const controller = new AbortController()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('aborted', 'AbortError') }))
    controller.abort()
    await expect(fetchCharacterStats('x', controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
})
