import { describe, it, expect } from 'vitest'
import { formatTimeLeft, isShareActive, mealShareUrl, shareTagLabel } from './mealShares'

const NOW = new Date('2026-10-25T12:00:00Z').getTime()
const inMinutes = (m: number) => new Date(NOW + m * 60_000).toISOString()

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

describe('isShareActive', () => {
  it('is active until the expiry instant', () => {
    expect(isShareActive({ expires_at: inMinutes(1) }, NOW)).toBe(true)
    expect(isShareActive({ expires_at: inMinutes(0) }, NOW)).toBe(false)
    expect(isShareActive({ expires_at: inMinutes(-1) }, NOW)).toBe(false)
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
    expect(formatTimeLeft(new Date(NOW + 1000).toISOString(), NOW)).toBe('1m left')
  })

  it('reads "expired" at or past the expiry', () => {
    expect(formatTimeLeft(inMinutes(0), NOW)).toBe('expired')
    expect(formatTimeLeft(inMinutes(-30), NOW)).toBe('expired')
  })
})
