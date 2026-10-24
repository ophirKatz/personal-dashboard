import { describe, expect, it } from 'vitest'
import { buildQuestTree, buildUnlockTree, expandableIds, filterTree, parseRequirement, type TreeNode } from './quest-tree'
import { QUEST_PREREQUISITES } from './quest-requirements-data'

const names = (nodes: TreeNode[]) => nodes.map(n => n.name)

// C needs B, B needs A; D needs A and (partly) E; F stands alone.
const data = {
  C: ['B'],
  B: ['A'],
  D: ['A', 'Partial:E'],
}
const titles = ['A', 'B', 'C', 'D', 'E', 'F']

describe('parseRequirement', () => {
  it('reads the partial and full prefixes', () => {
    expect(parseRequirement('Cook\'s Assistant')).toEqual({ name: "Cook's Assistant", need: 'complete' })
    expect(parseRequirement('Partial:Stolen Hearts')).toEqual({ name: 'Stolen Hearts', need: 'partial' })
    expect(parseRequirement('Full:Missing My Mummy')).toEqual({ name: 'Missing My Mummy', need: 'full' })
  })
})

describe('buildQuestTree', () => {
  it('makes quests nothing requires the roots, with their prerequisites as children down to the leaves', () => {
    const { roots } = buildQuestTree(titles, data)
    expect(names(roots)).toEqual(['C', 'D'])
    const [c, d] = roots
    expect(names(c.children)).toEqual(['B'])
    expect(names(c.children[0].children)).toEqual(['A'])
    expect(c.children[0].children[0].children).toEqual([]) // A has no requirements
    expect(names(d.children)).toEqual(['A', 'E'])
  })

  it('repeats a shared prerequisite under each quest that needs it, with distinct ids', () => {
    const { roots } = buildQuestTree(titles, data)
    const a1 = roots[0].children[0].children[0]
    const a2 = roots[1].children[0]
    expect([a1.name, a2.name]).toEqual(['A', 'A'])
    expect(a1.id).not.toBe(a2.id)
  })

  it('keeps quests that nobody requires and that require nothing apart', () => {
    const { roots, standalone } = buildQuestTree(titles, data)
    expect(names(standalone)).toEqual(['F'])
    expect(names(roots)).not.toContain('F')
  })

  it('records how much of a prerequisite is needed', () => {
    const [, d] = buildQuestTree(titles, data).roots
    expect(d.children.map(n => n.need)).toEqual(['complete', 'partial'])
  })

  it('matches titles regardless of case and shows the list\'s spelling', () => {
    const { roots } = buildQuestTree(['Child', 'The Parent'], { child: ['the parent'] })
    expect(names(roots)).toEqual(['Child'])
    expect(names(roots[0].children)).toEqual(['The Parent'])
  })

  it('shows prerequisites that are not in the list, and expands their own requirements', () => {
    const { roots, standalone } = buildQuestTree(['Quest'], { Quest: ['Tutorial'], Tutorial: ['Intro'] })
    expect(names(roots)).toEqual(['Quest'])
    expect(names(roots[0].children)).toEqual(['Tutorial'])
    expect(names(roots[0].children[0].children)).toEqual(['Intro'])
    expect(standalone).toEqual([])
  })

  it('does not let a quest outside the list hide the quests it needs', () => {
    const { roots, standalone } = buildQuestTree(['Base'], { Hidden: ['Base'] })
    expect(roots).toEqual([])
    expect(names(standalone)).toEqual(['Base'])
  })

  it('stops at a cycle instead of recursing forever', () => {
    const { roots } = buildQuestTree(['Root', 'X', 'Y'], { Root: ['X'], X: ['Y'], Y: ['X'] })
    expect(names(roots)).toEqual(['Root'])
    expect(names(roots[0].children[0].children[0].children)).toEqual(['X'])
    expect(roots[0].children[0].children[0].children[0].children).toEqual([])
  })
})

describe('buildUnlockTree', () => {
  it('makes quests with no requirements the roots, with the quests that need them as children', () => {
    const { roots } = buildUnlockTree(titles, data)
    expect(names(roots)).toEqual(['A', 'E'])
    const [a, e] = roots
    expect(names(a.children)).toEqual(['B', 'D'])
    expect(names(a.children[0].children)).toEqual(['C']) // C needs B, which needs A
    expect(a.children[0].children[0].children).toEqual([]) // nothing needs C
    expect(names(e.children)).toEqual(['D'])
  })

  it('repeats a quest with several prerequisites under each, with distinct ids', () => {
    const [a, e] = buildUnlockTree(titles, data).roots
    const d1 = a.children[1]
    const d2 = e.children[0]
    expect([d1.name, d2.name]).toEqual(['D', 'D'])
    expect(d1.id).not.toBe(d2.id)
  })

  it('records how much of the parent the child needs', () => {
    const [, e] = buildUnlockTree(titles, data).roots
    expect(e.children[0].need).toBe('partial')
  })

  it('keeps quests that nobody requires and that require nothing apart', () => {
    const { roots, standalone } = buildUnlockTree(titles, data)
    expect(names(standalone)).toEqual(['F'])
    expect(names(roots)).not.toContain('F')
  })

  it('shows what the quests need even when the list does not have it', () => {
    const { roots, standalone } = buildUnlockTree(['Quest'], { Quest: ['Tutorial'] })
    expect(names(roots)).toEqual(['Tutorial'])
    expect(names(roots[0].children)).toEqual(['Quest'])
    expect(standalone).toEqual([])
  })

  it('does not show quests that are neither in the list nor needed by it', () => {
    const { roots, standalone } = buildUnlockTree(['Base'], { Hidden: ['Base'] })
    expect(roots).toEqual([])
    expect(names(standalone)).toEqual(['Base'])
  })

  it("matches titles regardless of case and shows the list's spelling", () => {
    const { roots } = buildUnlockTree(['Child', 'The Parent'], { child: ['the parent'] })
    expect(names(roots)).toEqual(['The Parent'])
    expect(names(roots[0].children)).toEqual(['Child'])
  })

  it('stops at a cycle instead of recursing forever', () => {
    const { roots } = buildUnlockTree(['A', 'B', 'C'], { B: ['A', 'C'], C: ['B'] })
    expect(names(roots)).toEqual(['A'])
    const b = roots[0].children[0]
    expect(names(b.children)).toEqual(['C'])
    expect(names(b.children[0].children)).toEqual(['B'])
    expect(b.children[0].children[0].children).toEqual([])
  })

  it('has exactly the links of the prerequisite tree, the other way round', () => {
    const links = (tree: ReturnType<typeof buildQuestTree>, flip: boolean) => {
      const out = new Set<string>()
      const walk = (node: TreeNode) => node.children.forEach(c => { out.add(flip ? `${c.name}>${node.name}` : `${node.name}>${c.name}`); walk(c) })
      ;[...tree.roots, ...tree.standalone].forEach(walk)
      return out
    }
    const all = [...new Set(Object.entries(QUEST_PREREQUISITES).flatMap(([title, list]) => [title, ...list.map(i => parseRequirement(i).name)]))]
    const down = links(buildQuestTree(all), false)
    const up = links(buildUnlockTree(all), true)
    expect(down.size).toBeGreaterThan(300)
    expect([...up].sort()).toEqual([...down].sort())
  })

  it('starts the real data at quests with no requirements', () => {
    const { roots } = buildUnlockTree(Object.keys(QUEST_PREREQUISITES))
    expect(names(roots)).toContain("Cook's Assistant")
    expect(roots.every(r => !(r.name in QUEST_PREREQUISITES))).toBe(true)
  })
})

describe('filterTree', () => {
  const { roots } = buildQuestTree(titles, data)

  it('keeps a matching node whole', () => {
    const kept = filterTree(roots, n => n.name === 'C')
    expect(names(kept)).toEqual(['C'])
    expect(kept[0]).toBe(roots[0])
  })

  it('keeps the path down to a deeper match, opened, without the other branches', () => {
    const kept = filterTree(roots, n => n.name === 'E')
    expect(names(kept)).toEqual(['D'])
    expect(kept[0].open).toBe(true)
    expect(names(kept[0].children)).toEqual(['E'])
  })

  it('drops branches with no match', () => {
    expect(filterTree(roots, () => false)).toEqual([])
  })
})

describe('expandableIds', () => {
  it('lists every node that has children, and no leaves', () => {
    const { roots } = buildQuestTree(titles, data)
    const [c, d] = roots
    // C and B (C's child) and D have children; the A and E leaves don't.
    expect(expandableIds(roots)).toEqual([c.id, c.children[0].id, d.id])
  })
})

describe('generated prerequisite data', () => {
  const entries = Object.entries(QUEST_PREREQUISITES)

  it('is not empty and every entry has prerequisites', () => {
    expect(entries.length).toBeGreaterThan(200)
    expect(entries.every(([, list]) => list.length > 0)).toBe(true)
  })

  it('never has a quest requiring itself, directly or through a chain', () => {
    const seen = (node: TreeNode, ancestors: string[]): boolean =>
      !ancestors.includes(node.name.toLowerCase()) && node.children.every(c => seen(c, [...ancestors, node.name.toLowerCase()]))
    const { roots, standalone } = buildQuestTree(Object.keys(QUEST_PREREQUISITES))
    expect([...roots, ...standalone].every(n => seen(n, []))).toBe(true)
  })

  it('uses in-game titles, not wiki page names', () => {
    const all = entries.flatMap(([title, list]) => [title, ...list.map(i => parseRequirement(i).name)])
    expect(all.filter(t => / \(quest\)$/.test(t))).toEqual([])
    expect(all.filter(t => /^(Once Upon a Time in Gielinor|That Old Black Magic): /.test(t))).toEqual([])
  })

  it('has the chain the wiki shows for A Fairy Tale III', () => {
    const { roots } = buildQuestTree(["A Fairy Tale III - Battle at Ork's Rift"])
    const tree = roots[0]
    expect(names(tree.children)).toEqual(['A Fairy Tale II - Cure a Queen'])
    expect(names(tree.children[0].children)).toEqual(['A Fairy Tale I - Growing Pains'])
    expect(names(tree.children[0].children[0].children)).toEqual(['Lost City', 'Nature Spirit'])
  })
})
