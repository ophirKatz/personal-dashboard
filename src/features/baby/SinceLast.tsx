import { format } from 'date-fns'
import { describeEvent, formatDuration, formatSince, latestOf, runningTimer, startMs, type BabyEvent } from './babyEvents'

type Tile = { label: string; value: string; sub: string | null; live: boolean }

function Card({ label, value, sub, live }: Tile) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-3">
      <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 break-words text-[15px] font-semibold leading-tight tabular-nums ${live ? 'text-primary' : ''}`}>{value}</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub ?? '\u00a0'}</p>
    </div>
  )
}

/** The three things worth knowing at 3am: when the baby last fed, last had a diaper change, and last slept. */
export default function SinceLast({ events, now }: { events: BabyEvent[]; now: number }) {
  const feeding = runningTimer(events, 'feed')
  const lastFeed = latestOf(events, e => e.type === 'feed')
  const lastDiaper = latestOf(events, e => e.type === 'diaper')
  const sleeping = runningTimer(events, 'sleep')
  const lastSleep = latestOf(events, e => e.type === 'sleep' && !e.in_progress && !!e.ended_at)

  const short = (e: BabyEvent | null) => {
    if (!e) return null
    const d = describeEvent(e, now)
    return d.detail ? `${d.title} · ${d.detail}` : d.title
  }

  const fed: Tile = feeding
    ? { label: 'Fed', value: 'Feeding now', sub: short(feeding), live: true }
    : lastFeed
      ? { label: 'Last fed', value: formatSince(now - startMs(lastFeed)), sub: short(lastFeed), live: false }
      : { label: 'Last fed', value: '—', sub: null, live: false }

  const changed: Tile = lastDiaper
    ? { label: 'Last diaper', value: formatSince(now - startMs(lastDiaper)), sub: short(lastDiaper), live: false }
    : { label: 'Last diaper', value: '—', sub: null, live: false }

  // The verb goes in the label so the value is just a duration and fits a narrow tile.
  const slept: Tile = sleeping
    ? { label: 'Asleep for', value: formatDuration(now - startMs(sleeping)), sub: `since ${format(new Date(sleeping.started_at), 'h:mm a')}`, live: true }
    : lastSleep?.ended_at
      ? { label: 'Awake for', value: formatDuration(now - new Date(lastSleep.ended_at).getTime()), sub: `last nap ${formatDuration(new Date(lastSleep.ended_at).getTime() - startMs(lastSleep))}`, live: false }
      : { label: 'Sleep', value: '—', sub: null, live: false }

  return (
    <div className="grid grid-cols-3 gap-2" aria-label="Since last">
      <Card {...fed} />
      <Card {...changed} />
      <Card {...slept} />
    </div>
  )
}
