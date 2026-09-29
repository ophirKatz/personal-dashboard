import { Folder as FolderIcon, MoreHorizontal } from 'lucide-react'
import BookCover from './BookCover'

type Props = {
  name: string
  /** Second line, e.g. "9 books" or the folder's location. */
  subtitle: string
  /** Up to 4 covers shown as a mosaic; empty folders show a folder icon. */
  covers: { url: string | null; title: string }[]
  onOpen: () => void
  onMenu: () => void
}

/** Sits in the same grid as BookCard: same cover-shaped tile, with a 2x2 preview of what's inside. */
export default function FolderCard({ name, subtitle, covers, onOpen, onMenu }: Props) {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/50">
      <button onClick={onOpen} aria-label={`Open folder ${name}`} className="text-left">
        <div className="aspect-[2/3] w-full bg-muted p-3">
          {covers.length === 0 ? (
            <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-border">
              <FolderIcon className="h-10 w-10 text-blue-400/70" />
            </div>
          ) : (
            <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-1.5">
              {[0, 1, 2, 3].map(i => (
                <BookCover
                  key={i}
                  compact
                  url={covers[i]?.url ?? null}
                  title={covers[i]?.title ?? ''}
                  className={i < covers.length ? 'rounded-md shadow-sm' : 'rounded-md bg-background/50'}
                />
              ))}
            </div>
          )}
        </div>
        <div className="p-3 space-y-1">
          <p className="flex items-center gap-1.5 font-medium leading-tight">
            <FolderIcon className="h-4 w-4 shrink-0 text-blue-400" />
            <span className="line-clamp-2">{name}</span>
          </p>
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        </div>
      </button>
      <button
        onClick={onMenu}
        aria-label={`Actions for ${name}`}
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-black/35 text-white shadow-sm backdrop-blur hover:bg-black/50"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
    </div>
  )
}
