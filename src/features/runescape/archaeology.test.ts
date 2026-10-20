import { describe, expect, it } from 'vitest'
import { ARCHAEOLOGY_COLLECTIONS, ARCHAEOLOGY_GROUPS } from './archaeology-data'
import { ARCHAEOLOGY_MYSTERIES } from './archaeology-mysteries-data'
import { ARCHAEOLOGY_MYSTERY_NOTES } from './archaeology-mystery-notes'
import { MAX_COUNT, clampCount, groupArtefacts, isComplete, mysteryProgressKey, summarize, toFoundMap, type ArchaeologyArtefact } from './archaeology'

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

describe('archaeology dig sites', () => {
  it('names the dig site of every hotspot', () => {
    const hotspots = ARCHAEOLOGY_GROUPS.flatMap(g => g.hotspots)
    expect(hotspots.every(h => h.digSite.endsWith('Dig Site'))).toBe(true)
    expect([...new Set(hotspots.map(h => h.digSite))].sort()).toEqual([
      'Daemonheim Dig Site',
      'Everlight Dig Site',
      'Infernal Source Dig Site',
      'Kharid-et Dig Site',
      'Moonrise Dig Site',
      'Orthen Dig Site',
      'Senntisten Dig Site',
      'Stormguard Citadel Dig Site',
      'Warforge Dig Site',
    ])
  })

  it('places a few artefacts where the wiki does', () => {
    const siteOf = (key: string) => ARCHAEOLOGY_GROUPS.flatMap(g => g.hotspots).find(h => h.artefacts.some(a => a.key === key))?.digSite
    expect(siteOf('venator-dagger')).toBe('Kharid-et Dig Site')
    expect(siteOf('crest-of-dagon')).toBe('Infernal Source Dig Site')
    expect(siteOf('frying-pan')).toBe('Everlight Dig Site')
    expect(siteOf('ikovian-gerege')).toBe('Stormguard Citadel Dig Site')
  })

  it('keeps artefact keys free of the prefix mysteries use', () => {
    expect(all.some(a => a.key.includes(':'))).toBe(false)
  })
})

describe('archaeology collections', () => {
  const startLevel = (range: string) => Number(range.match(/\d+/)![0])
  const hotspotLevel = new Map(ARCHAEOLOGY_GROUPS.flatMap(g => g.hotspots).flatMap(h => h.artefacts.map(a => [a.key, startLevel(h.level)] as const)))

  it('merges the NPC and Museum versions into one collection each', () => {
    expect(ARCHAEOLOGY_COLLECTIONS).toHaveLength(54)
    expect(new Set(ARCHAEOLOGY_COLLECTIONS.map(c => c.name)).size).toBe(54)
    const zarosian = ARCHAEOLOGY_COLLECTIONS.find(c => c.name === 'Zarosian I')!
    expect(zarosian.handlers).toEqual([
      { name: 'Soran, Emissary of Zaros', museum: false },
      { name: 'Velucia', museum: true },
    ])
    expect(ARCHAEOLOGY_COLLECTIONS.find(c => c.name === 'Zarosian V')!.handlers).toEqual([{ name: 'Velucia', museum: true }])
  })

  it('is complete from the guide level of its last artefact', () => {
    for (const c of ARCHAEOLOGY_COLLECTIONS) {
      expect(c.artefacts.length).toBeGreaterThan(0)
      expect(c.level).toBe(Math.max(...c.artefacts.map(a => hotspotLevel.get(a.key)!)))
      expect(c.finalHotspots.length).toBeGreaterThan(0)
    }
  })

  it('matches the levels the guide states in its text', () => {
    const level = (name: string) => ARCHAEOLOGY_COLLECTIONS.find(c => c.name === name)?.level
    expect(level('Zarosian I')).toBe(25)
    expect(level('Zamorakian I')).toBe(36)
    expect(level('Saradominist I')).toBe(56)
    expect(level('Finery of the Inquisition')).toBe(64)
    expect(level('Guthixian I')).toBe(66)
    expect(level('Zarosian II')).toBe(81)
    expect(level('Green Gobbo Goodies I')).toBe(83)
    expect(level('Wise Am the Music Man')).toBe(91)
    expect(level('Red Rum Relics I')).toBe(94)
    expect(level('Dragonkin II')).toBe(102)
    expect(level('Dragonkin IV')).toBe(120)
  })

  it('is listed in order of availability and covers every artefact', () => {
    const levels = ARCHAEOLOGY_COLLECTIONS.map(c => c.level)
    expect(levels).toEqual([...levels].sort((a, b) => a - b))
    const inCollections = new Set(ARCHAEOLOGY_COLLECTIONS.flatMap(c => c.artefacts.map(a => a.key)))
    expect(all.every(a => inCollections.has(a.key))).toBe(true)
    expect([...inCollections].every(k => hotspotLevel.has(k))).toBe(true)
  })
})

describe('archaeology mysteries', () => {
  it('has every mystery on the wiki, in order of availability', () => {
    expect(ARCHAEOLOGY_MYSTERIES).toHaveLength(53)
    expect(new Set(ARCHAEOLOGY_MYSTERIES.map(m => m.key)).size).toBe(53)
    const levels = ARCHAEOLOGY_MYSTERIES.map(m => m.level)
    expect(levels).toEqual([...levels].sort((a, b) => a - b))
    expect(levels[0]).toBe(12)
    expect(levels[levels.length - 1]).toBe(120)
    expect(ARCHAEOLOGY_MYSTERIES.every(m => m.digSite !== '' && m.alignment !== '' && m.title !== '')).toBe(true)
  })

  it('lists each mystery after the mysteries it depends on', () => {
    const position = new Map(ARCHAEOLOGY_MYSTERIES.map((m, i) => [m.key, i]))
    for (const [i, m] of ARCHAEOLOGY_MYSTERIES.entries()) {
      for (const dependency of m.after) {
        expect(position.has(dependency)).toBe(true)
        expect(position.get(dependency)!).toBeLessThan(i)
      }
    }
    const after = (key: string) => ARCHAEOLOGY_MYSTERIES.find(m => m.key === key)?.after
    expect(after('contract-claws')).toContain('embrace-the-chaos')
    expect(after('a-new-age')).toEqual(expect.arrayContaining(['a-new-home', 'a-new-form']))
    expect(after('the-final-revolution')).toHaveLength(4)
  })

  it('keeps a partial prerequisite out of the ordering', () => {
    const writings = ARCHAEOLOGY_MYSTERIES.find(m => m.key === 'writings-on-the-walls')!
    expect(writings.requirements.some(r => r.includes('Hallowed Be'))).toBe(true)
    expect(writings.after).not.toContain('hallowed-be')
  })

  it('records requirements as the wiki lists them', () => {
    const m = (key: string) => ARCHAEOLOGY_MYSTERIES.find(x => x.key === key)!
    expect(m('fallen-angels')).toMatchObject({ level: 42, boostable: true, digSite: 'Everlight Dig Site', alignment: 'Saradominist', requirements: [] })
    expect(m('teleport-node-on').boostable).toBe(false)
    expect(m('wing-out').requirements).toContain('40 Smithing')
    expect(m('into-the-forge').items).not.toContain('Ore box if you wish to keep the tin, copper, or necrite ore that you mined')
    expect(m('know-thy-measure').items).toEqual([])
  })

  it('has a note on how to begin for every mystery, and no stray ones', () => {
    expect(Object.keys(ARCHAEOLOGY_MYSTERY_NOTES).sort()).toEqual(ARCHAEOLOGY_MYSTERIES.map(m => m.key).sort())
    for (const note of Object.values(ARCHAEOLOGY_MYSTERY_NOTES)) {
      expect(note.about.trim().length).toBeGreaterThan(10)
      expect(note.start.trim().length).toBeGreaterThan(20)
    }
  })

  it('saves under a prefixed key and counts as complete once solved', () => {
    expect(mysteryProgressKey('fallen-angels')).toBe('mystery:fallen-angels')
    const items = ARCHAEOLOGY_MYSTERIES.map(m => ({ key: mysteryProgressKey(m.key), name: m.name, needed: 1 }))
    expect(summarize(items, {})).toMatchObject({ complete: 0, total: 53 })
    expect(summarize(items, { 'mystery:fallen-angels': 1, 'mystery:prison-break': 1, 'mystery:time-served': 0, 'venator-dagger': 2 })).toMatchObject({ complete: 2, total: 53 })
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
