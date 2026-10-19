import { describe, expect, it } from 'vitest'
import { ARCHAEOLOGY_GROUPS } from './archaeology-data'
import { MAX_COUNT, clampCount, groupArtefacts, isComplete, summarize, toFoundMap, type ArchaeologyArtefact } from './archaeology'

const all = ARCHAEOLOGY_GROUPS.flatMap(groupArtefacts)

describe('archaeology data', () => {
  it('has every artefact from the wiki Methods tables', () => {
    expect(ARCHAEOLOGY_GROUPS.map(g => g.group)).toEqual(['Levels 1–42', 'Levels 42–70', 'Levels 70–90', 'Levels 90–99', 'Levels 99–120+'])
    expect(ARCHAEOLOGY_GROUPS.flatMap(g => g.hotspots)).toHaveLength(93)
    expect(all).toHaveLength(223)
    expect(all.reduce((n, a) => n + a.needed, 0)).toBe(585)
  })

  it('has unique keys and hotspots, and a positive whole requirement for every artefact', () => {
    expect(new Set(all.map(a => a.key)).size).toBe(all.length)
    const hotspots = ARCHAEOLOGY_GROUPS.flatMap(g => g.hotspots)
    expect(new Set(hotspots.map(h => `${h.level}|${h.hotspot}`)).size).toBe(hotspots.length)
    expect(hotspots.every(h => h.artefacts.length > 0)).toBe(true)
    expect(all.every(a => Number.isInteger(a.needed) && a.needed >= 1 && a.key !== '')).toBe(true)
  })

  it('keeps the requirements as listed on the wiki', () => {
    const needed = (key: string) => all.find(a => a.key === key)?.needed
    expect(needed('crest-of-dagon')).toBe(7)
    expect(needed('frying-pan')).toBe(3)
    expect(needed('dragon-burner')).toBe(6)
    expect(needed('ceremonial-dragonkin-tablet')).toBe(1)
  })
})

describe('isComplete', () => {
  it('is complete once found reaches the requirement', () => {
    expect(isComplete(0, 3)).toBe(false)
    expect(isComplete(2, 3)).toBe(false)
    expect(isComplete(3, 3)).toBe(true)
    expect(isComplete(5, 3)).toBe(true)
  })
})

describe('summarize', () => {
  const items: ArchaeologyArtefact[] = [
    { key: 'a', name: 'A', needed: 3 },
    { key: 'b', name: 'B', needed: 2 },
    { key: 'c', name: 'C', needed: 1 },
  ]

  it('counts nothing found as nothing complete', () => {
    expect(summarize(items, {})).toEqual({ complete: 0, total: 3, found: 0, needed: 6 })
  })

  it('counts complete artefacts and partial progress', () => {
    expect(summarize(items, { a: 2, b: 2 })).toEqual({ complete: 1, total: 3, found: 4, needed: 6 })
  })

  it('caps extras at the requirement so they do not offset missing items', () => {
    expect(summarize(items, { a: 9, c: 1 })).toEqual({ complete: 2, total: 3, found: 4, needed: 6 })
  })
})

describe('clampCount', () => {
  it('keeps counts to whole numbers within range', () => {
    expect(clampCount(4)).toBe(4)
    expect(clampCount(2.9)).toBe(2)
    expect(clampCount(-3)).toBe(0)
    expect(clampCount(100000)).toBe(MAX_COUNT)
    expect(clampCount(NaN)).toBe(0)
  })
})

describe('toFoundMap', () => {
  it('keys saved counts by artefact', () => {
    expect(toFoundMap([{ artefact_key: 'a', found: 2 }, { artefact_key: 'b', found: 0 }])).toEqual({ a: 2, b: 0 })
  })
})
