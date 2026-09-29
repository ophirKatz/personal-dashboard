import { Check, MoreHorizontal } from 'lucide-react'
import type { ReadingBook } from '../../supabase'
import { cn } from '../../utils'
import BookCover from './BookCover'

type Props = {
  book: ReadingBook
  /** Shown under the author when results span several folders. */
  location?: string
  onToggleRead: () => void
  onMenu: () => void
}

export default function BookCard({ book, location, onToggleRead, onMenu }: Props) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/50">
      <div className="relative">
        <BookCover url={book.cover_url} title={book.title} className={cn('aspect-[2/3] w-full', book.is_read && 'opacity-60')} />
        <button
          onClick={onToggleRead}
          aria-label={book.is_read ? 'Mark as unread' : 'Mark as read'}
          aria-pressed={book.is_read}
          className={cn(
            'absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border shadow-sm backdrop-blur transition-colors',
            book.is_read
              ? 'border-transparent bg-primary text-primary-foreground'
              : 'border-border bg-background/80 text-transparent hover:text-muted-foreground',
          )}
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          onClick={onMenu}
          aria-label="Book actions"
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/80 text-muted-foreground shadow-sm backdrop-blur hover:text-foreground"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
      <div className="p-3 space-y-1">
        <p className={cn('font-medium leading-tight line-clamp-2', book.is_read && 'text-muted-foreground')}>{book.title}</p>
        {book.author && <p className="text-xs text-muted-foreground truncate">{book.author}</p>}
        {location && <p className="text-[11px] text-muted-foreground/70 truncate">{location}</p>}
      </div>
    </div>
  )
}
