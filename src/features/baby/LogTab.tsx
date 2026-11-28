import { startOfDay } from 'date-fns'
import { Droplets, Milk, Moon, Plus, StickyNote, Sunrise } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { cn } from '../../utils'
import {
  ageLabel,
  daySummary,
  formatDuration,
  runningTimer,
  startMs,
  wetDiaperGuide,
  type Baby,
  type BabyEvent,
} from './babyEvents'
import { EVENT_ICON, EVENT_TINT } from './eventStyle'
import SinceLast from './SinceLast'
import Timeline from './Timeline'

type Props = {
  baby: Baby
  events: BabyEvent[]
  now: number
  canWrite: boolean
  names: Map<string, string>
  showAuthor: boolean
  onNew: (type: 'feed' | 'diaper' | 'sleep' | 'pump' | 'note') => void
  onStartSleep: () => void
  onSelect: (event: BabyEvent) => void
  onStop: (event: BabyEvent) => void
}

const DAY_MS = 24 * 3600_000

function Stat({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <div className="rounded-xl bg-muted/60 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums leading-tight">{value}</p>
      <p className="truncate text-xs text-muted-foreground">{sub ?? ' '}</p>
    </div>
  )
}

export default function LogTab({ baby, events, now, canWrite, names, showAuthor, onNew, onStartSleep, onSelect, onStop }: Props) {
  const sleeping = runningTimer(events, 'sleep')
  const today = daySummary(events, startOfDay(new Date(now)), now)
  const guide = wetDiaperGuide(baby.birth_date, new Date(now))
  const age = ageLabel(baby.birth_date, new Date(now))
  // Pumping counters appear once someone has used pumping, so they don't clutter the screen for those who don't.
  const showPumping = events.some(e => e.type === 'pump')
  const PumpIcon = EVENT_ICON.pump
  const recent = events.filter(e => e.in_progress || startMs(e) >= now - DAY_MS)

  return (
    <div className="space-y-5">
      {age && <p className="-mt-2 text-sm text-muted-foreground">{age}</p>}

      <SinceLast events={events} now={now} />

      {canWrite && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onNew('feed')}
              className={cn('flex h-24 flex-col items-center justify-center gap-1.5 rounded-2xl text-sm font-semibold active:scale-[0.97] transition-transform', EVENT_TINT.feed)}
            >
              <Milk className="h-7 w-7" />
              Feed
            </button>
            <button
              type="button"
              onClick={() => onNew('diaper')}
              className={cn('flex h-24 flex-col items-center justify-center gap-1.5 rounded-2xl text-sm font-semibold active:scale-[0.97] transition-transform', EVENT_TINT.diaper)}
            >
              <Droplets className="h-7 w-7" />
              Diaper
            </button>
            <button
              type="button"
              onClick={() => (sleeping ? onStop(sleeping) : onStartSleep())}
              className={cn('flex h-24 flex-col items-center justify-center gap-1.5 rounded-2xl text-sm font-semibold active:scale-[0.97] transition-transform', EVENT_TINT.sleep)}
            >
              {sleeping ? <Sunrise className="h-7 w-7" /> : <Moon className="h-7 w-7" />}
              {sleeping ? 'Wake up' : 'Sleep'}
            </button>
          </div>
          <div className="-mt-2 flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 rounded-lg" onClick={() => onNew('sleep')}>
              <Plus className="h-3.5 w-3.5" /> Past sleep
            </Button>
            <Button variant="outline" size="sm" className="flex-1 rounded-lg" onClick={() => onNew('pump')}>
              <PumpIcon className="h-3.5 w-3.5" /> Pump
            </Button>
            <Button variant="outline" size="sm" className="flex-1 rounded-lg" onClick={() => onNew('note')}>
              <StickyNote className="h-3.5 w-3.5" /> Note
            </Button>
          </div>
        </>
      )}

      <section aria-label="Today" className="space-y-2">
        <h2 className="px-1 text-sm font-semibold">Today</h2>
        <div className="grid grid-cols-4 gap-2">
          <Stat label="Feeds" value={String(today.feeds)} sub={today.bottleMl ? `${today.bottleMl} ml` : null} />
          <Stat label="Wet" value={String(today.wet)} />
          <Stat label="Dirty" value={String(today.dirty)} />
          <Stat label="Sleep" value={formatDuration(today.sleepMs)} />
        </div>
        {showPumping && (
          <div className="grid grid-cols-3 gap-2" aria-label="Pumped today">
            <Stat label="Pumped" value={`${today.pumpedMl} ml`} sub={`${today.pumps} session${today.pumps === 1 ? '' : 's'}`} />
            <Stat label="Left" value={`${today.pumpedLeftMl} ml`} />
            <Stat label="Right" value={`${today.pumpedRightMl} ml`} />
          </div>
        )}
        {guide && (
          <p className="px-1 text-xs text-muted-foreground">
            Day {guide.dayOfLife}: a rough guide is {guide.expectedWet} or more wet diapers a day. Not medical advice; if you're worried, call your pediatrician.
          </p>
        )}
      </section>

      <section aria-label="Last 24 hours" className="space-y-2">
        <h2 className="px-1 text-sm font-semibold">Last 24 hours</h2>
        {recent.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {events.length === 0 ? 'Nothing logged yet.' : 'Nothing in the last 24 hours.'}
            {canWrite && ' Tap Feed, Diaper or Sleep when it happens.'}
          </p>
        ) : (
          <Timeline events={recent} names={names} showAuthor={showAuthor} now={now} canWrite={canWrite} onSelect={onSelect} onStop={onStop} />
        )}
      </section>
    </div>
  )
}
