export type TodaySectionKey = 'next_up' | 'events' | 'tasks' | 'habits' | 'workout'

export const TODAY_SECTION_LABELS: Record<TodaySectionKey, string> = {
  next_up: 'Next up',
  events: 'Events',
  tasks: 'Tasks',
  habits: 'Habits',
  workout: 'Workout',
}

export const DEFAULT_TODAY_SECTIONS_ORDER: TodaySectionKey[] = ['next_up', 'events', 'tasks', 'habits', 'workout']

export const TODAY_SECTIONS_CHANGED_EVENT = 'today-sections-changed'

export function isTodaySectionKey(value: unknown): value is TodaySectionKey {
  return typeof value === 'string' && value in TODAY_SECTION_LABELS
}

// Drops unknown/duplicate keys and appends any section missing from the stored
// order, so newly added sections still show up for existing users.
export function resolveTodaySectionsOrder(stored: unknown): TodaySectionKey[] {
  const seen = new Set<TodaySectionKey>()
  if (Array.isArray(stored)) {
    for (const key of stored) if (isTodaySectionKey(key)) seen.add(key)
  }
  for (const key of DEFAULT_TODAY_SECTIONS_ORDER) seen.add(key)
  return [...seen]
}
