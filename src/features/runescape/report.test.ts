// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { CharacterStats, QuestStatus } from './api'
import { parseGuideHtml } from './guide'
import { buildReport, compareRequirements, isReady, requirementsText, type ReportEntry } from './report'

const stats = {
  skills: new Map([
    [0, { id: 0, level: 60, xp: 273_742, rank: null }], // Attack 60
    [7, { id: 7, level: 40, xp: 37_224, rank: null }], // Cooking 40
  ]),
} as unknown as CharacterStats

const done = new Map<string, QuestStatus>([['cook\'s assistant', 'COMPLETED'], ['rune mysteries', 'STARTED']])

describe('requirementsText', () => {
  it('flattens the infobox requirements cell to one line per item', () => {
    const guide = parseGuideHtml(
      '<div class="mw-parser-output"><table class="infobox"><tr><th>Requirements</th><td><ul><li>40 <a href="/w/Cooking">Cooking</a></li><li>Completion of <a href="/w/Rune_Mysteries">Rune Mysteries</a></li></ul></td></tr></table></div>',
      'X',
    )
    expect(requirementsText(guide)).toBe('40 Cooking\nCompletion of Rune Mysteries')
  })

  it('returns null when the page has no requirements', () => {
    expect(requirementsText(parseGuideHtml('<div class="mw-parser-output"><p>hi</p></div>', 'X'))).toBeNull()
  })
})

describe('compareRequirements', () => {
  it('reports only unmet skills and incomplete quests', () => {
    const missing = compareRequirements(
      { skills: [{ skill: 'Attack', level: 50 }, { skill: 'Cooking', level: 70 }, { skill: 'Slayer', level: 10 }], quests: ["Cook's Assistant", 'Rune Mysteries', 'Unknown Quest'], other: ['10 quest points'] },
      stats,
      done,
    )
    expect(missing.skills).toEqual([
      { skill: 'Cooking', required: 70, current: 40 },
      { skill: 'Slayer', required: 10, current: null },
    ])
    expect(missing.quests).toEqual([{ name: 'Rune Mysteries', status: 'STARTED' }, { name: 'Unknown Quest', status: null }])
    expect(isReady(missing)).toBe(false)
  })

  it('is ready when nothing is missing', () => {
    expect(isReady(compareRequirements({ skills: [{ skill: 'attack', level: 60 }], quests: [], other: ['Members'] }, stats, done))).toBe(true)
  })
})

describe('buildReport', () => {
  const entries: ReportEntry[] = [
    { name: 'Blocked Quest', status: 'NOT_STARTED', missing: { skills: [{ skill: 'Cooking', required: 70, current: 40 }], quests: [{ name: 'Rune Mysteries', status: 'STARTED' }], other: [] } },
    { name: 'Easy Quest', status: 'STARTED', missing: { skills: [], quests: [], other: [] } },
    { name: 'Mystery Quest', status: 'NOT_STARTED', missing: null },
  ]
  const md = buildReport('Tester', entries, 100, new Date('2026-10-03T00:00:00Z'))

  it('summarises and groups quests', () => {
    expect(md).toContain('# RuneScape quest report — Tester')
    expect(md).toContain('Generated 2026-10-03')
    expect(md).toContain('- Incomplete quests: 3')
    expect(md.indexOf('## Missing requirements (1)')).toBeLessThan(md.indexOf('## Ready to do (1)'))
    expect(md).toContain('## Requirements unavailable (1)')
  })

  it('lists what is missing per quest', () => {
    expect(md).toContain('- **Cooking** 70 needed (you have 40)')
    expect(md).toContain('- **Quest:** Rune Mysteries (in progress)')
    expect(md).toContain('✅ All requirements met')
  })
})
