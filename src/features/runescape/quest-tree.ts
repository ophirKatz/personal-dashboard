import { questKey } from './goals'
import { QUEST_PREREQUISITES } from './quest-tree-data'

/** How much of a quest its parent needs: all of it, only part of it, or every last bit (100%). */
export type Need = 'complete' | 'partial' | 'full'

export type TreeNode = {
  /** Unique within the tree: the chain of quests from the root down to this node (a quest can sit under several parents). */
  id: string
  name: string
  need: Need
  /** The quests that must be completed before this one can be started. A node without children has no requirements. */
  children: TreeNode[]
  /** Set by filterTree on a node that is only kept because something below it matched. */
  open?: boolean
}

export type QuestTree = {
  /** Quests that no other quest requires and that have prerequisites of their own. */
  roots: TreeNode[]
  /** Quests with no prerequisites that no other quest requires either. */
  standalone: TreeNode[]
}

/** Reads a QUEST_PREREQUISITES entry: "Partial:Name" / "Full:Name" or just "Name". */
export function parseRequirement(item: string): { name: string; need: Need } {
  const m = /^(Partial|Full):(.*)$/.exec(item)
  return m ? { name: m[2], need: m[1] === 'Partial' ? 'partial' : 'full' } : { name: item, need: 'complete' }
}

const byName = (a: TreeNode, b: TreeNode) => a.name.localeCompare(b.name, 'en')

/**
 * Prerequisite tree of the given quests. A quest's children are the quests it needs completed first, so the roots are
 * the quests nothing else builds on and the leaves are the ones with no requirements. Quests that several quests need
 * appear under each of them. Prerequisites the list doesn't contain (e.g. tutorials) still show up as nodes.
 */
export function buildQuestTree(titles: string[], data: Record<string, string[]> = QUEST_PREREQUISITES): QuestTree {
  const prerequisites = new Map(Object.entries(data).map(([title, items]) => [questKey(title), items.map(parseRequirement)]))
  // Show the list's spelling of a title when it has one.
  const listed = new Map(titles.map(title => [questKey(title), title]))

  const build = (name: string, need: Need, trail: string[]): TreeNode => {
    const key = questKey(name)
    const chain = [...trail, key]
    // The generated data has no cycles; this keeps an edited copy from recursing forever.
    const children = trail.includes(key) ? [] : (prerequisites.get(key) ?? []).map(r => build(r.name, r.need, chain))
    return { id: chain.join('\n'), name: listed.get(key) ?? name, need, children: children.sort(byName) }
  }

  // Only quests in the list count as parents: one the list doesn't show can't hide the quests it needs.
  const required = new Set([...listed.keys()].flatMap(key => (prerequisites.get(key) ?? []).map(r => questKey(r.name))))
  const top = [...listed].filter(([key]) => !required.has(key)).map(([, title]) => build(title, 'complete', [])).sort(byName)
  return { roots: top.filter(n => n.children.length > 0), standalone: top.filter(n => n.children.length === 0) }
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
