import { describe, expect, it } from 'vitest'
import {
  amountColumns, defaultAmount, formatAmount, formatKm, isDistanceExercise, parseKm, pickDefaultPreset, summarizeItem,
} from './workoutUtils'

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
  it('formats a distance item in km, ignoring its placeholder sets/reps', () => {
    expect(summarizeItem({ exercise_name: 'Running', sets: 1, reps: 1, distance_km: 5.5 })).toBe('Running 5.5 km')
  })
})

describe('formatAmount', () => {
  it('treats a null or missing distance as sets × reps', () => {
    expect(formatAmount({ sets: 3, reps: 10, distance_km: null })).toBe('3×10')
    expect(formatAmount({ sets: 3, reps: 10 })).toBe('3×10')
  })
})

describe('formatKm', () => {
  it('drops trailing zeros and keeps at most two decimals', () => {
    expect(formatKm(5)).toBe('5')
    expect(formatKm(5.5)).toBe('5.5')
    expect(formatKm(3.25)).toBe('3.25')
    expect(formatKm(0.1 + 0.2)).toBe('0.3')
  })
})

describe('parseKm', () => {
  it('parses a typed distance, accepting a comma as the decimal mark', () => {
    expect(parseKm('3.2')).toBe(3.2)
    expect(parseKm('3,2')).toBe(3.2)
    expect(parseKm(' 10 ')).toBe(10)
    expect(parseKm('3.')).toBe(3)
  })
  it('rejects input that is not a usable distance, so it never overwrites the stored value', () => {
    expect(parseKm('')).toBeNull()
    expect(parseKm('abc')).toBeNull()
    expect(parseKm('0')).toBeNull()
    expect(parseKm('-2')).toBeNull()
  })
  it('rounds to two decimals and caps at the maximum', () => {
    expect(parseKm('3.456')).toBe(3.46)
    expect(parseKm('5000')).toBe(999)
  })
})

describe('isDistanceExercise / defaultAmount', () => {
  it('only the built-in running exercise is measured in km', () => {
    expect(isDistanceExercise({ builtin_key: 'running' })).toBe(true)
    expect(isDistanceExercise({ builtin_key: 'push_ups' })).toBe(false)
    expect(isDistanceExercise({ builtin_key: null })).toBe(false)
  })
  it('starts running at a distance and everything else at sets × reps', () => {
    expect(defaultAmount({ builtin_key: 'running' })).toEqual({ sets: 1, reps: 1, distance_km: 3 })
    expect(defaultAmount({ builtin_key: 'squats' })).toEqual({ sets: 3, reps: 10, distance_km: null })
  })
})

describe('amountColumns', () => {
  it('writes sets/reps only for a normal item, so it works before the distance migration', () => {
    const cols = amountColumns({ sets: 4, reps: 12, distance_km: null })
    expect(cols).toEqual({ sets: 4, reps: 12 })
    expect('distance_km' in cols).toBe(false)
  })
  it('writes the distance with placeholder sets/reps for a distance item', () => {
    expect(amountColumns({ sets: 3, reps: 10, distance_km: 5 })).toEqual({ sets: 1, reps: 1, distance_km: 5 })
  })
})
