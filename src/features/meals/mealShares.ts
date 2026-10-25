// Pure helpers for meal share links (the public, no-login meal picker). Type-only
// imports so this file (and its tests) never load the Supabase client.
import type { MealTag } from '../../supabase'
import { MEAL_TAG_LABELS } from './meals'
import type { TagFilter } from './meals'

/** What get_meal_share returns for each meal - the only fields the public page sees. */
export type SharedMeal = {
  id: string
  name: string
  description: string | null
  tags: MealTag[]
  image_url: string | null
}

/** The get_meal_share payload; the RPC returns null for an unknown or expired link. */
export type SharedMealList = {
  tag: TagFilter
  expires_at: string
  picked_meal_id: string | null
  meals: SharedMeal[]
}

export function mealShareUrl(origin: string, token: string): string {
  return `${origin}/pick/${token}`
}

export function shareTagLabel(tag: TagFilter): string {
  return tag === 'all' ? 'All meals' : MEAL_TAG_LABELS[tag]
}

export function isShareActive(share: { expires_at: string }, now: number = Date.now()): boolean {
  return new Date(share.expires_at).getTime() > now
}

/** "23h left", "45m left", or "expired". Rounds up, so a live link never reads "0m left". */
export function formatTimeLeft(expiresAt: string, now: number = Date.now()): string {
  const ms = new Date(expiresAt).getTime() - now
  if (ms <= 0) return 'expired'
  const minutes = Math.ceil(ms / 60_000)
  if (minutes < 60) return `${minutes}m left`
  return `${Math.floor(minutes / 60)}h left`
}
