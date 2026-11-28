import { Button } from '../../components/ui/button'
import { daySummary, dayLabel, formatDuration, groupByDay, type BabyEvent } from './babyEvents'
import Timeline from './Timeline'

type Props = {
  events: BabyEvent[]
  now: number
  canWrite: boolean
  names: Map<string, string>
  showAuthor: boolean
  windowDays: number
  onShowEarlier: () => void
  onSelect: (event: BabyEvent) => void
  onStop: (event: BabyEvent) => void
}

function summaryLine(events: BabyEvent[], day: Date, now: number): string {
  const s = daySummary(events, day, now)
  const parts = [
    s.feeds ? `${s.feeds} feed${s.feeds === 1 ? '' : 's'}` : null,
    s.bottleMl ? `${s.bottleMl} ml fed` : null,
    s.wet ? `${s.wet} wet` : null,
    s.dirty ? `${s.dirty} dirty` : null,
    s.pumpedMl ? `${s.pumpedMl} ml pumped` : null,
    s.sleepMs >= 60_000 ? `${formatDuration(s.sleepMs)} sleep` : null,
  ]
  return parts.filter(Boolean).join(' · ')
}

export default function HistoryTab({ events, now, canWrite, names, showAuthor, windowDays, onShowEarlier, onSelect, onStop }: Props) {
  const days = groupByDay(events)

  return (
    <div className="space-y-6">
      {days.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nothing logged in the last {windowDays} days.
        </p>
      )}
      {days.map(day => (
        <section key={day.key} aria-label={dayLabel(day.date)} className="space-y-2">
          <div className="px-1">
            <h2 className="text-sm font-semibold">{dayLabel(day.date)}</h2>
            <p className="text-xs text-muted-foreground">{summaryLine(events, day.date, now)}</p>
          </div>
          <Timeline events={day.events} names={names} showAuthor={showAuthor} now={now} canWrite={canWrite} onSelect={onSelect} onStop={onStop} />
        </section>
      ))}
      <Button variant="outline" className="w-full rounded-xl" onClick={onShowEarlier}>
        Show 7 earlier days
      </Button>
    </div>
  )
}
