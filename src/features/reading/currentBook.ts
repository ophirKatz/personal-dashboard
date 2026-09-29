import { supabase } from '../../supabase'
import type { ReadingBook } from '../../supabase'

type Result = { error: string | null }

export async function fetchCurrentBook(): Promise<ReadingBook | null> {
  const { data } = await supabase.from('reading_books').select('*').eq('is_current', true).maybeSingle()
  return data
}

export async function fetchUnreadBooks(): Promise<ReadingBook[]> {
  const { data } = await supabase
    .from('reading_books')
    .select('*')
    .eq('is_read', false)
    .order('created_at', { ascending: false })
  return data ?? []
}

/** Books that can be picked next: unread, not already current, matching the query. */
export function pickableBooks(books: ReadingBook[], query: string): ReadingBook[] {
  const term = query.trim().toLowerCase()
  return books.filter(b => {
    if (b.is_read || b.is_current) return false
    return !term || `${b.title} ${b.author ?? ''}`.toLowerCase().includes(term)
  })
}

export async function clearCurrentBook(): Promise<Result> {
  const { error } = await supabase.from('reading_books').update({ is_current: false }).eq('is_current', true)
  return { error: error?.message ?? null }
}

/** Makes `bookId` the current book, replacing any other. The DB allows only one per user. */
export async function setCurrentBook(bookId: string): Promise<Result> {
  const cleared = await clearCurrentBook()
  if (cleared.error) return cleared
  const { error } = await supabase.from('reading_books').update({ is_current: true }).eq('id', bookId)
  return { error: error?.message ?? null }
}

/** Marks a book read. It stays the current book, so the widget can show its "finished" state. */
export async function completeBook(bookId: string): Promise<Result> {
  const { error } = await supabase
    .from('reading_books')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', bookId)
  return { error: error?.message ?? null }
}
