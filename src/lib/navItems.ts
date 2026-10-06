import { CheckSquare, Calendar, Folder, TrendingUp, Mountain, ShoppingCart, DollarSign, Users, ChefHat, Dices, BookOpen, Swords, Dumbbell, FileText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavItemKey = 'todos' | 'calendar' | 'files' | 'habits' | 'climbing' | 'shopping' | 'finance' | 'friends' | 'recipes' | 'games' | 'reading' | 'runescape' | 'workout' | 'pdf'

export const NAV_ITEMS: Record<NavItemKey, { to: string; icon: LucideIcon; label: string }> = {
  todos: { to: '/todos', icon: CheckSquare, label: 'Tasks' },
  calendar: { to: '/calendar', icon: Calendar, label: 'Calendar' },
  files: { to: '/files', icon: Folder, label: 'Files' },
  habits: { to: '/habits', icon: TrendingUp, label: 'Habits' },
  climbing: { to: '/climbing', icon: Mountain, label: 'Climbing' },
  shopping: { to: '/shopping', icon: ShoppingCart, label: 'Shopping' },
  finance: { to: '/finance', icon: DollarSign, label: 'Finance' },
  friends: { to: '/friends', icon: Users, label: 'Friends' },
  recipes: { to: '/recipes', icon: ChefHat, label: 'Recipes' },
  games: { to: '/games', icon: Dices, label: 'Games' },
  reading: { to: '/reading', icon: BookOpen, label: 'Reading' },
  runescape: { to: '/runescape', icon: Swords, label: 'RuneScape' },
  workout: { to: '/workout', icon: Dumbbell, label: 'Workout' },
  pdf: { to: '/pdf-tools', icon: FileText, label: 'PDF tools' },
}

export const ALL_NAV_KEYS = Object.keys(NAV_ITEMS) as NavItemKey[]

// Sections shown in the mobile "More" grid. Users can customize these (stored
// in user_settings.more_sections); this is the layout used until they do.
export type MoreSection = { id: string; title: string; items: NavItemKey[] }

export const DEFAULT_MORE_SECTIONS: MoreSection[] = [
  { id: 'leisure', title: 'Leisure', items: ['climbing', 'reading', 'runescape', 'workout', 'games'] },
  { id: 'other', title: 'Everything else', items: [] },
]

export const MORE_SECTIONS_CHANGED_EVENT = 'more-sections-changed'

// Normalizes a stored layout against the pages that currently belong in "More":
// drops unknown/duplicate/bottom-bar keys, and appends any page not placed in a
// section (e.g. one added to the app later) to the last section.
export function resolveMoreSections(stored: MoreSection[] | null | undefined, moreKeys: NavItemKey[]): MoreSection[] {
  const sections = (stored && stored.length > 0 ? stored : DEFAULT_MORE_SECTIONS).map(s => ({ ...s, items: [] as NavItemKey[] }))
  const source = stored && stored.length > 0 ? stored : DEFAULT_MORE_SECTIONS
  const placed = new Set<NavItemKey>()
  source.forEach((s, i) => {
    for (const key of s.items) {
      if (moreKeys.includes(key) && !placed.has(key)) {
        placed.add(key)
        sections[i].items.push(key)
      }
    }
  })
  const last = sections[sections.length - 1]
  for (const key of moreKeys) if (!placed.has(key)) last.items.push(key)
  return sections
}

export const DEFAULT_BOTTOM_NAV_ITEMS: NavItemKey[] = ['todos', 'calendar', 'files']

export const BOTTOM_NAV_ITEMS_CHANGED_EVENT = 'bottom-nav-items-changed'

export function isNavItemKey(value: string): value is NavItemKey {
  return (ALL_NAV_KEYS as string[]).includes(value)
}
