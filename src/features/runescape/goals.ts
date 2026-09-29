import type { RsGoal, RsQuest } from '../../supabase'
import type { CharacterStats, QuestEntry, QuestStatus } from './api'
import { SKILL_BY_ID, skillLevel, xpForLevel } from './skills'

export type GoalProgress = {
  /** 0..1 */
  fraction: number
  done: boolean
  label: string
  detail: string | null
}

export const questKey = (name: string) => name.trim().toLowerCase()

export function questStatusMap(entries: QuestEntry[]): Map<string, QuestStatus> {
  return new Map(entries.map(q => [questKey(q.title), q.status]))
}

export function goalTitle(goal: RsGoal, quests: Map<string, RsQuest>): string {
  if (goal.type === 'skill') {
    const skill = SKILL_BY_ID.get(goal.skill_id ?? -1)
    return `${skill?.name ?? 'Skill'} level ${goal.target_level}`
  }
  if (goal.type === 'quest') return quests.get(goal.quest_id ?? '')?.name ?? 'Unknown quest'
  return goal.title ?? 'Goal'
}

export function goalProgress(
  goal: RsGoal,
  stats: CharacterStats | null,
  quests: Map<string, RsQuest>,
  questStatus: Map<string, QuestStatus> | null,
): GoalProgress {
  if (goal.completed_at) return { fraction: 1, done: true, label: 'Completed', detail: null }

  if (goal.type === 'skill') {
    const skill = SKILL_BY_ID.get(goal.skill_id ?? -1)
    const target = goal.target_level ?? 0
    const stat = skill ? stats?.skills.get(skill.id) : undefined
    if (!skill || !stat) return { fraction: 0, done: false, label: `Level ${target}`, detail: 'Stats unavailable' }
    const level = skillLevel(skill, stat)
    if (level >= target) return { fraction: 1, done: true, label: `${level} / ${target}`, detail: 'Reached!' }
    if (skill.elite) return { fraction: level / target, done: false, label: `${level} / ${target}`, detail: null }
    const targetXp = xpForLevel(target)
    const remaining = Math.max(0, targetXp - stat.xp)
    // Share of the total xp needed for the target (not per-level progress).
    const fraction = targetXp > 0 ? Math.min(1, stat.xp / targetXp) : 0
    return {
      fraction,
      done: false,
      label: `${level} / ${target}`,
      detail: `${remaining.toLocaleString('en-US')} xp to go`,
    }
  }

  if (goal.type === 'quest') {
    const name = quests.get(goal.quest_id ?? '')?.name
    const status = name ? questStatus?.get(questKey(name)) : undefined
    if (!status) return { fraction: 0, done: false, label: 'Not started', detail: questStatus ? null : 'Quest status unavailable' }
    if (status === 'COMPLETED') return { fraction: 1, done: true, label: 'Completed', detail: null }
    if (status === 'STARTED') return { fraction: 0.5, done: false, label: 'In progress', detail: null }
    return { fraction: 0, done: false, label: 'Not started', detail: null }
  }

  return { fraction: 0, done: false, label: 'Open', detail: null }
}
