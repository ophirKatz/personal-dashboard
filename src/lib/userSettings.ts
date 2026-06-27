import { supabase } from '../supabase'

export async function getAutoGenerateFocusSummariesDaily(): Promise<boolean> {
  const { data } = await supabase.from('user_settings').select('auto_generate_focus_summaries_daily').maybeSingle()
  return data?.auto_generate_focus_summaries_daily ?? true
}

export async function setAutoGenerateFocusSummariesDaily(enabled: boolean): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('user_settings').upsert({ user_id: user.id, auto_generate_focus_summaries_daily: enabled })
}

export async function getAutoGenerateFocusSummariesOnChange(): Promise<boolean> {
  const { data } = await supabase.from('user_settings').select('auto_generate_focus_summaries_on_change').maybeSingle()
  return data?.auto_generate_focus_summaries_on_change ?? true
}

export async function setAutoGenerateFocusSummariesOnChange(enabled: boolean): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('user_settings').upsert({ user_id: user.id, auto_generate_focus_summaries_on_change: enabled })
}

export async function getShowFocusSection(): Promise<boolean> {
  const { data } = await supabase.from('user_settings').select('show_focus_section').maybeSingle()
  return data?.show_focus_section ?? true
}

export async function setShowFocusSection(show: boolean): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('user_settings').upsert({ user_id: user.id, show_focus_section: show })
}
