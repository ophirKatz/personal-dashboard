import { supabase } from '../supabase'

export async function getAutoGenerateFocusSummaries(): Promise<boolean> {
  const { data } = await supabase.from('user_settings').select('auto_generate_focus_summaries').maybeSingle()
  return data?.auto_generate_focus_summaries ?? true
}

export async function setAutoGenerateFocusSummaries(enabled: boolean): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('user_settings').upsert({ user_id: user.id, auto_generate_focus_summaries: enabled })
}
