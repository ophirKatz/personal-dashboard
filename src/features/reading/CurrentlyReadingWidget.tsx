import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, CheckCircle2, ChevronRight } from 'lucide-react'
import type { ReadingBook } from '../../supabase'
import { Button } from '../../components/ui/button'
import { celebrateFromElement } from '../../lib/confetti'
import { haptic } from '../../lib/haptics'
import BookCover from './BookCover'
import PickNextBookDrawer from './PickNextBookDrawer'
import { completeBook, fetchCurrentBook, setCurrentBook } from './currentBook'

/**
 * Home-screen widget. Shown only while a book is flagged "currently reading" on the
 * Reading page. After completing the book it stays in a "finished" state so the next
 * book can be chosen right here.
 */
export default function CurrentlyReadingWidget() {
  const [book, setBook] = useState<ReadingBook | null>(null)
  const [finished, setFinished] = useState<ReadingBook | null>(null)
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const completeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { fetchCurrentBook().then(setBook) }, [])

  async function complete() {
    if (!book) return
    setBusy(true)
    setError(null)
    const { error } = await completeBook(book.id)
    setBusy(false)
    if (error) { setError(error); return }
    if (completeRef.current) celebrateFromElement(completeRef.current)
    haptic('success')
    setFinished(book)
    setBook(null)
  }

  async function pick(next: ReadingBook) {
    setError(null)
    const { error } = await setCurrentBook(next.id)
    if (error) { setError(error); return }
    haptic('success')
    setPicking(false)
    setFinished(null)
    setBook({ ...next, is_current: true })
  }

  if (!book && !finished) return null

  return (
    <div className="bg-card border border-border rounded-xl p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Currently reading</h2>
        <Link to="/reading" className="flex items-center gap-0.5 text-xs text-primary">
          Reading list <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {book ? (
        <div className="flex items-center gap-3">
          <BookCover url={book.cover_url} title={book.title} className="h-24 w-16 shrink-0 rounded-md shadow-sm" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <div>
              <p className="font-medium leading-tight line-clamp-2">{book.title}</p>
              {book.author && <p className="text-sm text-muted-foreground truncate">{book.author}</p>}
            </div>
            <Button ref={completeRef} size="sm" variant="outline" disabled={busy} onClick={complete} className="rounded-lg">
              <CheckCircle2 className="mr-1.5 h-4 w-4" /> {busy ? 'Saving…' : 'Mark as completed'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium">Finished 🎉</p>
            <p className="text-sm text-muted-foreground truncate">{finished?.title}</p>
          </div>
          <Button size="sm" onClick={() => setPicking(true)} className="rounded-lg shrink-0">Choose next book</Button>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <PickNextBookDrawer open={picking} onClose={() => setPicking(false)} onPick={pick} />
    </div>
  )
}
