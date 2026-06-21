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
}

export type HabitLog = {
  id: string
  habit_id: string
  user_id: string
  logged_date: string
  created_at: string
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
}

export type Reminder = {
  id: string
  user_id: string
  title: string
  remind_at: string
  repeat: 'daily' | 'weekly' | 'monthly' | null
  notified_at: string | null
  created_at: string
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
  notes: string | null
  created_at: string
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

export type Notification = {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  read: boolean
  created_at: string
}
