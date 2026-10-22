import type { RsPvmProgress } from '../../supabase'
import { PVME_GUIDES_URL, PVM_STAGES, type PvmBoss, type PvmGoal, type PvmStage } from './pvm-data'

export type PvmCount = { done: number; total: number }

export const bossGoals = (boss: PvmBoss): PvmGoal[] => [...boss.introductory, ...boss.advanced]

export const stageGoals = (stage: PvmStage): PvmGoal[] => stage.bosses.flatMap(bossGoals)

export const allGoals = (): PvmGoal[] => PVM_STAGES.flatMap(stageGoals)

/** Counts only the given goals, so saved keys that are no longer in the guide data don't inflate the total. */
export function countDone(goals: PvmGoal[], done: ReadonlySet<string>): PvmCount {
  return { done: goals.filter(g => done.has(g.key)).length, total: goals.length }
}

/** The first goal still open, walking the path in order (stage, boss, introductory before advanced). */
export function nextGoal(done: ReadonlySet<string>): { boss: PvmBoss; goal: PvmGoal } | null {
  for (const stage of PVM_STAGES) {
    for (const boss of stage.bosses) {
      const goal = bossGoals(boss).find(g => !done.has(g.key))
      if (goal) return { boss, goal }
    }
  }
  return null
}

export const guideUrl = (path: string) => `${PVME_GUIDES_URL}${path}/`

export const toDoneSet = (rows: Pick<RsPvmProgress, 'goal_key'>[]): Set<string> => new Set(rows.map(r => r.goal_key))

// Loaded lazily: the supabase client throws at import time without env vars, which would break unit tests of the pure helpers.
const db = async () => (await import('../../supabase')).supabase

export async function loadPvmProgress(characterId: string): Promise<RsPvmProgress[]> {
  const supabase = await db()
  const { data, error } = await supabase.from('rs_pvm_progress').select('*').eq('character_id', characterId)
  if (error) throw error
  return data ?? []
}

/** A row means the goal is done: ticking inserts it, un-ticking removes it. */
export async function setPvmGoalDone(userId: string, characterId: string, goalKey: string, done: boolean) {
  const supabase = await db()
  const { error } = done
    ? await supabase.from('rs_pvm_progress').upsert(
        { user_id: userId, character_id: characterId, goal_key: goalKey, completed_at: new Date().toISOString() },
        { onConflict: 'character_id,goal_key' },
      )
    : await supabase.from('rs_pvm_progress').delete().eq('character_id', characterId).eq('goal_key', goalKey)
  if (error) throw error
}
