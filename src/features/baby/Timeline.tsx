import { AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '../../components/ui/button'
import { cn } from '../../utils'
import { FLAG_LABEL, describeEvent, type BabyEvent } from './babyEvents'
import { EVENT_ICON, EVENT_TINT } from './eventStyle'

type Props = {
  /** Newest first. */
  events: BabyEvent[]
  /** user id -> display name, for "who logged it". */
  names: Map<string, string>
  showAuthor: boolean
  now: number
  canWrite: boolean
  onSelect: (event: BabyEvent) => void
  onStop: (event: BabyEvent) => void
}

export default function Timeline({ events, names, showAuthor, now, canWrite, onSelect, onStop }: Props) {
  return (
    <ul className="space-y-2">
      {events.map(e => {
        const { title, detail, flag } = describeEvent(e, now)
        const Icon = EVENT_ICON[e.type]
        const author = e.logged_by ? names.get(e.logged_by) : null
        return (
          <li
            key={e.id}
            className={cn('flex items-center gap-2 rounded-xl border bg-card p-3', e.in_progress ? 'border-primary/40 bg-primary/5' : 'border-border')}
          >
            <button
              type="button"
              disabled={!canWrite}
              onClick={() => onSelect(e)}
              aria-label={`${title} at ${format(new Date(e.started_at), 'h:mm a')}${canWrite ? ', edit' : ''}`}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', EVENT_TINT[e.type])}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{title}</span>
                {detail && <span className="line-clamp-2 block text-sm text-muted-foreground">{detail}</span>}
                {flag && (
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                    <AlertTriangle className="h-3 w-3" />
                    {FLAG_LABEL[flag]}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm tabular-nums">{format(new Date(e.started_at), 'h:mm a')}</span>
                {showAuthor && author && <span className="block text-xs text-muted-foreground">{author}</span>}
              </span>
            </button>
            {e.in_progress && canWrite && (
              <Button size="sm" className="shrink-0 rounded-lg" onClick={() => onStop(e)}>
                Stop
              </Button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
