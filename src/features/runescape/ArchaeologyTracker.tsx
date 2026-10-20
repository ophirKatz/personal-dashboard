import { useMemo, useState } from 'react'
import { Check, ChevronDown, Minus, Plus } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { cn } from '../../utils'
import { haptic } from '../../lib/haptics'
import { ARCHAEOLOGY_GROUPS } from './archaeology-data'
import ProgressBar from './ProgressBar'
import { MAX_COUNT, clampCount, groupArtefacts, isComplete, summarize, type ArchaeologyArtefact, type FoundMap } from './archaeology'

type Props = {
  found: FoundMap
  onChange: (key: string, count: number) => void
}

const ALL_ARTEFACTS = ARCHAEOLOGY_GROUPS.flatMap(groupArtefacts)

const stepperClass = 'flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent'

/** Typing is held as a draft and saved on blur/Enter, so "12" isn't saved as "1" first. */
function CountInput({ value, label, onCommit }: { value: number; label: string; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)

  function commit() {
    if (draft === null) return
    setDraft(null)
    const n = clampCount(Number(draft))
    if (draft !== '' && n !== value) onCommit(n)
  }

  return (
    <Input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      aria-label={`${label}: number found`}
      value={draft ?? String(value)}
      onChange={e => setDraft(e.target.value.replace(/\D/g, '').slice(0, String(MAX_COUNT).length))}
      onFocus={e => e.currentTarget.select()}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
      className="h-8 w-12 px-1 py-0 text-center tabular-nums"
    />
  )
}

function ArtefactRow({ artefact, digSite, found, onChange }: { artefact: ArchaeologyArtefact; digSite: string; found: number; onChange: (n: number) => void }) {
  const done = isComplete(found, artefact.needed)
  return (
    <li className={cn('flex items-center gap-3 px-3.5 py-2', done && 'bg-emerald-50/60')}>
      <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border', done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-border')}>
        {done && <Check className="h-3.5 w-3.5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm font-medium', done && 'text-emerald-800')}>
          {artefact.name}
          {done && <span className="sr-only"> (complete)</span>}
        </span>
        <span className="block text-xs text-muted-foreground">{digSite}</span>
      </span>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" className={stepperClass} disabled={found <= 0} onClick={() => onChange(found - 1)} aria-label={`One fewer ${artefact.name}`}>
          <Minus className="h-4 w-4" />
        </button>
        <CountInput value={found} label={artefact.name} onCommit={onChange} />
        <span className="w-6 text-xs tabular-nums text-muted-foreground">/ {artefact.needed}</span>
        <button type="button" className={stepperClass} disabled={found >= MAX_COUNT} onClick={() => onChange(found + 1)} aria-label={`One more ${artefact.name}`}>
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </li>
  )
}

export default function ArchaeologyTracker({ found, onChange }: Props) {
  const [hideComplete, setHideComplete] = useState(false)
  // Start with the first group that still has something to find open.
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const first = ARCHAEOLOGY_GROUPS.find(g => {
      const s = summarize(groupArtefacts(g), found)
      return s.complete < s.total
    })
    return first ? { [first.group]: true } : {}
  })

  const overall = useMemo(() => summarize(ALL_ARTEFACTS, found), [found])

  return (
    <div className="space-y-3">
      <section className="space-y-2 rounded-2xl border border-border bg-card p-3.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{overall.complete}</span> / {overall.total} artefacts complete
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">{overall.found}/{overall.needed} found</span>
        </div>
        <ProgressBar value={overall.found} max={overall.needed} complete={overall.complete === overall.total} />
      </section>

      <div className="flex justify-end">
        <Button variant={hideComplete ? 'default' : 'outline'} size="sm" className="rounded-xl" aria-pressed={hideComplete} onClick={() => setHideComplete(h => !h)}>
          Hide completed
        </Button>
      </div>

      {ARCHAEOLOGY_GROUPS.map(g => {
        const s = summarize(groupArtefacts(g), found)
        const isOpen = open[g.group] ?? false
        const complete = s.complete === s.total
        return (
          <section key={g.group} className="overflow-hidden rounded-2xl border border-border bg-card">
            <button
              onClick={() => { haptic(); setOpen(o => ({ ...o, [g.group]: !isOpen })) }}
              aria-expanded={isOpen}
              className="w-full px-3.5 py-3 text-left"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{g.group}</span>
                <span className="flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
                  {complete ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">Complete</span> : `${s.total - s.complete} to go`}
                  <ChevronDown className={cn('h-4 w-4 transition-transform', !isOpen && '-rotate-90')} />
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <ProgressBar value={s.found} max={s.needed} complete={complete} />
                <span className="text-xs tabular-nums text-muted-foreground">{s.found}/{s.needed}</span>
              </div>
            </button>
            {isOpen && (() => {
              const hotspots = g.hotspots
                .map(h => ({ h, shown: hideComplete ? h.artefacts.filter(a => !isComplete(found[a.key] ?? 0, a.needed)) : h.artefacts }))
                .filter(x => x.shown.length > 0)
              if (hotspots.length === 0) {
                return <p className="border-t border-border px-3.5 py-3 text-center text-sm text-muted-foreground">Everything here is complete.</p>
              }
              return (
                <div className="divide-y divide-border border-t border-border">
                  {hotspots.map(({ h, shown }) => {
                    const hs = summarize(h.artefacts, found)
                    return (
                      <div key={`${h.level}|${h.hotspot}`}>
                        <div className="flex items-center justify-between gap-2 bg-muted/40 px-3.5 py-2">
                          <span className="min-w-0 text-sm font-semibold">
                            {h.hotspot} <span className="text-xs font-normal text-muted-foreground">Lv {h.level}</span>
                          </span>
                          {hs.complete === hs.total
                            ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Complete</span>
                            : <span className="text-xs tabular-nums text-muted-foreground">{hs.complete}/{hs.total}</span>}
                        </div>
                        <ul className="divide-y divide-border">
                          {shown.map(a => (
                            <ArtefactRow key={a.key} artefact={a} digSite={h.digSite} found={found[a.key] ?? 0} onChange={n => onChange(a.key, n)} />
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </section>
        )
      })}
    </div>
  )
}
