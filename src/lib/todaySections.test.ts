import { describe, expect, it } from 'vitest'
import { DEFAULT_TODAY_SECTIONS_ORDER, resolveTodaySectionsOrder } from './todaySections'

describe('resolveTodaySectionsOrder', () => {
  it('uses the default order when nothing is stored', () => {
    expect(resolveTodaySectionsOrder(null)).toEqual(DEFAULT_TODAY_SECTIONS_ORDER)
  })

  // The workout widget moved out of the Today card, but saved orders still contain its old key.
  it('drops the retired workout section from a saved order', () => {
    expect(resolveTodaySectionsOrder(['workout', 'habits', 'tasks', 'events', 'next_up'])).toEqual(['habits', 'tasks', 'events', 'next_up'])
  })

  it('keeps a custom order and appends sections missing from it', () => {
    expect(resolveTodaySectionsOrder(['tasks', 'tasks', 'bogus'])).toEqual(['tasks', 'next_up', 'events', 'habits'])
  })
})
