import { describe, expect, it } from 'vitest'
import { formatActivityDate } from './api'

describe('formatActivityDate', () => {
  it('converts UTC RuneMetrics dates to Israel time (summer, UTC+3)', () => {
    expect(formatActivityDate('05-Oct-2026 07:24')).toBe('05-Oct-2026 10:24')
  })
  it('handles winter time and day rollover (UTC+2)', () => {
    expect(formatActivityDate('31-Dec-2026 22:30')).toBe('01-Jan-2027 00:30')
  })
  it('returns unparseable input unchanged', () => {
    expect(formatActivityDate('whenever')).toBe('whenever')
  })
})
