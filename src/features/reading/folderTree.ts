import type { ReadingBook, ReadingFolder } from '../../supabase'

export type FolderId = string | null

export function buildChildrenMap(folders: ReadingFolder[]): Map<FolderId, ReadingFolder[]> {
  const map = new Map<FolderId, ReadingFolder[]>()
  for (const folder of folders) {
    const siblings = map.get(folder.parent_id) ?? []
    siblings.push(folder)
    map.set(folder.parent_id, siblings)
  }
  for (const siblings of map.values()) siblings.sort((a, b) => a.name.localeCompare(b.name))
  return map
}

/** Folders from the root down to (and including) `folderId`. Empty for the root. */
export function getPath(folders: ReadingFolder[], folderId: FolderId): ReadingFolder[] {
  const byId = new Map(folders.map(f => [f.id, f]))
  const path: ReadingFolder[] = []
  const seen = new Set<string>()
  let current = folderId ? byId.get(folderId) : undefined
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    path.unshift(current)
    current = current.parent_id ? byId.get(current.parent_id) : undefined
  }
  return path
}

/** All descendant folder ids of `folderId` (not including itself). */
export function getDescendantIds(folders: ReadingFolder[], folderId: string): Set<string> {
  const children = buildChildrenMap(folders)
  const result = new Set<string>()
  const stack = [folderId]
  while (stack.length) {
    const id = stack.pop()!
    for (const child of children.get(id) ?? []) {
      if (!result.has(child.id)) {
        result.add(child.id)
        stack.push(child.id)
      }
    }
  }
  return result
}

/** Number of books in `folderId` and every folder below it. */
export function countBooksDeep(folders: ReadingFolder[], books: ReadingBook[], folderId: string): number {
  const ids = getDescendantIds(folders, folderId)
  ids.add(folderId)
  return books.filter(b => b.folder_id && ids.has(b.folder_id)).length
}

export function pathLabel(folders: ReadingFolder[], folderId: FolderId): string {
  return ['Reading list', ...getPath(folders, folderId).map(f => f.name)].join(' › ')
}
