import { useSearchParams } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { cn } from '../../utils'
import AbilityBarCard from './AbilityBarCard'
import { ABILITY_BARS, type BarStyleId } from './ability-bars-data'

const ACCENT: Record<BarStyleId, { tile: string; tab: string }> = {
  melee: { tile: 'border-t-rose-500', tab: 'data-[state=active]:text-rose-600' },
  ranged: { tile: 'border-t-emerald-500', tab: 'data-[state=active]:text-emerald-600' },
  magic: { tile: 'border-t-blue-500', tab: 'data-[state=active]:text-blue-600' },
  necromancy: { tile: 'border-t-violet-500', tab: 'data-[state=active]:text-violet-600' },
}

function HowItWorks() {
  return (
    <details className="group rounded-2xl border border-border bg-card px-3.5 py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        How to read these bars
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <ul className="mt-2.5 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
        <li>Revolution fires the first available ability on your main action bar, left to right, across as many slots as you set in Combat Settings (1 to 14).</li>
        <li>Revolution++ means all ability types are set to automatic: basic, threshold, enhanced and ultimate.</li>
        <li>Manual bars use a smaller Revolution size. Set it to the number shown and keybind the abilities after it yourself.</li>
        <li>The small key on each icon is the default keybind for that slot: 1 to 9, 0, - and =.</li>
        <li>Revolution skips empty slots with no delay, so leave a gap for anything you haven't unlocked.</li>
        <li>These are all-rounder bars. Some bosses have unique mechanics and phasing where a hand-tuned bar does better.</li>
      </ul>
    </details>
  )
}

export default function AbilityBars() {
  const [searchParams, setSearchParams] = useSearchParams()
  const style = ABILITY_BARS.find(s => s.id === searchParams.get('style')) ?? ABILITY_BARS[0]

  return (
    <div className="space-y-3">
      <HowItWorks />

      <Tabs value={style.id} onValueChange={id => setSearchParams(id === ABILITY_BARS[0].id ? {} : { style: id }, { replace: true })}>
        <TabsList className="grid h-auto w-full grid-cols-4">
          {ABILITY_BARS.map(s => (
            <TabsTrigger key={s.id} value={s.id} className={cn('px-0 py-2 text-[13px] max-[359px]:text-[11px]', ACCENT[s.id].tab)}>{s.label}</TabsTrigger>
          ))}
        </TabsList>

        {ABILITY_BARS.map(s => (
          <TabsContent key={s.id} value={s.id} className="mt-4 space-y-5">
            {s.groups.map(group => (
              <section key={group.id} className="space-y-2.5">
                <div className="space-y-0.5">
                  <h2 className="text-base font-semibold">{group.label}</h2>
                  {group.note && <p className="text-xs text-muted-foreground">{group.note}</p>}
                </div>
                {group.bars.map(bar => <AbilityBarCard key={bar.key} bar={bar} accent={ACCENT[s.id].tile} />)}
              </section>
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
