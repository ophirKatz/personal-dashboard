// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { RsDiaryTask } from '../../supabase'
import { groupDiaries, parseDiaryTasks } from './diaries'

// Mirrors the real wiki markup: tier headings are h2 ("Easy achievements"), the list sits under an h3
// ("List of achievements"), and the list is a wikitable with #/Name/Description/… columns.
const list = (rows: [string, string][]) =>
  `<table class="wikitable sortable"><tbody><tr><th>#</th><th>Name</th><th>Description</th><th>Members</th></tr>${rows
    .map(([n, d], i) => `<tr><td>${i + 1}</td><td><a href="/w/x">${n}</a></td><td>${d}</td><td><img></td></tr>`)
    .join('')}</tbody></table>`

describe('parseDiaryTasks', () => {
  it('reads tables under tier headings and keeps the tier across sub-headings', () => {
    const html = `<div class="mw-parser-output">
      <table class="rsw-infobox"><tbody><tr><td>infobox</td></tr></tbody></table>
      ${list([['Set Tasks - Easy', 'Meta achievement before the first tier.']])}
      <div class="mw-heading mw-heading2"><h2>Easy achievements</h2></div>
      <div class="mw-heading mw-heading3"><h3>Requirements</h3></div>
      <table class="wikitable"><tbody><tr><th>Skill</th></tr><tr><td>Not a task</td></tr></tbody></table>
      <div class="mw-heading mw-heading3"><h3>List of achievements</h3></div>
      ${list([['Reflax Actions', 'Pick five flax.'], ['Why?', 'Walk around the statue.']])}
      <div class="mw-heading mw-heading3"><h3>Rewards</h3></div>
      <table class="wikitable"><tbody><tr><th>Reward</th></tr><tr><td>Lamp</td></tr></tbody></table>
      <div class="mw-heading mw-heading2"><h2>Hard achievements</h2></div>
      ${list([['Boss', 'Defeat the boss.']])}
    </div>`
    expect(parseDiaryTasks(html)).toEqual([
      { tier: 'Easy', name: 'Reflax Actions', description: 'Pick five flax.' },
      { tier: 'Easy', name: 'Why?', description: 'Walk around the statue.' },
      { tier: 'Hard', name: 'Boss', description: 'Defeat the boss.' },
    ])
  })

  it('uses the "All" tier on pages without tier headings and reads tables with no # column', () => {
    const html = `<div class="mw-parser-output"><div class="mw-heading mw-heading2"><h2>List of achievements</h2></div>
      <table class="wikitable"><tbody><tr><th>Name</th><th>Description</th></tr><tr><td>Um</td><td>Visit Um.</td></tr><tr><td>Um</td><td>dup</td></tr></tbody></table></div>`
    expect(parseDiaryTasks(html)).toEqual([{ tier: 'All', name: 'Um', description: 'Visit Um.' }])
  })

  it('recognises the Beginner tier', () => {
    const html = `<h2>Beginner achievements</h2>${list([['Hello', 'Say hi.']])}`
    expect(parseDiaryTasks(html)[0].tier).toBe('Beginner')
  })

  it('returns nothing without a Name/Description table', () => {
    expect(parseDiaryTasks('<h2>Easy achievements</h2><ul><li>Just a list of things</li></ul>')).toEqual([])
  })
})

describe('groupDiaries', () => {
  const t = (id: string, area: string, tier: RsDiaryTask['tier'], position: number, category = 'Area Tasks'): RsDiaryTask =>
    ({ id, category, area, tier, name: id, description: null, position, updated_at: '' })
  it('groups by category and area, with tiers in order and counts', () => {
    const groups = groupDiaries(
      [t('a', 'Varrock', 'Hard', 0), t('b', 'Varrock', 'Easy', 1), t('c', 'Varrock', 'Easy', 0), t('d', 'City of Um', 'All', 0, 'Exploration')],
      new Set(['c', 'd']),
    )
    expect(groups.map(g => [g.category, g.area, g.done, g.total])).toEqual([['Area Tasks', 'Varrock', 1, 3], ['Exploration', 'City of Um', 1, 1]])
    expect(groups[0].tiers.map(x => [x.tier, x.tasks.map(y => y.id)])).toEqual([['Easy', ['c', 'b']], ['Hard', ['a']]])
  })
})
