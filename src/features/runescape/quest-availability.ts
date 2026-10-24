import type { CharacterStats, QuestStatus } from './api'
import { questKey } from './goals'
import { QUEST_PREREQUISITES, QUEST_SKILL_REQUIREMENTS } from './quest-requirements-data'
import { parseRequirement, type Need } from './quest-tree'
import { SKILL_BY_NAME, skillLevel } from './skills'

/** How the wiki writes the quest points requirement. */
export const QUEST_POINTS = 'Quest points'

/** What a character looks like to the availability check. */
export type Character = {
  /** Level of a skill by name (virtual levels included), or null if unknown. */
  level: (skill: string) => number | null
  /** Quest points earned, or null if unknown. */
  questPoints: number | null
  /** Status of a quest by title; undefined for quests the character's quest list doesn't have (tutorials and the like). */
  status: (title: string) => QuestStatus | undefined
}

export type LevelOption = { skill: string; level: number; current: number | null }

export type Availability = {
  /** Prerequisite quests that aren't far enough along yet. */
  quests: { name: string; need: Need }[]
  /** Skill levels and quest points the character falls short of. Several options in one entry means any one of them would do. */
  levels: LevelOption[][]
  /** Every prerequisite quest is done and every level is met. */
  available: boolean
}

export type RequirementData = {
  prerequisites: Record<string, string[]>
  skills: Record<string, string[]>
}

const DEFAULT_DATA: RequirementData = { prerequisites: QUEST_PREREQUISITES, skills: QUEST_SKILL_REQUIREMENTS }

/** "Magic 70" or "Strength 60 or Agility 60" → the options. */
export function parseLevelRequirement(text: string): { skill: string; level: number }[] {
  return text.split(' or ').flatMap(part => {
    const m = /^(.+) (\d+)$/.exec(part.trim())
    return m ? [{ skill: m[1], level: Number(m[2]) }] : []
  })
}

/** Partial completion is taken as met once the quest is started: RuneMetrics doesn't say how far along it is. */
function questMet(need: Need, status: QuestStatus): boolean {
  if (status === 'COMPLETED') return true
  return need === 'partial' && status === 'STARTED'
}

/**
 * Checks quests against a character: are the prerequisite quests done, and are the skill levels and quest points there?
 * Only what the wiki lists as needed to start is checked, and what the character data can answer: prerequisites the
 * quest list doesn't track and levels it doesn't know are skipped, and items, areas and unlocks are never looked at.
 */
export function createAvailability(who: Character, data: RequirementData = DEFAULT_DATA): (title: string) => Availability {
  const lookup = (record: Record<string, string[]>) => new Map(Object.entries(record).map(([title, items]) => [questKey(title), items]))
  const prerequisites = lookup(data.prerequisites)
  const skills = lookup(data.skills)

  return title => {
    const key = questKey(title)

    const quests = (prerequisites.get(key) ?? []).flatMap(item => {
      const { name, need } = parseRequirement(item)
      const status = who.status(name)
      return status === undefined || questMet(need, status) ? [] : [{ name, need }]
    })

    const levels = (skills.get(key) ?? []).flatMap(text => {
      const options = parseLevelRequirement(text).map(o => ({
        ...o,
        current: o.skill === QUEST_POINTS ? who.questPoints : who.level(o.skill),
      }))
      // A level the character data doesn't have can't be held against them.
      const met = options.length === 0 || options.some(o => o.current === null || o.current >= o.level)
      return met ? [] : [options]
    })

    return { quests, levels, available: quests.length === 0 && levels.length === 0 }
  }
}

/** What's in the way, in a line: "Magic 70 (you 65), Strength 60 or Agility 60 (you 45, 58), Lost City". */
export function blockerText({ quests, levels }: Availability): string {
  const levelTexts = levels.map(options => {
    const need = options.map(o => `${o.skill} ${o.level}`).join(' or ')
    return `${need} (you ${options.map(o => o.current ?? '?').join(', ')})`
  })
  const questTexts = quests.map(q => (q.need === 'partial' ? `${q.name} (partly)` : q.need === 'full' ? `${q.name} (100%)` : q.name))
  return [...levelTexts, ...questTexts].join(', ')
}

export function characterFrom(stats: CharacterStats, statuses: Map<string, QuestStatus>, questPoints: number | null): Character {
  return {
    level: name => {
      const skill = SKILL_BY_NAME.get(name.toLowerCase())
      const stat = skill && stats.skills.get(skill.id)
      return skill && stat ? skillLevel(skill, stat) : null
    },
    questPoints,
    status: title => statuses.get(questKey(title)),
  }
}

/** Quest points from the quests the character has completed; null when the quest list has no quest point values. */
export function totalQuestPoints(
  quests: { name: string; quest_points: number | null }[],
  statuses: Map<string, QuestStatus>,
): number | null {
  if (quests.every(q => q.quest_points === null)) return null
  return quests.reduce((sum, q) => (statuses.get(questKey(q.name)) === 'COMPLETED' ? sum + (q.quest_points ?? 0) : sum), 0)
}
