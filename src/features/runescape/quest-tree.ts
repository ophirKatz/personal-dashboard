import { questKey } from './goals'
import { QUEST_PREREQUISITES } from './quest-requirements-data'

/** How much of a quest the quest that requires it needs: all of it, only part of it, or every last bit (100%). */
export type Need = 'complete' | 'partial' | 'full'

export type TreeNode = {
  /** Unique within the tree: the chain of quests from the root down to this node (a quest can sit under several parents). */
  id: string
  name: string
  /** How much of the required quest of this link is needed: of this node in a prerequisite tree, of its parent in an unlock tree. */
  need: Need
  /** Prerequisite tree: the quests this one needs first. Unlock tree: the quests that need this one first. */
  children: TreeNode[]
  /** Set by filterTree on a node that is only kept because something below it matched. */
  open?: boolean
}

export type QuestTree = {
  /** Top-level quests that have children. */
  roots: TreeNode[]
  /** Top-level quests with no children: no requirements and not required by any quest either. */
  standalone: TreeNode[]
}

/** Reads a QUEST_PREREQUISITES entry: "Partial:Name" / "Full:Name" or just "Name". */
export function parseRequirement(item: string): { name: string; need: Need } {
  const m = /^(Partial|Full):(.*)$/.exec(item)
  return m ? { name: m[2], need: m[1] === 'Partial' ? 'partial' : 'full' } : { name: item, need: 'complete' }
}

type Link = { name: string; need: Need }

const byName = (a: TreeNode, b: TreeNode) => a.name.localeCompare(b.name, 'en')

const prerequisiteMap = (data: Record<string, string[]>) =>
  new Map(Object.entries(data).map(([title, items]) => [questKey(title), items.map(parseRequirement)]))

/** Grows the tree down from the given top-level quests, following `links` (keyed by questKey) to each node's children. */
function growTree(top: string[], links: Map<string, Link[]>, display: (name: string) => string): QuestTree {
  const build = (name: string, need: Need, trail: string[]): TreeNode => {
    const key = questKey(name)
    const chain = [...trail, key]
    // The generated data has no cycles; this keeps an edited copy from recursing forever.
    const children = trail.includes(key) ? [] : (links.get(key) ?? []).map(l => build(l.name, l.need, chain))
    return { id: chain.join('\n'), name: display(name), need, children: children.sort(byName) }
  }
  const nodes = top.map(name => build(name, 'complete', [])).sort(byName)
  return { roots: nodes.filter(n => n.children.length > 0), standalone: nodes.filter(n => n.children.length === 0) }
}

/**
 * Prerequisite tree of the given quests. A quest's children are the quests it needs completed first, so the roots are
 * the quests nothing else builds on and the leaves are the ones with no requirements. Quests that several quests need
 * appear under each of them. Prerequisites the list doesn't contain (e.g. tutorials) still show up as nodes.
 */
export function buildQuestTree(titles: string[], data: Record<string, string[]> = QUEST_PREREQUISITES): QuestTree {
  const prerequisites = prerequisiteMap(data)
  // Show the list's spelling of a title when it has one.
  const listed = new Map(titles.map(title => [questKey(title), title]))

  // Only quests in the list count as parents: one the list doesn't show can't hide the quests it needs.
  const required = new Set([...listed.keys()].flatMap(key => (prerequisites.get(key) ?? []).map(l => questKey(l.name))))
  const top = [...listed].filter(([key]) => !required.has(key)).map(([, title]) => title)
  return growTree(top, prerequisites, name => listed.get(questKey(name)) ?? name)
}

/**
 * The same quests the other way round: the roots are the quests with no requirements and a quest's children are the
 * quests that need it completed first, so the leaves are the quests nothing builds on. A quest with several
 * prerequisites appears under each of them. Besides the given quests, the tree holds whatever they need (e.g. tutorials).
 */
export function buildUnlockTree(titles: string[], data: Record<string, string[]> = QUEST_PREREQUISITES): QuestTree {
  const prerequisites = prerequisiteMap(data)
  // Every quest the tree can show, with the spelling to show it in: the list's quests and everything they need.
  const shown = new Map(titles.map(title => [questKey(title), title]))
  const pending = [...shown.keys()]
  for (let i = 0; i < pending.length; i++) {
    for (const l of prerequisites.get(pending[i]) ?? []) {
      const key = questKey(l.name)
      if (!shown.has(key)) {
        shown.set(key, l.name)
        pending.push(key)
      }
    }
  }

  const unlocks = new Map<string, Link[]>()
  for (const [key, title] of shown) {
    for (const l of prerequisites.get(key) ?? []) {
      const needed = questKey(l.name)
      unlocks.set(needed, [...(unlocks.get(needed) ?? []), { name: title, need: l.need }])
    }
  }

  const top = [...shown].filter(([key]) => (prerequisites.get(key) ?? []).length === 0).map(([, title]) => title)
  return growTree(top, unlocks, name => shown.get(questKey(name)) ?? name)
}

/**
 * Keeps the nodes that match, whole (with their prerequisites), plus the path down to any match deeper in the tree;
 * those path nodes lose their non-matching branches and are flagged open.
 */
export function filterTree(nodes: TreeNode[], matches: (node: TreeNode) => boolean): TreeNode[] {
  return nodes.flatMap(node => {
    if (matches(node)) return [node]
    const children = filterTree(node.children, matches)
    return children.length > 0 ? [{ ...node, children, open: true }] : []
  })
}

/** Ids of every node that has children, i.e. everything that can be expanded. */
export function expandableIds(nodes: TreeNode[]): string[] {
  return nodes.flatMap(node => (node.children.length > 0 ? [node.id, ...expandableIds(node.children)] : []))
}
