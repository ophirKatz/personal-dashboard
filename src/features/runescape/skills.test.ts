import { describe, expect, it } from 'vitest'
import { SKILLS, SKILL_BY_ID, levelForXp, progressToNext, skillLevel, xpForLevel } from './skills'

describe('xp table', () => {
  it('matches known RS3 thresholds', () => {
    expect(xpForLevel(2)).toBe(83)
    expect(xpForLevel(10)).toBe(1154)
    expect(xpForLevel(50)).toBe(101333)
    expect(xpForLevel(99)).toBe(13034431)
    expect(xpForLevel(120)).toBe(104273167)
  })

  it('derives level from xp', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(82)).toBe(1)
    expect(levelForXp(83)).toBe(2)
    expect(levelForXp(13034431)).toBe(99)
    expect(levelForXp(200_000_000, 99)).toBe(99)
    expect(levelForXp(13034431, 120)).toBe(99)
    expect(levelForXp(104273167, 120)).toBe(120)
  })

  it('computes progress to next level', () => {
    expect(progressToNext(83, 2, 99)).toBeCloseTo(0, 5)
    expect(progressToNext(xpForLevel(50), 50, 99)).toBe(0)
    expect(progressToNext(13034431, 99, 99)).toBe(1)
    const mid = (xpForLevel(30) + xpForLevel(31)) / 2
    expect(progressToNext(mid, 30, 99)).toBeCloseTo(0.5, 2)
  })
})

describe('skillLevel', () => {
  it('derives virtual levels the API caps at 99', () => {
    const defence = SKILL_BY_ID.get(1)!
    expect(skillLevel(defence, { level: 99, xp: xpForLevel(117) })).toBe(117)
    expect(skillLevel(defence, { level: 99, xp: xpForLevel(99) })).toBe(99)
  })

  it('trusts the API level for elite skills', () => {
    expect(skillLevel(SKILL_BY_ID.get(26)!, { level: 80, xp: 200_000_000 })).toBe(80)
  })
})

describe('skills table', () => {
  it('has 29 skills with contiguous ids', () => {
    expect(SKILLS).toHaveLength(29)
    SKILLS.forEach((s, i) => expect(s.id).toBe(i))
  })
})
