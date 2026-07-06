import { supabase } from '../supabase'
import { DEFAULT_BOTTOM_NAV_ITEMS, isNavItemKey, type NavItemKey } from './navItems'

export type FocusPeriod = 'today' | 'week'

const DAILY_COLUMN: Record<FocusPeriod, 'auto_generate_focus_summaries_daily_today' | 'auto_generate_focus_summaries_daily_week'> = {
  today: 'auto_generate_focus_summaries_daily_today',
  week: 'auto_generate_focus_summaries_daily_week',
}

const ON_CHANGE_COLUMN: Record<FocusPeriod, 'auto_generate_focus_summaries_on_change_today' | 'auto_generate_focus_summaries_on_change_week'> = {
  today: 'auto_generate_focus_summaries_on_change_today',
  week: 'auto_generate_focus_summaries_on_change_week',
}

export async function getAutoGenerateFocusSummariesDaily(period: FocusPeriod): Promise<boolean> {
  const column = DAILY_COLUMN[period]
  const { data } = await supabase.from('user_settings').select(column).maybeSingle()
  return (data as Record<string, boolean> | null)?.[column] ?? true
}

export async function setAutoGenerateFocusSummariesDaily(period: FocusPeriod, enabled: boolean): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const column = DAILY_COLUMN[period]
  await supabase.from('user_settings').upsert({ user_id: user.id, [column]: enabled })
}

export async function getAutoGenerateFocusSummariesOnChange(period: FocusPeriod): Promise<boolean> {
  const column = ON_CHANGE_COLUMN[period]
  const { data } = await supabase.from('user_settings').select(column).maybeSingle()
  return (data as Record<string, boolean> | null)?.[column] ?? true
}

export async function setAutoGenerateFocusSummariesOnChange(period: FocusPeriod, enabled: boolean): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const column = ON_CHANGE_COLUMN[period]
  await supabase.from('user_settings').upsert({ user_id: user.id, [column]: enabled })
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

export async function getDefaultFocusPeriod(): Promise<'today' | 'week'> {
  const { data } = await supabase.from('user_settings').select('default_focus_period').maybeSingle()
  return data?.default_focus_period ?? 'week'
}

export async function setDefaultFocusPeriod(period: 'today' | 'week'): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('user_settings').upsert({ user_id: user.id, default_focus_period: period })
}

export async function getBottomNavItems(): Promise<NavItemKey[]> {
  const { data } = await supabase.from('user_settings').select('bottom_nav_items').maybeSingle()
  const stored = (data?.bottom_nav_items ?? []).filter(isNavItemKey)
  return stored.length === 3 ? stored : DEFAULT_BOTTOM_NAV_ITEMS
}

export async function setBottomNavItems(items: NavItemKey[]): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('user_settings').upsert({ user_id: user.id, bottom_nav_items: items })
}
