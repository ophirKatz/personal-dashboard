import { describe, expect, it } from 'vitest'
import type { ReadingBook, ReadingFolder } from '../../supabase'
import { buildChildrenMap, countBooksDeep, getDescendantIds, getPath } from './folderTree'

function folder(id: string, parent_id: string | null, name = id): ReadingFolder {
  return { id, parent_id, name, user_id: 'u', created_at: '2026-01-01T00:00:00Z' }
}
function book(id: string, folder_id: string | null): ReadingBook {
  return {
    id, folder_id, user_id: 'u', ol_key: null, title: id, author: null, cover_url: null,
    first_publish_year: null, is_read: false, read_at: null, created_at: '2026-01-01T00:00:00Z',
  }
}

const folders = [folder('a', null), folder('b', 'a'), folder('c', 'b'), folder('d', null)]

describe('folderTree', () => {
  it('groups folders by parent, sorted by name', () => {
    const map = buildChildrenMap([folder('z', null, 'Zed'), folder('y', null, 'Alpha')])
    expect(map.get(null)!.map(f => f.id)).toEqual(['y', 'z'])
  })

  it('returns the path from root, empty for root', () => {
    expect(getPath(folders, 'c').map(f => f.id)).toEqual(['a', 'b', 'c'])
    expect(getPath(folders, null)).toEqual([])
  })

  it('collects descendants but not the folder itself or siblings', () => {
    expect([...getDescendantIds(folders, 'a')].sort()).toEqual(['b', 'c'])
    expect(getDescendantIds(folders, 'c').size).toBe(0)
  })

  it('counts books across subfolders', () => {
    const books = [book('1', 'a'), book('2', 'c'), book('3', 'd'), book('4', null)]
    expect(countBooksDeep(folders, books, 'a')).toBe(2)
  })

  it('does not loop forever on corrupt cyclic data', () => {
    const cyclic = [folder('x', 'y'), folder('y', 'x')]
    expect(getPath(cyclic, 'x').length).toBe(2)
    expect(getDescendantIds(cyclic, 'x').has('y')).toBe(true)
  })
})
