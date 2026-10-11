import { describe, it, expect } from 'vitest'
import type { Meal, MealTag } from '../../supabase'
import {
  DEFAULT_TAG_FILTER,
  filterMeals,
  isMealValid,
  mealImageUrl,
  parseTagFilter,
  pickRandomMeal,
  tagFilterToParam,
  toggleTag,
} from './meals'

function meal(id: string, name: string, tags: MealTag[] = [], extra: Partial<Meal> = {}): Meal {
  return {
    id,
    user_id: 'u1',
    name,
    description: null,
    image_url: null,
    recipe_id: null,
    tags,
    created_at: '2026-10-11T00:00:00Z',
    ...extra,
  }
}

const meals = [
  meal('1', 'Spaghetti Bolognese', ['dinner']),
  meal('2', 'Chicken Bowls', ['lunch', 'dinner'], { description: 'Rice, shawarma chicken' }),
  meal('3', 'Pancakes', ['breakfast', 'dessert']),
  meal('4', 'Leftovers'),
]

describe('parseTagFilter / tagFilterToParam', () => {
  it('defaults to dinner for missing or unknown values', () => {
    expect(DEFAULT_TAG_FILTER).toBe('dinner')
    expect(parseTagFilter(null)).toBe('dinner')
    expect(parseTagFilter('')).toBe('dinner')
    expect(parseTagFilter('brunch')).toBe('dinner')
  })

  it('accepts every tag and "all"', () => {
    expect(parseTagFilter('breakfast')).toBe('breakfast')
    expect(parseTagFilter('lunch')).toBe('lunch')
    expect(parseTagFilter('dessert')).toBe('dessert')
    expect(parseTagFilter('all')).toBe('all')
  })

  it('omits the default from the URL but writes everything else', () => {
    expect(tagFilterToParam('dinner')).toBeNull()
    expect(tagFilterToParam('all')).toBe('all')
    expect(tagFilterToParam('lunch')).toBe('lunch')
  })
})

describe('filterMeals', () => {
  it('"all" keeps every meal, including untagged ones', () => {
    expect(filterMeals(meals, 'all', '').map(m => m.id)).toEqual(['1', '2', '3', '4'])
  })

  it('a multi-tag meal shows under each of its tags', () => {
    expect(filterMeals(meals, 'dinner', '').map(m => m.id)).toEqual(['1', '2'])
    expect(filterMeals(meals, 'lunch', '').map(m => m.id)).toEqual(['2'])
    expect(filterMeals(meals, 'breakfast', '').map(m => m.id)).toEqual(['3'])
    expect(filterMeals(meals, 'dessert', '').map(m => m.id)).toEqual(['3'])
  })

  it('untagged meals only appear under "all"', () => {
    for (const tag of ['breakfast', 'lunch', 'dinner', 'dessert'] as const) {
      expect(filterMeals(meals, tag, '').some(m => m.id === '4')).toBe(false)
    }
  })

  it('search is case-insensitive, trimmed, and matches name or description', () => {
    expect(filterMeals(meals, 'all', '  PANCA ').map(m => m.id)).toEqual(['3'])
    expect(filterMeals(meals, 'all', 'shawarma').map(m => m.id)).toEqual(['2'])
  })

  it('search is ANDed with the tag filter', () => {
    expect(filterMeals(meals, 'dessert', 'spaghetti')).toEqual([])
    expect(filterMeals(meals, 'dinner', 'bowls').map(m => m.id)).toEqual(['2'])
  })

  it('does not mutate or reorder the input', () => {
    const copy = [...meals]
    filterMeals(meals, 'all', '')
    expect(meals).toEqual(copy)
  })
})

describe('pickRandomMeal', () => {
  it('returns null for an empty list', () => {
    expect(pickRandomMeal([])).toBeNull()
    expect(pickRandomMeal([], 'x')).toBeNull()
  })

  it('returns the only candidate even if it is the excluded one', () => {
    expect(pickRandomMeal([meals[0]], '1')?.id).toBe('1')
  })

  it('maps rng deterministically onto the candidates', () => {
    expect(pickRandomMeal(meals, null, () => 0)?.id).toBe('1')
    expect(pickRandomMeal(meals, null, () => 0.5)?.id).toBe('3')
    expect(pickRandomMeal(meals, null, () => 0.999)?.id).toBe('4')
  })

  it('clamps rng() === 1 to the last candidate instead of overflowing', () => {
    expect(pickRandomMeal(meals, null, () => 1)?.id).toBe('4')
  })

  it('never returns the excluded id when there are other choices', () => {
    for (const r of [0, 0.1, 0.25, 0.34, 0.5, 0.67, 0.75, 0.999, 1]) {
      for (const ex of ['1', '2', '3', '4']) {
        expect(pickRandomMeal(meals, ex, () => r)?.id).not.toBe(ex)
      }
    }
  })

  it('reaches every non-excluded candidate', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 100; i++) seen.add(pickRandomMeal(meals, '1', () => i / 100)!.id)
    expect([...seen].sort()).toEqual(['2', '3', '4'])
  })
})

describe('toggleTag', () => {
  it('adds a tag and keeps canonical order', () => {
    expect(toggleTag(['dinner'], 'breakfast')).toEqual(['breakfast', 'dinner'])
    expect(toggleTag([], 'dessert')).toEqual(['dessert'])
  })

  it('removes a tag that is already present', () => {
    expect(toggleTag(['breakfast', 'dinner'], 'breakfast')).toEqual(['dinner'])
    expect(toggleTag(['dinner'], 'dinner')).toEqual([])
  })

  it('does not mutate its input', () => {
    const tags: MealTag[] = ['dinner']
    toggleTag(tags, 'lunch')
    expect(tags).toEqual(['dinner'])
  })
})

describe('mealImageUrl', () => {
  const recipe = { id: 'r1', title: 'Shakshuka', image_url: 'https://x/recipe.jpg' }

  it('prefers the meal\'s own image', () => {
    expect(mealImageUrl({ image_url: 'https://x/own.jpg', recipe })).toBe('https://x/own.jpg')
  })

  it('falls back to the linked recipe image', () => {
    expect(mealImageUrl({ image_url: null, recipe })).toBe('https://x/recipe.jpg')
  })

  it('returns null when neither exists', () => {
    expect(mealImageUrl({ image_url: null, recipe: null })).toBeNull()
    expect(mealImageUrl({ image_url: null })).toBeNull()
    expect(mealImageUrl({ image_url: null, recipe: { ...recipe, image_url: null } })).toBeNull()
  })
})

describe('isMealValid', () => {
  it('is valid with just a name and one tag', () => {
    expect(isMealValid({ name: 'Tuna melt', tags: ['dinner'] })).toBe(true)
    expect(isMealValid({ name: 'Pancakes', tags: ['breakfast', 'dessert'] })).toBe(true)
  })

  it('needs at least one tag', () => {
    expect(isMealValid({ name: 'Tuna melt', tags: [] })).toBe(false)
  })

  it('needs a non-blank name', () => {
    expect(isMealValid({ name: '', tags: ['dinner'] })).toBe(false)
    expect(isMealValid({ name: '   ', tags: ['dinner'] })).toBe(false)
  })

  it('needs both', () => {
    expect(isMealValid({ name: '', tags: [] })).toBe(false)
  })
})
