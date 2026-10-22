import { describe, expect, it } from 'vitest'
import { ABILITY_BARS } from './ability-bars-data'
import { abilitySlug, barRows, isManualBar } from './ability-bars'
import { abilityIcon, iconSlugs } from './ability-icons'

const bars = ABILITY_BARS.flatMap(s => s.groups.flatMap(g => g.bars))

describe('ability bar data', () => {
  it('covers all four combat styles, each with single and multi-target bars', () => {
    expect(ABILITY_BARS.map(s => [s.id, s.groups.map(g => g.id)])).toEqual([
      ['melee', ['single', 'multi']],
      ['ranged', ['single', 'multi']],
      ['magic', ['single', 'multi']],
      ['necromancy', ['single', 'multi']],
    ])
  })

  it('has unique bar keys', () => {
    const keys = bars.map(b => b.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('fits every bar on the 14-slot action bar without repeating an ability', () => {
    for (const b of bars) {
      expect(b.abilities.length, b.key).toBeLessThanOrEqual(14)
      expect(new Set(b.abilities).size, b.key).toBe(b.abilities.length)
    }
  })

  it('sets a Revolution size inside the bar', () => {
    for (const b of bars) {
      expect(b.revolution, b.key).toBeGreaterThanOrEqual(1)
      expect(b.revolution, b.key).toBeLessThanOrEqual(b.abilities.length)
    }
  })

  it('only suggests fallbacks for abilities that are on the bar', () => {
    for (const b of bars) {
      for (const f of b.fallbacks ?? []) expect(b.abilities, `${b.key}: ${f.missing}`).toContain(f.missing)
    }
  })

  it('names the Greater ability a replacement stands in for', () => {
    for (const f of bars.flatMap(b => b.fallbacks ?? [])) {
      if (f.use) expect(f.missing).toBe(`Greater ${f.use}`)
    }
  })
})

describe('ability icons', () => {
  const used = new Set(bars.flatMap(b => [...b.abilities, ...(b.fallbacks ?? []).flatMap(f => (f.use ? [f.use] : []))]))

  it('has an icon for every ability and replacement on a bar', () => {
    for (const name of used) expect(abilityIcon(name), name).toBeTruthy()
  })

  it('has no icon that no bar uses', () => {
    const usedSlugs = new Set([...used].map(abilitySlug))
    expect(iconSlugs().filter(s => !usedSlugs.has(s))).toEqual([])
  })

  it('names files without apostrophes or punctuation', () => {
    expect(abilitySlug("Death's Swiftness")).toBe('deaths-swiftness')
    expect(abilitySlug('Imbue: Shadows')).toBe('imbue-shadows')
    expect(abilitySlug('Greater Concentrated Blast')).toBe('greater-concentrated-blast')
  })
})

describe('barRows', () => {
  const find = (key: string) => bars.find(b => b.key === key)!

  it('shows a Revolution++ bar as one row of numbered slots with default keys', () => {
    const b = find('melee-single-2h-revo')
    expect(isManualBar(b)).toBe(false)
    const rows = barRows(b)
    expect(rows).toHaveLength(1)
    expect(rows[0].label).toBe('Revolution, slots 1-10')
    expect(rows[0].slots.map(s => s.key)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'])
  })

  it('splits a manual bar at the Revolution size', () => {
    const b = find('melee-single-2h-manual')
    expect(isManualBar(b)).toBe(true)
    const [revo, manual] = barRows(b)
    expect(revo.slots.map(s => s.ability)).toEqual(['Rend', 'Adaptive Strike', 'Greater Fury', 'Punish', 'Attack'])
    expect(revo.label).toBe('Revolution, slots 1-5')
    expect(manual.label).toBe('Keybind by hand, slots 6-12')
    expect(manual.slots.map(s => [s.position, s.key])).toEqual([[6, '6'], [7, '7'], [8, '8'], [9, '9'], [10, '0'], [11, '-'], [12, '=']])
  })

  it('leaves slots past the twelfth without a default key', () => {
    const rows = barRows(find('necromancy-single-manual'))
    const last = rows[1].slots[rows[1].slots.length - 1]
    expect(last).toMatchObject({ position: 13, ability: 'Command Skeleton Warrior', key: null })
    expect(rows[0].slots).toHaveLength(4)
    expect(rows[1].label).toBe('Keybind by hand, slots 5-13')
  })

  it('keeps every ability exactly once across the rows, in order', () => {
    for (const b of bars) {
      expect(barRows(b).flatMap(r => r.slots.map(s => s.ability)), b.key).toEqual(b.abilities)
    }
  })
})
