import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Habit = {
  id: string
  user_id: string
  name: string
  emoji: string
  color: string
  frequency: 'daily' | 'weekly'
  times_per_week: number | null
  reminder_enabled: boolean
  reminder_time: string | null
  last_notified_date: string | null
  created_at: string
  debt: number
  debt_checked_date: string | null
}

export type HabitLog = {
  id: string
  habit_id: string
  user_id: string
  logged_date: string
  created_at: string
  paid_debt: boolean
}

export type Todo = {
  id: string
  user_id: string
  title: string
  notes: string | null
  due_date: string | null
  due_time: string | null
  priority: 'low' | 'medium' | 'high'
  completed: boolean
  completed_at: string | null
  created_at: string
  reminder_enabled: boolean
  remind_at: string | null
  notified_at: string | null
  source: 'local' | 'google'
  google_task_id: string | null
  source_event_id: string | null
  recurrence_interval: number | null
  recurrence_unit: 'day' | 'week' | 'month' | null
}

export type ClimbingSession = {
  id: string
  user_id: string
  session_date: string
  notes: string | null
  created_at: string
}

export type ClimbingAttempt = {
  id: string
  session_id: string
  user_id: string
  grade: string
  result: 'sent' | 'project'
  created_at: string
}

export type ShoppingItem = {
  id: string
  user_id: string
  name: string
  checked: boolean
  created_at: string
}

export type CalendarEvent = {
  id: string
  user_id: string
  title: string
  event_date: string
  event_time: string | null
  event_end_date: string | null
  event_end_time: string | null
  notes: string | null
  location: string | null
  created_at: string
  source: 'local' | 'google'
  google_event_id: string | null
  google_account_id: string | null
  html_link: string | null
}

export type FileRecord = {
  id: string
  user_id: string
  name: string
  folder: string
  storage_path: string
  notes: string | null
  size_bytes: number
  mime_type: string
  created_at: string
  source: 'local' | 'google_drive'
  root_folder_id: string | null
  drive_file_id: string | null
  relative_path: string
  drive_modified_time: string | null
  is_starred: boolean
}

export type StockAlert = {
  id: string
  user_id: string
  symbol: string
  target_price: number
  triggered_at: string | null
  created_at: string
}

export type GoogleDriveFolder = {
  id: string
  user_id: string
  folder_id: string
  folder_name: string
  created_at: string
  sync_status: 'idle' | 'syncing' | 'error'
  sync_error: string | null
  last_synced_at: string | null
}

export type UserSettings = {
  user_id: string
  auto_generate_focus_summaries_daily: boolean
  auto_generate_focus_summaries_on_change: boolean
  show_focus_section: boolean
  updated_at: string
}

export type FocusSummary = {
  id: string
  user_id: string
  period: 'today' | 'week'
  summary: string | null
  status: 'ready' | 'error'
  error: string | null
  generated_at: string | null
  updated_at: string
}

// `FocusSummary.summary` stores JSON.stringify(FocusSummaryPayload). The 'text'
// variant covers both a malformed model response and summaries generated
// before cards existed, so old cached rows keep rendering.
export type FocusCardItem = {
  type: 'todo' | 'event'
  id: string
  title: string
  date: string | null
  time: string | null
  priority?: 'low' | 'medium' | 'high'
  source?: 'local' | 'google'
}

export type FocusCard = {
  label: string
  insight: string
  items: FocusCardItem[]
}

export type FocusSummaryPayload =
  | { type: 'cards'; cards: FocusCard[]; note: string | null }
  | { type: 'text'; text: string }

export type WeatherCache = {
  id: string
  user_id: string
  latitude: number
  longitude: number
  temperature: number | null
  feels_like: number | null
  weather_code: number | null
  condition: string | null
  is_day: boolean | null
  humidity: number | null
  wind_speed: number | null
  status: 'ready' | 'error'
  error: string | null
  fetched_at: string | null
  updated_at: string
}

export type ApiToken = {
  id: string
  user_id: string
  label: string
  token_hash: string
  last_used_at: string | null
  created_at: string
}

export type Notification = {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  read: boolean
  created_at: string
}

export type Friend = {
  id: string
  user_id: string
  name: string
  notes: string | null
  avatar_url: string | null
  goal_count: number
  goal_unit: 'day' | 'week' | 'month' | 'year'
  goal_mode: 'interval' | 'frequency'
  reminder_enabled: boolean
  last_notified_date: string | null
  reminder_notified_at: string | null
  created_at: string
}

export type FriendInteraction = {
  id: string
  friend_id: string
  user_id: string
  interaction_date: string
  note: string | null
  created_at: string
}
