import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import type { ReadingBook } from '../../supabase'
import { Input } from '../../components/ui/input'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
import BookCover from './BookCover'
import { fetchUnreadBooks, pickableBooks } from './currentBook'

type Props = {
  open: boolean
  onClose: () => void
  onPick: (book: ReadingBook) => void
}

export default function PickNextBookDrawer({ open, onClose, onPick }: Props) {
  const [books, setBooks] = useState<ReadingBook[] | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) return
    setQuery('')
    setBooks(null)
    fetchUnreadBooks().then(setBooks)
  }, [open])

  const choices = useMemo(() => pickableBooks(books ?? [], query), [books, query])

  return (
    <Drawer open={open} onOpenChange={v => !v && onClose()}>
      <DrawerContent>
        <DrawerHeader><DrawerTitle>Choose your next book</DrawerTitle></DrawerHeader>
        <DrawerBody className="space-y-3">
          {books === null ? (
            <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : books.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <div className="text-4xl mb-3">📚</div>
              <p className="text-sm">No unread books on your list.</p>
              <Link to="/reading" className="mt-2 inline-block text-sm font-medium text-primary">Add books in Reading</Link>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search your unread books…"
                  className="h-12 rounded-xl pl-9 text-base"
                />
              </div>
              {choices.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No matches</p>}
              <div className="space-y-2">
                {choices.map(book => (
                  <button
                    key={book.id}
                    onClick={() => onPick(book)}
                    className="w-full flex items-center gap-3 rounded-xl border border-border bg-card p-2.5 text-left transition-colors hover:bg-accent"
                  >
                    <BookCover url={book.cover_url} title={book.title} className="h-20 w-14 shrink-0 rounded-md" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-tight line-clamp-2">{book.title}</p>
                      {book.author && <p className="text-xs text-muted-foreground truncate">{book.author}</p>}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
