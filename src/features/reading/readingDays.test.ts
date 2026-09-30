import { describe, expect, it, vi } from 'vitest'

vi.mock('../../supabase', () => ({ supabase: { from: vi.fn() } }))

const { currentStreak, recentDays, nudgeCopy } = await import('./readingDays')

describe('currentStreak', () => {
  it('counts consecutive days ending today', () => {
    expect(currentStreak(['2026-09-30', '2026-09-29', '2026-09-28'], '2026-09-30')).toBe(3)
  })
  it('stays alive when only today is still unread', () => {
    expect(currentStreak(['2026-09-29', '2026-09-28'], '2026-09-30')).toBe(2)
  })
  it('resets after a missed day', () => {
    expect(currentStreak(['2026-09-28', '2026-09-27'], '2026-09-30')).toBe(0)
  })
  it('stops at the first gap', () => {
    expect(currentStreak(['2026-09-30', '2026-09-28'], '2026-09-30')).toBe(1)
  })
  it('crosses month boundaries', () => {
    expect(currentStreak(['2026-10-01', '2026-09-30', '2026-09-29'], '2026-10-01')).toBe(3)
  })
})

describe('recentDays', () => {
  it('returns 7 days oldest first, flagging read days and today', () => {
    const week = recentDays(['2026-09-30', '2026-09-27'], '2026-09-30')
    expect(week.map(d => d.key)[0]).toBe('2026-09-24')
    expect(week).toHaveLength(7)
    expect(week.filter(d => d.read).map(d => d.key)).toEqual(['2026-09-27', '2026-09-30'])
    expect(week[6].isToday).toBe(true)
  })
})

describe('nudgeCopy', () => {
  it('warns about the streak in the evening', () => {
    expect(nudgeCopy(4, 21, 0).title).toContain('4-day streak')
  })
  it('invites starting a streak when there is none', () => {
    expect(nudgeCopy(0, 10, 0).sub).toBe('Start a streak today')
  })
})
