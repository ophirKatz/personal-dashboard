import { supabase } from '../../supabase'
import type { RsQuest } from '../../supabase'
import { RsApiError, fetchQuests, fetchWikiQuestNames } from './api'

export async function loadQuestCatalogue(): Promise<RsQuest[]> {
  const { data, error } = await supabase.from('rs_quests').select('*').order('name').limit(1000)
  if (error) throw error
  return data ?? []
}

/**
 * Re-syncs the shared quest catalogue. RuneMetrics gives full metadata but needs a public
 * profile; the wiki fallback only provides names. Existing rows are kept (goals reference them).
 */
export async function refreshQuestCatalogue(characterName: string, existing: RsQuest[]): Promise<{ added: number; total: number }> {
  let rows: { name: string; difficulty: string | null; members: boolean | null; quest_points: number | null }[]
  try {
    rows = (await fetchQuests(characterName)).map(q => ({
      name: q.title, difficulty: q.difficulty, members: q.members, quest_points: q.questPoints,
    }))
  } catch (err) {
    if (!(err instanceof RsApiError)) throw err
    rows = (await fetchWikiQuestNames()).map(name => ({ name, difficulty: null, members: null, quest_points: null }))
  }
  if (rows.length === 0) throw new RsApiError('UPSTREAM_ERROR')

  const known = new Set(existing.map(q => q.name.toLowerCase()))
  const added = rows.filter(r => !known.has(r.name.toLowerCase())).length
  const { error } = await supabase
    .from('rs_quests')
    .upsert(rows.map(r => ({ ...r, updated_at: new Date().toISOString() })), { onConflict: 'name' })
  if (error) throw error
  return { added, total: rows.length }
}
