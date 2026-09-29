import { useEffect, useState } from 'react'
import { Check, FolderInput, Loader2, Search } from 'lucide-react'
import { supabase } from '../../supabase'
import type { ReadingFolder } from '../../supabase'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
import { haptic } from '../../lib/haptics'
import { searchBooks, type BookSearchResult } from './bookSearch'
import { pathLabel, type FolderId } from './folderTree'
import BookCover from './BookCover'
import MoveDialog from './MoveDialog'

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  userId: string
  folders: ReadingFolder[]
  /** Folder the user is currently viewing; the default save target. */
  defaultFolderId: FolderId
  savedKeys: Set<string>
  onCreateFolder: (parentId: FolderId, name: string) => Promise<void>
}

export default function BookSearchDrawer({
  open, onClose, onSaved, userId, folders, defaultFolderId, savedKeys, onCreateFolder,
}: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<BookSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [targetId, setTargetId] = useState<FolderId>(defaultFolderId)
  const [picking, setPicking] = useState(false)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState<Set<string>>(new Set())

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        setResults(await searchBooks(q, controller.signal))
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setResults([])
        setError('Could not search books. Try again in a moment.')
      }
      setLoading(false)
    }, 400)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query])

  async function save(book: BookSearchResult) {
    setSavingKey(book.olKey)
    const { error } = await supabase.from('reading_books').insert({
      user_id: userId,
      folder_id: targetId,
      ol_key: book.olKey,
      title: book.title,
      author: book.author,
      cover_url: book.coverUrl,
      first_publish_year: book.year,
    })
    setSavingKey(null)
    if (error) {
      setError(error.code === '23505' ? 'That book is already on your list.' : error.message)
      return
    }
    haptic('success')
    setJustSaved(prev => new Set(prev).add(book.olKey))
    onSaved()
  }

  return (
    <>
      <Drawer open={open} onOpenChange={v => !v && onClose()}>
        <DrawerContent>
          <DrawerHeader><DrawerTitle>Find a book</DrawerTitle></DrawerHeader>
          <DrawerBody className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Title, author or ISBN…"
                autoFocus
                className="h-12 rounded-xl pl-9 text-base"
              />
            </div>

            <button
              onClick={() => setPicking(true)}
              className="flex w-full items-center gap-2 rounded-xl bg-muted px-3 py-2 text-left text-sm"
            >
              <FolderInput className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">Saving to</span>
              <span className="flex-1 truncate font-medium">{pathLabel(folders, targetId)}</span>
              <span className="text-primary font-medium">Change</span>
            </button>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
            )}

            {loading && (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            )}

            {!loading && !error && query.trim().length >= 2 && results.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No books found</p>
            )}
            {!loading && query.trim().length < 2 && (
              <div className="py-8 text-center text-muted-foreground">
                <div className="text-4xl mb-3">📚</div>
                <p className="text-sm">Search millions of books by title or author</p>
              </div>
            )}

            <div className="space-y-2">
              {!loading && results.map(book => {
                const saved = savedKeys.has(book.olKey) || justSaved.has(book.olKey)
                return (
                  <div key={book.olKey} className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
                    <BookCover url={book.coverUrl} title={book.title} className="h-20 w-14 shrink-0 rounded-md" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-tight line-clamp-2">{book.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[book.author, book.year].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {saved ? (
                      <span className="flex items-center gap-1 pr-2 text-sm font-medium text-primary">
                        <Check className="h-4 w-4" /> Saved
                      </span>
                    ) : (
                      <Button size="sm" className="rounded-lg" disabled={savingKey === book.olKey} onClick={() => save(book)}>
                        {savingKey === book.olKey ? 'Saving…' : 'Save'}
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {picking && (
        <MoveDialog
          open
          onClose={() => setPicking(false)}
          title="Save books to…"
          confirmLabel="Save here"
          folders={folders}
          currentFolderId={targetId}
          allowSameFolder
          onCreateFolder={onCreateFolder}
          onConfirm={id => { setTargetId(id); setPicking(false) }}
        />
      )}
    </>
  )
}
