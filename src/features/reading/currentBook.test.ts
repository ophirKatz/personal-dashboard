import { describe, expect, it, vi } from 'vitest'
import type { ReadingBook } from '../../supabase'

vi.mock('../../supabase', () => ({ supabase: { from: vi.fn() } }))

const { pickableBooks } = await import('./currentBook')

function book(id: string, overrides: Partial<ReadingBook> = {}): ReadingBook {
  return {
    id, user_id: 'u', folder_id: null, ol_key: null, title: id, author: null, cover_url: null,
    first_publish_year: null, is_read: false, is_current: false, read_at: null,
    created_at: '2026-01-01T00:00:00Z', ...overrides,
  }
}

describe('pickableBooks', () => {
  const books = [
    book('Dune', { author: 'Frank Herbert' }),
    book('Emma', { author: 'Jane Austen', is_read: true }),
    book('Ulysses', { is_current: true }),
    book('Neuromancer', { author: 'William Gibson' }),
  ]

  it('excludes read and current books', () => {
    expect(pickableBooks(books, '').map(b => b.id)).toEqual(['Dune', 'Neuromancer'])
  })

  it('matches title or author, case-insensitively', () => {
    expect(pickableBooks(books, 'gibs').map(b => b.id)).toEqual(['Neuromancer'])
    expect(pickableBooks(books, 'DUNE').map(b => b.id)).toEqual(['Dune'])
    expect(pickableBooks(books, 'austen')).toEqual([])
  })
})
