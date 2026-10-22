import { ArrowRight } from 'lucide-react'
import { cn } from '../../utils'
import type { AbilityBar } from './ability-bars-data'
import { SLOT_KEYS, barRows, isManualBar, type Slot } from './ability-bars'
import { abilityIcon } from './ability-icons'

function Tile({ slot, accent }: { slot: Slot; accent: string }) {
  const icon = abilityIcon(slot.ability)
  return (
    <li className="flex w-[76px] flex-col items-center gap-1 text-center">
      <div className={cn('relative h-14 w-14 overflow-hidden rounded-lg border border-t-[3px] border-border bg-muted', accent)}>
        {icon && <img src={icon} alt="" draggable={false} loading="lazy" className="h-full w-full object-cover" />}
        {slot.key && (
          <span className="absolute left-0.5 top-0.5 rounded bg-black/60 px-1 text-[10px] font-semibold leading-4 text-white">{slot.key}</span>
        )}
      </div>
      <span className="text-[10px] leading-tight text-muted-foreground [overflow-wrap:anywhere]">{slot.ability}</span>
    </li>
  )
}

function AbilityIcon({ name }: { name: string }) {
  const icon = abilityIcon(name)
  return icon ? <img src={icon} alt="" draggable={false} loading="lazy" className="h-4 w-4 shrink-0 rounded-sm" /> : null
}

type Props = {
  bar: AbilityBar
  /** Tailwind top-border colour tying the tiles to their combat style. */
  accent: string
}

export default function AbilityBarCard({ bar, accent }: Props) {
  const manual = isManualBar(bar)
  const rows = barRows(bar)

  return (
    <article className="space-y-3 rounded-2xl border border-border bg-card p-3.5">
      <header className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <h3 className="text-sm font-semibold">{bar.title}</h3>
        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', manual ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')}>
          {manual ? `Manual · Revolution size ${bar.revolution}` : 'Revolution++'}
        </span>
      </header>

      <div className="space-y-2.5">
        {rows.map((row, i) => (
          <div key={row.label} className={cn(manual && i > 0 && 'rounded-xl border border-dashed border-border p-2')}>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{row.label}</p>
            <ol className="flex flex-wrap gap-1.5">
              {row.slots.map(slot => <Tile key={slot.position} slot={slot} accent={accent} />)}
            </ol>
          </div>
        ))}
      </div>

      {manual && (
        <p className="text-xs text-muted-foreground">
          Set Revolution size to {bar.revolution}, then keybind the rest yourself.
          {bar.abilities.length > SLOT_KEYS.length && ` Slots ${SLOT_KEYS.length + 1}+ have no default key.`}
        </p>
      )}

      {bar.fallbacks && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium">Don't have them all yet?</p>
          <ul className="flex flex-wrap gap-1.5">
            {bar.fallbacks.map(f => (
              <li key={f.missing} className="flex items-center gap-1 rounded-full bg-muted py-0.5 pl-1 pr-2 text-[11px]">
                <AbilityIcon name={f.missing} />
                <span>{f.missing}</span>
                <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="font-medium">{f.use ?? 'leave it out'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {bar.notes && (
        <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
          {bar.notes.map(n => <li key={n}>{n}</li>)}
        </ul>
      )}
    </article>
  )
}
