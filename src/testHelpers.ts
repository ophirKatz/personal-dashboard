import type { Habit, HabitLog, Friend, FriendInteraction } from './supabase'
import { today } from './utils'

export function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    user_id: 'user-1',
    name: 'Daily pushups',
    emoji: '💪',
    color: '#3b82f6',
    frequency: 'daily',
    times_per_week: null,
    reminder_enabled: false,
    reminder_time: null,
    last_notified_date: null,
    created_at: '2026-01-01T00:00:00.000Z',
    debt: 0,
    debt_checked_date: null,
    ...overrides,
  }
}

export function makeLog(overrides: Partial<HabitLog> = {}): HabitLog {
  return {
    id: 'log-1',
    habit_id: 'habit-1',
    user_id: 'user-1',
    logged_date: today(),
    created_at: '2026-06-29T08:00:00.000Z',
    paid_debt: false,
    ...overrides,
  }
}

export function makeFriend(overrides: Partial<Friend> = {}): Friend {
  return {
    id: 'friend-1',
    user_id: 'user-1',
    name: 'Alex',
    notes: null,
    details: null,
    avatar_url: null,
    goal_count: 1,
    goal_unit: 'month',
    goal_mode: 'interval',
    reminder_enabled: true,
    last_notified_date: null,
    reminder_notified_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export function makeFriendInteraction(overrides: Partial<FriendInteraction> = {}): FriendInteraction {
  return {
    id: 'interaction-1',
    friend_id: 'friend-1',
    user_id: 'user-1',
    interaction_date: today(),
    note: null,
    source_event_id: null,
    source_todo_id: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}
