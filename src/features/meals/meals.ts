// Pure helpers for the Meal ideas feature. Type-only imports so this file (and
// its tests) never load the Supabase client.
import type { Meal, MealTag } from '../../supabase'

export const MEAL_TAGS: MealTag[] = ['breakfast', 'lunch', 'dinner', 'dessert']

export const MEAL_TAG_LABELS: Record<MealTag, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  dessert: 'Dessert',
}

export type TagFilter = MealTag | 'all'

export const DEFAULT_TAG_FILTER: TagFilter = 'dinner'

/** Reads the `tag` URL param; anything missing or unknown falls back to the default. */
export function parseTagFilter(raw: string | null): TagFilter {
  if (raw === 'all') return 'all'
  return (MEAL_TAGS as string[]).includes(raw ?? '') ? (raw as MealTag) : DEFAULT_TAG_FILTER
}

/** The default filter is omitted from the URL; `null` means "no param". */
export function tagFilterToParam(filter: TagFilter): string | null {
  return filter === DEFAULT_TAG_FILTER ? null : filter
}

/** Tag filter AND search (name or description). Preserves input order. */
export function filterMeals(meals: Meal[], tag: TagFilter, query: string): Meal[] {
  const q = query.trim().toLowerCase()
  return meals.filter(meal => {
    if (tag !== 'all' && !meal.tags.includes(tag)) return false
    if (!q) return true
    return meal.name.toLowerCase().includes(q) || (meal.description ?? '').toLowerCase().includes(q)
  })
}

/**
 * Picks a random meal, avoiding `excludeId` (the one just shown) so "Another
 * one" never repeats - unless it's the only candidate.
 */
export function pickRandomMeal<T extends { id: string }>(
  candidates: T[],
  excludeId?: string | null,
  rng: () => number = Math.random,
): T | null {
  if (candidates.length === 0) return null
  const pool = candidates.length > 1 ? candidates.filter(m => m.id !== excludeId) : candidates
  const index = Math.min(pool.length - 1, Math.floor(rng() * pool.length))
  return pool[index]
}

/** Adds or removes a tag, keeping tags in canonical (breakfast → dessert) order. */
export function toggleTag(tags: MealTag[], tag: MealTag): MealTag[] {
  const next = tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag]
  return MEAL_TAGS.filter(t => next.includes(t))
}

/** The meal's own photo, else the linked recipe's photo, else nothing. */
export function mealImageUrl(meal: Pick<Meal, 'image_url' | 'recipe'>): string | null {
  return meal.image_url ?? meal.recipe?.image_url ?? null
}

/** A meal can be saved with just a name and at least one tag. */
export function isMealValid({ name, tags }: { name: string; tags: MealTag[] }): boolean {
  return name.trim().length > 0 && tags.length > 0
}

/**
 * After quick-adding a meal from the grid, the active filter or search might
 * hide it - and a card that vanishes looks like the save failed. Returns the
 * minimal adjustment that keeps the new meal visible: switch to its first tag
 * if the current tag filter excludes it, and clear a search its name doesn't
 * match. Untouched when it already shows.
 */
export function filterAfterAdd(
  current: { tag: TagFilter; query: string },
  added: { name: string; tags: MealTag[] },
): { tag: TagFilter; query: string } {
  let { tag, query } = current
  if (tag !== 'all' && !added.tags.includes(tag)) {
    tag = MEAL_TAGS.find(t => added.tags.includes(t)) ?? 'all'
  }
  const q = query.trim().toLowerCase()
  if (q && !added.name.toLowerCase().includes(q)) query = ''
  return { tag, query }
}
