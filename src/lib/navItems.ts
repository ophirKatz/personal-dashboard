import { CheckSquare, Calendar, Folder, TrendingUp, Mountain, ShoppingCart, DollarSign, Users, ChefHat } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavItemKey = 'todos' | 'calendar' | 'files' | 'habits' | 'climbing' | 'shopping' | 'finance' | 'friends' | 'recipes'

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
}

export const ALL_NAV_KEYS = Object.keys(NAV_ITEMS) as NavItemKey[]

export const DEFAULT_BOTTOM_NAV_ITEMS: NavItemKey[] = ['todos', 'calendar', 'files']

export const BOTTOM_NAV_ITEMS_CHANGED_EVENT = 'bottom-nav-items-changed'

export function isNavItemKey(value: string): value is NavItemKey {
  return (ALL_NAV_KEYS as string[]).includes(value)
}
