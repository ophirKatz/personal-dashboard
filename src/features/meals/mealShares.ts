// Pure helpers for meal share links (the public, no-login meal picker). Type-only
// imports from the Supabase client so this file (and its tests) never load it.
import type { MealTag } from '../../supabase'
import { MEAL_TAG_LABELS, pickRandomMeal } from './meals'
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

/** "23h left", "45m left", or "expired". Rounds up, so a live link never reads "0m left". */
export function formatTimeLeft(expiresAt: string, now: number = Date.now()): string {
  const ms = new Date(expiresAt).getTime() - now
  if (ms <= 0) return 'expired'
  const minutes = Math.ceil(ms / 60_000)
  if (minutes < 60) return `${minutes}m left`
  return `${Math.floor(minutes / 60)}h left`
}

export type ShareLoad =
  | { status: 'ready'; list: SharedMealList }
  /** The link is unknown, revoked or expired. */
  | { status: 'invalid' }
  /** The request failed or the answer wasn't a meal list; worth retrying. */
  | { status: 'error' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Interprets get_meal_share's response. null means the link is dead; a transport
 * error or a payload that isn't a meal list is a (retryable) load error, so a
 * bad response can never crash the page. Missing optional fields are filled in.
 */
export function resolveShareLoad(data: unknown, error: unknown): ShareLoad {
  if (error) return { status: 'error' }
  if (data === null || data === undefined) return { status: 'invalid' }
  if (!isRecord(data) || !Array.isArray(data.meals)) return { status: 'error' }

  const meals: SharedMeal[] = []
  for (const raw of data.meals as unknown[]) {
    if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.name !== 'string') return { status: 'error' }
    meals.push({
      id: raw.id,
      name: raw.name,
      description: typeof raw.description === 'string' ? raw.description : null,
      tags: Array.isArray(raw.tags) ? (raw.tags as MealTag[]) : [],
      image_url: typeof raw.image_url === 'string' ? raw.image_url : null,
    })
  }

  return {
    status: 'ready',
    list: {
      tag: (typeof data.tag === 'string' ? data.tag : 'all') as TagFilter,
      expires_at: typeof data.expires_at === 'string' ? data.expires_at : '',
      picked_meal_id: typeof data.picked_meal_id === 'string' ? data.picked_meal_id : null,
      meals,
    },
  }
}

export type PickOutcome =
  /** Recorded (or already recorded). */
  | 'sent'
  /** The link expired or was revoked. */
  | 'expired'
  /** That meal is no longer one of the link's meals (deleted or retagged). */
  | 'unavailable'
  /** The request failed or the answer was unexpected; worth retrying. */
  | 'failed'

/** Interprets pick_meal_share's text result. Anything unrecognized is a failure, never a success. */
export function resolvePick(data: unknown, error: unknown): PickOutcome {
  if (error) return 'failed'
  if (data === 'ok') return 'sent'
  if (data === 'expired') return 'expired'
  if (data === 'invalid_meal') return 'unavailable'
  return 'failed'
}

/**
 * The meal to open on: the one already picked on this link if it's still on the
 * list (so reopening shows what was chosen), otherwise a random one.
 */
export function initialSharedMeal(list: SharedMealList, rng?: () => number): SharedMeal | null {
  return list.meals.find(m => m.id === list.picked_meal_id) ?? pickRandomMeal(list.meals, null, rng)
}
