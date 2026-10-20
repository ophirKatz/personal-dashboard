import { useState } from 'react'
import { Check, ChevronDown, ExternalLink } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { cn } from '../../utils'
import { haptic } from '../../lib/haptics'
import { ARCHAEOLOGY_MYSTERIES } from './archaeology-mysteries-data'
import { ARCHAEOLOGY_MYSTERY_NOTES } from './archaeology-mystery-notes'
import ProgressBar from './ProgressBar'
import { isComplete, mysteryProgressKey, summarize, type ArchaeologyMystery, type FoundMap } from './archaeology'

type Props = {
  found: FoundMap
  onChange: (key: string, count: number) => void
}

const MYSTERY_ITEMS = ARCHAEOLOGY_MYSTERIES.map(m => ({ key: mysteryProgressKey(m.key), name: m.name, needed: 1 }))

function requirementsText(m: ArchaeologyMystery) {
  const boost = m.boostable === undefined ? '' : m.boostable ? ' (boostable)' : ' (not boostable)'
  return [`${m.level} Archaeology${boost}`, ...m.requirements].join(' · ')
}

function BulletList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="text-xs font-semibold">{title}</p>
      <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
        {items.map(i => <li key={i}>{i}</li>)}
      </ul>
    </div>
  )
}

function MysteryRow({ mystery: m, solved, open, onToggleSolved, onToggleOpen }: { mystery: ArchaeologyMystery; solved: boolean; open: boolean; onToggleSolved: () => void; onToggleOpen: () => void }) {
  const note = ARCHAEOLOGY_MYSTERY_NOTES[m.key]
  return (
    <li className={cn('flex items-start gap-3 px-3.5 py-3', solved && 'bg-emerald-50/60')}>
      <button
        type="button"
        role="checkbox"
        aria-checked={solved}
        aria-label={`${m.name}: solved`}
        onClick={onToggleSolved}
        className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border', solved ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-border hover:bg-accent')}
      >
        {solved && <Check className="h-4 w-4" />}
      </button>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn('text-sm font-semibold', solved && 'text-emerald-800')}>{m.name}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">Lv {m.level}</span>
        </div>
        <p className="text-xs text-muted-foreground">{m.digSite} · {m.alignment}</p>
        {note && <p className="text-sm">{note.about}</p>}
        {note && (
          <p className="text-sm">
            <span className="font-semibold">Start: </span>
            {note.start}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Requires: </span>
          {requirementsText(m)}
        </p>
        <button onClick={onToggleOpen} aria-expanded={open} className="flex items-center gap-1 text-xs font-medium text-primary">
          Items &amp; rewards
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !open && '-rotate-90')} />
        </button>
        {open && (
          <div className="space-y-2 rounded-xl bg-muted/50 p-3">
            <BulletList title="Items needed" items={m.items} />
            {m.items.length === 0 && <p className="text-xs text-muted-foreground">No items needed.</p>}
            <BulletList title="Rewards" items={m.rewards} />
            <a
              href={`https://runescape.wiki/w/${encodeURIComponent(m.title)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary"
            >
              Full walkthrough on the wiki <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>
    </li>
  )
}

export default function MysteryList({ found, onChange }: Props) {
  const [hideSolved, setHideSolved] = useState(false)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const summary = summarize(MYSTERY_ITEMS, found)
  const shown = ARCHAEOLOGY_MYSTERIES.filter(m => !hideSolved || !isComplete(found[mysteryProgressKey(m.key)] ?? 0, 1))

  return (
    <div className="space-y-3">
      <section className="space-y-2 rounded-2xl border border-border bg-card p-3.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{summary.complete}</span> / {summary.total} mysteries solved
          </span>
        </div>
        <ProgressBar value={summary.complete} max={summary.total} complete={summary.complete === summary.total} />
        <p className="text-xs text-muted-foreground">In order of availability: by Archaeology level, then after the mysteries each one follows.</p>
      </section>

      <div className="flex justify-end">
        <Button variant={hideSolved ? 'default' : 'outline'} size="sm" className="rounded-xl" aria-pressed={hideSolved} onClick={() => setHideSolved(h => !h)}>
          Hide solved
        </Button>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-3.5 py-8 text-center text-sm text-muted-foreground">Every mystery is solved.</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {shown.map(m => {
            const key = mysteryProgressKey(m.key)
            const solved = isComplete(found[key] ?? 0, 1)
            return (
              <MysteryRow
                key={m.key}
                mystery={m}
                solved={solved}
                open={open[m.key] ?? false}
                onToggleSolved={() => onChange(key, solved ? 0 : 1)}
                onToggleOpen={() => { haptic(); setOpen(o => ({ ...o, [m.key]: !(o[m.key] ?? false) })) }}
              />
            )
          })}
        </ul>
      )}
    </div>
  )
}
