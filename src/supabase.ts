import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Deliberately not parameterized with <Database>: several columns are backed by a
// Postgres CHECK constraint the generator can't see, so it types them as plain
// `string` — turning on strict client typing here would require touching every one
// of this app's ~120 query call sites to reconcile that with the narrowed literal
// types below. The generated Database type is still the source of truth for the
// exported row types themselves, which is what actually catches schema drift.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']

// Table columns backed by a Postgres CHECK constraint come back as plain `string`
// from the generator (it doesn't parse constraint expressions), so those specific
// columns are narrowed back to literal unions here for the ergonomics the rest of
// the app relies on. Every other field is taken as-is from the generated row type,
// so a column rename/drop in the live schema surfaces as a real compile error here
// instead of silently drifting.

export type Habit = Omit<Row<'habits'>, 'frequency'> & {
  frequency: 'daily' | 'weekly'
}

export type HabitLog = Row<'habit_logs'>

export type Todo = Omit<Row<'todos'>, 'priority' | 'source' | 'recurrence_unit'> & {
  priority: 'low' | 'medium' | 'high'
  source: 'local' | 'google'
  recurrence_unit: 'day' | 'week' | 'month' | null
}

export type ClimbingSession = Row<'climbing_sessions'>

export type ClimbingAttempt = Omit<Row<'climbing_attempts'>, 'result'> & {
  result: 'sent' | 'project' | 'completed_project'
}

export type ShoppingItem = Row<'shopping_items'>

export type CalendarEvent = Omit<Row<'events'>, 'source'> & {
  source: 'local' | 'google'
}

export type FileRecord = Omit<Row<'files'>, 'source'> & {
  source: 'local' | 'google_drive'
}

export type StockAlert = Row<'stock_alerts'>

export type GoogleDriveFolder = Omit<Row<'google_drive_folders'>, 'sync_status'> & {
  sync_status: 'idle' | 'syncing' | 'error'
}

export type UserSettings = Omit<Row<'user_settings'>, 'default_focus_period' | 'bottom_nav_items'> & {
  default_focus_period: 'today' | 'week'
  bottom_nav_items: string[]
}

export type FocusSummary = Omit<Row<'focus_summaries'>, 'period' | 'status'> & {
  period: 'today' | 'week'
  status: 'ready' | 'error'
}

// `FocusSummary.summary` stores JSON.stringify(FocusSummaryPayload). The 'text'
// variant covers both a malformed model response and summaries generated
// before cards existed, so old cached rows keep rendering. This shape lives
// inside a `text` column, so the generator has no way to know about it —
// kept hand-written rather than derived.
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

export type WeatherCache = Omit<Row<'weather_cache'>, 'status'> & {
  status: 'ready' | 'error'
}

export type ApiToken = Row<'api_tokens'>

export type Notification = Row<'notifications'>

export type Friend = Omit<Row<'friends'>, 'goal_unit' | 'goal_mode'> & {
  goal_unit: 'day' | 'week' | 'month' | 'year'
  goal_mode: 'interval' | 'frequency' | 'none'
}

export type FriendInteraction = Row<'friend_interactions'>

export type TodoFriend = Row<'todo_friends'>

export type EventFriend = Row<'event_friends'>

export type Recipe = Omit<Row<'recipes'>, 'import_method'> & {
  import_method: 'manual' | 'prompt' | 'paste' | 'link'
}

export type RecipeIngredient = Row<'recipe_ingredients'>

export type RecipeStep = Row<'recipe_steps'>

export type RecipeCollection = Row<'recipe_collections'>

export type RecipeCollectionItem = Row<'recipe_collection_items'>

export type ClientError = Row<'client_errors'>
