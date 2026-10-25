import { describe, it, expect } from 'vitest'
import {
  formatTimeLeft,
  initialSharedMeal,
  mealShareUrl,
  resolvePick,
  resolveShareLoad,
  shareTagLabel,
} from './mealShares'
import type { SharedMeal, SharedMealList } from './mealShares'

const NOW = new Date('2026-10-25T12:00:00Z').getTime()
const inMinutes = (m: number) => new Date(NOW + m * 60_000).toISOString()

function sharedMeal(id: string, extra: Partial<SharedMeal> = {}): SharedMeal {
  return { id, name: `Meal ${id}`, description: null, tags: ['dinner'], image_url: null, ...extra }
}

function list(meals: SharedMeal[], extra: Partial<SharedMealList> = {}): SharedMealList {
  return { tag: 'dinner', expires_at: inMinutes(60), picked_meal_id: null, meals, ...extra }
}

describe('mealShareUrl', () => {
  it('builds the public picker path from the origin and token', () => {
    expect(mealShareUrl('https://dash.example.com', 'abc123')).toBe('https://dash.example.com/pick/abc123')
  })
})

describe('shareTagLabel', () => {
  it('labels "all" and each meal type', () => {
    expect(shareTagLabel('all')).toBe('All meals')
    expect(shareTagLabel('dinner')).toBe('Dinner')
    expect(shareTagLabel('breakfast')).toBe('Breakfast')
  })
})

describe('formatTimeLeft', () => {
  it('shows whole hours when an hour or more is left', () => {
    expect(formatTimeLeft(inMinutes(24 * 60), NOW)).toBe('24h left')
    expect(formatTimeLeft(inMinutes(90), NOW)).toBe('1h left')
    expect(formatTimeLeft(inMinutes(60), NOW)).toBe('1h left')
  })

  it('shows minutes under an hour, rounding up so a live link never reads 0m', () => {
    expect(formatTimeLeft(inMinutes(45), NOW)).toBe('45m left')
    expect(formatTimeLeft(inMinutes(59), NOW)).toBe('59m left')
    expect(formatTimeLeft(new Date(NOW + 1000).toISOString(), NOW)).toBe('1m left')
  })

  it('reads "expired" at or past the expiry', () => {
    expect(formatTimeLeft(inMinutes(0), NOW)).toBe('expired')
    expect(formatTimeLeft(inMinutes(-30), NOW)).toBe('expired')
  })
})

describe('resolveShareLoad', () => {
  const payload = {
    tag: 'dinner',
    expires_at: '2026-10-26T12:00:00Z',
    picked_meal_id: 'm2',
    meals: [
      { id: 'm1', name: 'Pasta', description: 'Tomato', tags: ['dinner'], image_url: 'https://img/p.jpg' },
      { id: 'm2', name: 'Bowls', description: null, tags: ['lunch', 'dinner'], image_url: null },
    ],
  }

  it('returns the list when the RPC answers with meals', () => {
    expect(resolveShareLoad(payload, null)).toEqual({ status: 'ready', list: payload })
  })

  it('treats null (unknown, revoked or expired link) as invalid, not an error', () => {
    expect(resolveShareLoad(null, null)).toEqual({ status: 'invalid' })
    expect(resolveShareLoad(undefined, null)).toEqual({ status: 'invalid' })
  })

  it('treats a request error as a retryable error, even if data is present', () => {
    expect(resolveShareLoad(null, new Error('network'))).toEqual({ status: 'error' })
    expect(resolveShareLoad(payload, { message: 'boom' })).toEqual({ status: 'error' })
  })

  it('treats a payload that is not a meal list as an error instead of crashing', () => {
    expect(resolveShareLoad('expired', null)).toEqual({ status: 'error' })
    expect(resolveShareLoad(42, null)).toEqual({ status: 'error' })
    expect(resolveShareLoad({}, null)).toEqual({ status: 'error' })
    expect(resolveShareLoad({ meals: 'nope' }, null)).toEqual({ status: 'error' })
    expect(resolveShareLoad({ meals: [null] }, null)).toEqual({ status: 'error' })
    expect(resolveShareLoad({ meals: [{ id: 1, name: 'x' }] }, null)).toEqual({ status: 'error' })
    expect(resolveShareLoad({ meals: [{ id: 'a' }] }, null)).toEqual({ status: 'error' })
  })

  it('accepts an empty list (a link whose meals were all deleted)', () => {
    const result = resolveShareLoad({ ...payload, picked_meal_id: null, meals: [] }, null)
    expect(result).toMatchObject({ status: 'ready', list: { meals: [] } })
  })

  it('fills in missing optional fields so the page never sees undefined', () => {
    const result = resolveShareLoad({ meals: [{ id: 'm1', name: 'Pasta' }] }, null)
    expect(result).toEqual({
      status: 'ready',
      list: {
        tag: 'all',
        expires_at: '',
        picked_meal_id: null,
        meals: [{ id: 'm1', name: 'Pasta', description: null, tags: [], image_url: null }],
      },
    })
  })

  it('drops fields the page does not use', () => {
    const result = resolveShareLoad({ ...payload, meals: [{ ...payload.meals[0], user_id: 'u1', recipe_id: 'r1' }] }, null)
    expect(result.status).toBe('ready')
    if (result.status === 'ready') expect(Object.keys(result.list.meals[0]).sort()).toEqual(['description', 'id', 'image_url', 'name', 'tags'])
  })
})

describe('resolvePick', () => {
  it('maps the RPC results to outcomes', () => {
    expect(resolvePick('ok', null)).toBe('sent')
    expect(resolvePick('expired', null)).toBe('expired')
    expect(resolvePick('invalid_meal', null)).toBe('unavailable')
  })

  it('treats a request error as a failure, even alongside an "ok"', () => {
    expect(resolvePick(null, new Error('network'))).toBe('failed')
    expect(resolvePick('ok', { message: 'boom' })).toBe('failed')
  })

  it('never reports success for an unrecognized answer', () => {
    expect(resolvePick(null, null)).toBe('failed')
    expect(resolvePick(undefined, null)).toBe('failed')
    expect(resolvePick('OK', null)).toBe('failed')
    expect(resolvePick(true, null)).toBe('failed')
    expect(resolvePick('something_new', null)).toBe('failed')
  })
})

describe('initialSharedMeal', () => {
  const meals = [sharedMeal('1'), sharedMeal('2'), sharedMeal('3')]

  it('opens on the already-picked meal when it is still on the list', () => {
    expect(initialSharedMeal(list(meals, { picked_meal_id: '2' }), () => 0)?.id).toBe('2')
  })

  it('falls back to a random meal when nothing was picked', () => {
    expect(initialSharedMeal(list(meals), () => 0)?.id).toBe('1')
    expect(initialSharedMeal(list(meals), () => 0.5)?.id).toBe('2')
    expect(initialSharedMeal(list(meals), () => 0.99)?.id).toBe('3')
  })

  it('falls back to a random meal when the picked one is gone from the list', () => {
    expect(initialSharedMeal(list(meals, { picked_meal_id: 'deleted' }), () => 0.99)?.id).toBe('3')
  })

  it('returns null for an empty list', () => {
    expect(initialSharedMeal(list([]))).toBeNull()
    expect(initialSharedMeal(list([], { picked_meal_id: '2' }))).toBeNull()
  })
})
