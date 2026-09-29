export type BookSearchResult = {
  olKey: string
  title: string
  author: string | null
  year: number | null
  coverUrl: string | null
}

type OpenLibraryDoc = {
  key?: string
  title?: string
  author_name?: string[]
  first_publish_year?: number
  cover_i?: number
}

export function coverUrlFor(coverId: number, size: 'S' | 'M' | 'L' = 'M') {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`
}

export async function searchBooks(query: string, signal?: AbortSignal): Promise<BookSearchResult[]> {
  const res = await fetch(`/api/book-search?q=${encodeURIComponent(query)}`, { signal })
  if (!res.ok) throw new Error('UPSTREAM_ERROR')
  const data: { docs?: OpenLibraryDoc[] } = await res.json()
  return (data.docs ?? [])
    .filter(d => d.key && d.title)
    .map(d => ({
      olKey: d.key!,
      title: d.title!,
      author: d.author_name?.[0] ?? null,
      year: d.first_publish_year ?? null,
      coverUrl: d.cover_i ? coverUrlFor(d.cover_i) : null,
    }))
}
