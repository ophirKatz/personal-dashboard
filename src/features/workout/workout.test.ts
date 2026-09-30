import { describe, expect, it } from 'vitest'
import { pickDefaultPreset, summarizeItem } from './workoutUtils'

describe('pickDefaultPreset', () => {
  it('prefers the default preset', () => {
    const presets = [{ id: 'a', is_default: false }, { id: 'b', is_default: true }]
    expect(pickDefaultPreset(presets)?.id).toBe('b')
  })
  it('falls back to the first preset', () => {
    expect(pickDefaultPreset([{ id: 'a', is_default: false }])?.id).toBe('a')
  })
  it('returns undefined when empty', () => {
    expect(pickDefaultPreset([])).toBeUndefined()
  })
})

describe('summarizeItem', () => {
  it('formats sets × reps', () => {
    expect(summarizeItem({ exercise_name: 'Push ups', sets: 3, reps: 15 })).toBe('Push ups 3×15')
  })
})
