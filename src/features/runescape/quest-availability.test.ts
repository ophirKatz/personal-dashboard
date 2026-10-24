import { describe, expect, it } from 'vitest'
import type { QuestStatus } from './api'
import {
  blockerText, createAvailability, parseLevelRequirement, totalQuestPoints,
  type Character, type RequirementData,
} from './quest-availability'
import { QUEST_PREREQUISITES, QUEST_SKILL_REQUIREMENTS } from './quest-requirements-data'
import { parseRequirement } from './quest-tree'
import { SKILL_BY_NAME } from './skills'

const data: RequirementData = {
  prerequisites: { Quest: ['Done Quest', 'Partial:Half Quest', 'Full:All Quest', 'Tutorial'] },
  skills: {
    Quest: ['Magic 70', 'Strength 60 or Agility 60', 'Quest points 50'],
    Plain: ['Cooking 10'],
  },
}

const me = (overrides: Partial<Character> & { statuses?: Record<string, QuestStatus>; levels?: Record<string, number> } = {}): Character => ({
  level: skill => overrides.levels?.[skill] ?? null,
  questPoints: 'questPoints' in overrides ? overrides.questPoints! : 100,
  status: title => overrides.statuses?.[title],
  ...overrides,
})

const ready = {
  statuses: { 'Done Quest': 'COMPLETED', 'Half Quest': 'STARTED', 'All Quest': 'COMPLETED' } as Record<string, QuestStatus>,
  levels: { Magic: 70, Strength: 60, Agility: 10 },
}

describe('createAvailability', () => {
  it('is available when the quests are done and the levels are met', () => {
    const a = createAvailability(me(ready), data)('Quest')
    expect(a).toEqual({ quests: [], levels: [], available: true })
  })

  it('is available when there is nothing to meet', () => {
    expect(createAvailability(me(), data)('Unknown quest').available).toBe(true)
  })

  it('lists prerequisite quests that are not done', () => {
    const a = createAvailability(me({ ...ready, statuses: { ...ready.statuses, 'Done Quest': 'STARTED' } }), data)('Quest')
    expect(a.available).toBe(false)
    expect(a.quests).toEqual([{ name: 'Done Quest', need: 'complete' }])
  })

  it('takes partial completion as met once the quest is started, full completion only when it is done', () => {
    const check = (statuses: Record<string, QuestStatus>) => createAvailability(me({ ...ready, statuses }), data)('Quest').quests.map(q => q.name)
    expect(check({ ...ready.statuses, 'Half Quest': 'NOT_STARTED' })).toEqual(['Half Quest'])
    expect(check({ ...ready.statuses, 'Half Quest': 'COMPLETED' })).toEqual([])
    expect(check({ ...ready.statuses, 'All Quest': 'STARTED' })).toEqual(['All Quest'])
  })

  it('skips prerequisites the quest list does not track', () => {
    // "Tutorial" has no status in any of these.
    expect(createAvailability(me(ready), data)('Quest').quests).toEqual([])
  })

  it('reports levels the character is short of, with the current level', () => {
    const a = createAvailability(me({ ...ready, levels: { ...ready.levels, Magic: 65 } }), data)('Quest')
    expect(a.available).toBe(false)
    expect(a.levels).toEqual([[{ skill: 'Magic', level: 70, current: 65 }]])
  })

  it('accepts any one option of an "or" requirement', () => {
    expect(createAvailability(me({ ...ready, levels: { Magic: 70, Strength: 10, Agility: 60 } }), data)('Quest').available).toBe(true)
    const a = createAvailability(me({ ...ready, levels: { Magic: 70, Strength: 10, Agility: 20 } }), data)('Quest')
    expect(a.levels).toEqual([[
      { skill: 'Strength', level: 60, current: 10 },
      { skill: 'Agility', level: 60, current: 20 },
    ]])
  })

  it('checks quest points', () => {
    const a = createAvailability(me({ ...ready, questPoints: 49 }), data)('Quest')
    expect(a.levels).toEqual([[{ skill: 'Quest points', level: 50, current: 49 }]])
  })

  it('does not hold back what the character data cannot answer', () => {
    const a = createAvailability(me({ statuses: ready.statuses, questPoints: null }), data)('Quest')
    expect(a.available).toBe(true) // no levels and no quest points known
  })

  it('matches titles regardless of case', () => {
    // Same quest under another spelling; with no level known there is nothing to hold against the character.
    expect(createAvailability(me(), data)('plain').levels).toEqual([])
    const short = createAvailability(me({ levels: { Cooking: 3 } }), data)('PLAIN')
    expect(short.levels).toEqual([[{ skill: 'Cooking', level: 10, current: 3 }]])
  })
})

describe('blockerText', () => {
  it('describes missing levels first, then quests', () => {
    const text = blockerText({
      available: false,
      levels: [
        [{ skill: 'Magic', level: 70, current: 65 }],
        [{ skill: 'Strength', level: 60, current: 10 }, { skill: 'Agility', level: 60, current: null }],
      ],
      quests: [{ name: 'Lost City', need: 'complete' }, { name: 'Stolen Hearts', need: 'partial' }, { name: 'Missing My Mummy', need: 'full' }],
    })
    expect(text).toBe('Magic 70 (you 65), Strength 60 or Agility 60 (you 10, ?), Lost City, Stolen Hearts (partly), Missing My Mummy (100%)')
  })
})

describe('totalQuestPoints', () => {
  const quests = [
    { name: 'A', quest_points: 2 },
    { name: 'B', quest_points: 3 },
    { name: 'C', quest_points: null },
  ]
  it('adds up the completed quests', () => {
    expect(totalQuestPoints(quests, new Map([['a', 'COMPLETED'], ['b', 'STARTED'], ['c', 'COMPLETED']]))).toBe(2)
  })
  it('is unknown when no quest has a quest point value', () => {
    expect(totalQuestPoints([{ name: 'A', quest_points: null }], new Map([['a', 'COMPLETED']]))).toBeNull()
    expect(totalQuestPoints([], new Map())).toBeNull()
  })
})

describe('parseLevelRequirement', () => {
  it('reads single and alternative requirements', () => {
    expect(parseLevelRequirement('Magic 70')).toEqual([{ skill: 'Magic', level: 70 }])
    expect(parseLevelRequirement('Quest points 33')).toEqual([{ skill: 'Quest points', level: 33 }])
    expect(parseLevelRequirement('Strength 60 or Agility 60')).toEqual([{ skill: 'Strength', level: 60 }, { skill: 'Agility', level: 60 }])
  })
})

describe('generated requirement data', () => {
  const requirements = Object.entries(QUEST_SKILL_REQUIREMENTS).flatMap(([quest, list]) => list.map(text => ({ quest, text })))

  it('is not empty', () => {
    expect(requirements.length).toBeGreaterThan(400)
  })

  it('only names skills the app knows, or quest points', () => {
    const unknown = requirements.flatMap(({ quest, text }) => {
      const options = parseLevelRequirement(text)
      const bad = options.length === 0 || options.some(o => o.skill !== 'Quest points' && !SKILL_BY_NAME.has(o.skill.toLowerCase()))
      return bad ? [`${quest}: ${text}`] : []
    })
    expect(unknown).toEqual([])
  })

  it('has sensible levels', () => {
    const options = requirements.flatMap(({ text }) => parseLevelRequirement(text))
    const skillLevels = options.filter(o => o.skill !== 'Quest points').map(o => o.level)
    expect(Math.min(...skillLevels)).toBeGreaterThanOrEqual(1)
    expect(Math.max(...skillLevels)).toBeLessThanOrEqual(120)
    // Recipe for Disaster's last chapter needs the most quest points, 176.
    const points = options.filter(o => o.skill === 'Quest points').map(o => o.level)
    expect(points.length).toBeGreaterThan(0)
    expect(Math.max(...points)).toBeLessThanOrEqual(300)
  })

  it('has the requirements the wiki lists for Dragon Slayer and Sins of the Father', () => {
    expect(QUEST_SKILL_REQUIREMENTS['Dragon Slayer']).toEqual(['Quest points 33'])
    expect(QUEST_SKILL_REQUIREMENTS['Sins of the Father']).toEqual(['Crafting 85 or Runecrafting 85 or Smithing 85 or Invention 85'])
  })

  it('works with the real prerequisites', () => {
    const who = me({ statuses: {}, levels: {}, questPoints: 0 })
    const a = createAvailability(who)('Dragon Slayer')
    expect(a.levels).toEqual([[{ skill: 'Quest points', level: 33, current: 0 }]])
    // A quest whose prerequisites the character's list has, none of them done.
    const lost = createAvailability(me({ statuses: { 'Lost City': 'NOT_STARTED', 'Nature Spirit': 'COMPLETED' } }))('A Fairy Tale I - Growing Pains')
    expect(lost.quests).toEqual([{ name: 'Lost City', need: 'complete' }])
    expect(QUEST_PREREQUISITES['A Fairy Tale I - Growing Pains'].map(i => parseRequirement(i).name)).toContain('Lost City')
  })
})
