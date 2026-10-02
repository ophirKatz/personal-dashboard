import { describe, expect, it } from 'vitest'
import type { RsGoal, RsQuest } from '../../supabase'
import type { CharacterStats } from './api'
import { goalProgress, goalTitle } from './goals'
import { xpForLevel } from './skills'

const base: RsGoal = {
  id: 'g', user_id: 'u', character_id: 'c', type: 'skill', skill_id: 0, target_level: 99,
  quest_id: null, title: null, completed_at: null, sort_order: 0, created_at: '',
}

const stats = (level: number, xp: number): CharacterStats => ({
  name: 'x', skills: new Map([[0, { id: 0, level, xp, rank: null }]]), totalLevel: level, totalXp: xp,
  combatLevel: null, questsComplete: null, activities: [], source: 'hiscores',
})

const quest: RsQuest = { id: 'q1', name: "Cook's Assistant", difficulty: 'Novice', members: false, quest_points: 1, updated_at: '' }
const quests = new Map([[quest.id, quest]])

describe('goalProgress', () => {
  it('skill goal reports xp remaining', () => {
    const p = goalProgress(base, stats(50, 101333), quests, null)
    expect(p.done).toBe(false)
    expect(p.label).toBe('50 / 99')
    expect(p.detail).toBe(`${(xpForLevel(99) - 101333).toLocaleString('en-US')} xp to go`)
  })

  it('skill goal is done at or above target', () => {
    expect(goalProgress(base, stats(99, xpForLevel(99)), quests, null).done).toBe(true)
  })

  it('quest goal follows RuneMetrics status by name', () => {
    const goal: RsGoal = { ...base, type: 'quest', skill_id: null, target_level: null, quest_id: 'q1' }
    expect(goalProgress(goal, null, quests, new Map([["cook's assistant", 'COMPLETED']])).done).toBe(true)
    expect(goalProgress(goal, null, quests, new Map([["cook's assistant", 'STARTED']])).label).toBe('In progress')
  })

  it('arbitrary goal is done only when manually completed', () => {
    const goal: RsGoal = { ...base, type: 'arbitrary', skill_id: null, target_level: null, title: 'Get a pet' }
    expect(goalProgress(goal, null, quests, null).done).toBe(false)
    expect(goalProgress({ ...goal, completed_at: 'now' }, null, quests, null).done).toBe(true)
    expect(goalTitle(goal, quests)).toBe('Get a pet')
  })
})
