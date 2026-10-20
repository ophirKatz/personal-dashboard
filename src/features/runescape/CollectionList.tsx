import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../utils'
import { haptic } from '../../lib/haptics'
import { ARCHAEOLOGY_COLLECTIONS } from './archaeology-data'

const unique = (items: string[]) => [...new Set(items)]

export default function CollectionList() {
  const [open, setOpen] = useState<Record<string, boolean>>({})

  return (
    <div className="space-y-3">
      <section className="space-y-1 rounded-2xl border border-border bg-card p-3.5">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{ARCHAEOLOGY_COLLECTIONS.length}</span> collections, in order of availability.
        </p>
        <p className="text-xs text-muted-foreground">
          The level is when you can first complete a collection: the guide level of the last hotspot that supplies one of its artefacts.
          The Museum (Velucia) takes the same artefacts as the other collector, so they share a row.
        </p>
      </section>

      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {ARCHAEOLOGY_COLLECTIONS.map(c => {
          const isOpen = open[c.name] ?? false
          return (
            <li key={c.name}>
              <button
                onClick={() => { haptic(); setOpen(o => ({ ...o, [c.name]: !isOpen })) }}
                aria-expanded={isOpen}
                className="flex w-full items-start gap-3 px-3.5 py-3 text-left hover:bg-accent/50"
              >
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-semibold">{c.name}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">Lv {c.level}</span>
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Hand in to {c.handlers.map(h => (h.museum ? `${h.name} (Museum)` : h.name)).join(' or ')}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Last artefact from {c.finalHotspots.map(h => h.hotspot).join(' / ')} · {unique(c.finalHotspots.map(h => h.digSite)).join(' / ')}
                  </span>
                </span>
                <ChevronDown className={cn('mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform', !isOpen && '-rotate-90')} />
              </button>
              {isOpen && (
                <ul className="divide-y divide-border border-t border-border bg-muted/30">
                  {c.artefacts.map(a => (
                    <li key={a.key} className="px-3.5 py-2">
                      <span className="block text-sm">{a.name}</span>
                      <span className="block text-xs text-muted-foreground">{a.hotspot} · {a.digSite}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
