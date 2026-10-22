import { describe, expect, it } from 'vitest'
import { PVM_STAGES } from './pvm-data'
import { allGoals, bossGoals, countDone, guideUrl, nextGoal, stageGoals, toDoneSet } from './pvm'

const bosses = PVM_STAGES.flatMap(s => s.bosses)

describe('pvm path data', () => {
  it('follows the guide: three learning stages in order, each with its bosses', () => {
    expect(PVM_STAGES.map(s => [s.id, s.bosses.map(b => b.name)])).toEqual([
      ['introductory', ['Arch-Glacor', 'GWD2: the Heart of Gielinor', 'Osseous']],
      ['intermediate', ['Araxxor', 'Elite Dungeon 2: Dragonkin Laboratory', 'TzKal-Zuk (Normal Mode)']],
      ['advanced', ['Raksha', 'Kerapac: Hard Mode']],
    ])
  })

  it('has every milestone from the guide', () => {
    const counts = Object.fromEntries(bosses.map(b => [b.key, [b.introductory.length, b.advanced.length]]))
    expect(counts).toEqual({
      'arch-glacor': [4, 2],
      gwd2: [2, 1],
      osseous: [2, 2],
      araxxor: [2, 2],
      ed2: [3, 3],
      'zuk-normal': [2, 2],
      raksha: [3, 2],
      'kerapac-hm': [1, 2],
    })
    expect(allGoals()).toHaveLength(35)
  })

  it('gives every boss something to learn and a guide to read', () => {
    for (const b of bosses) {
      expect(b.summary.length, b.name).toBeGreaterThan(0)
      expect(b.learn.length, b.name).toBeGreaterThan(0)
      expect(b.guides.length, b.name).toBeGreaterThan(0)
    }
  })

  it('has unique goal keys, each prefixed with its boss (they are saved, so they must stay stable)', () => {
    const keys = allGoals().map(g => g.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const b of bosses) expect(bossGoals(b).every(g => g.key.startsWith(`${b.key}:`))).toBe(true)
  })

  it('leaves no Discord markup in the text', () => {
    const text = [
      ...bosses.flatMap(b => [...b.summary, ...b.learn, ...bossGoals(b).flatMap(g => [g.text, g.note ?? ''])]),
      ...PVM_STAGES.map(s => s.blurb),
    ].join('\n')
    expect(text).not.toMatch(/<[:@#]| |\\u00a0|\$link/)
  })
})

describe('pvm progress', () => {
  it('counts completed goals and ignores saved keys that are not in the guide', () => {
    const arch = bosses[0]
    const done = toDoneSet([{ goal_key: 'arch-glacor:intro-1' }, { goal_key: 'arch-glacor:adv-2' }, { goal_key: 'removed-boss:intro-1' }])
    expect(countDone(bossGoals(arch), done)).toEqual({ done: 2, total: 6 })
    expect(countDone(stageGoals(PVM_STAGES[0]), done)).toEqual({ done: 2, total: 13 })
    expect(countDone(allGoals(), done)).toEqual({ done: 2, total: 35 })
  })

  it('finds the next goal in path order, introductory before advanced', () => {
    expect(nextGoal(new Set())?.goal.key).toBe('arch-glacor:intro-1')
    const introDone = new Set(bosses[0].introductory.map(g => g.key))
    expect(nextGoal(introDone)?.goal.key).toBe('arch-glacor:adv-1')
    expect(nextGoal(new Set(bossGoals(bosses[0]).map(g => g.key)))?.boss.key).toBe('gwd2')
  })

  it('has no next goal once everything is done', () => {
    expect(nextGoal(new Set(allGoals().map(g => g.key)))).toBeNull()
  })

  it('builds pvme.io guide links', () => {
    expect(guideUrl('new-to-bossing/bossing-path')).toBe('https://pvme.io/pvme-guides/new-to-bossing/bossing-path/')
  })
})
