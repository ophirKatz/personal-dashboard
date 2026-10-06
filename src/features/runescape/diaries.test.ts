// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { RsDiaryTask } from '../../supabase'
import { groupDiaries, parseDiaryTasks } from './diaries'

describe('parseDiaryTasks', () => {
  it('reads list items under tier headings (new and old heading markup)', () => {
    const html = `<div class="mw-parser-output">
      <p>Intro text</p><ul><li>Not a task, before any tier</li></ul>
      <div class="mw-heading mw-heading2"><h2>Easy tasks</h2></div>
      <ul><li>Catch a trout in the river.</li><li>Craft a staff of air.<ul><li>Nested note</li></ul></li></ul>
      <h2><span>Hard</span></h2>
      <ul><li>Defeat a hard boss.</li></ul>
      <h2>Rewards</h2><ul><li>Some reward item</li></ul>
    </div>`
    expect(parseDiaryTasks(html)).toEqual([
      { tier: 'Easy', name: 'Catch a trout in the river.' },
      { tier: 'Easy', name: 'Craft a staff of air.' },
      { tier: 'Hard', name: 'Defeat a hard boss.' },
    ])
  })

  it('reads table rows and skips header cells and duplicates', () => {
    const html = `<h3>Medium</h3><table><tr><th>Task</th></tr>
      <tr><td>Mine some coal.</td><td>Mining 30</td></tr>
      <tr><td>Mine some coal.</td></tr></table>`
    expect(parseDiaryTasks(html)).toEqual([{ tier: 'Medium', name: 'Mine some coal.' }])
  })

  it('returns nothing for a page without tiers', () => {
    expect(parseDiaryTasks('<ul><li>Just a list of things</li></ul>')).toEqual([])
  })
})

describe('groupDiaries', () => {
  const t = (id: string, area: string, tier: RsDiaryTask['tier'], position: number): RsDiaryTask =>
    ({ id, area, tier, name: id, position, updated_at: '' })
  it('groups by area and tier in tier order with counts', () => {
    const groups = groupDiaries(
      [t('a', 'Varrock', 'Hard', 0), t('b', 'Varrock', 'Easy', 1), t('c', 'Varrock', 'Easy', 0), t('d', 'Ardougne', 'Easy', 0)],
      new Set(['c', 'd']),
    )
    expect(groups.map(g => [g.area, g.done, g.total])).toEqual([['Ardougne', 1, 1], ['Varrock', 1, 3]])
    expect(groups[1].tiers.map(x => [x.tier, x.tasks.map(y => y.id)])).toEqual([['Easy', ['c', 'b']], ['Hard', ['a']]])
  })
})
