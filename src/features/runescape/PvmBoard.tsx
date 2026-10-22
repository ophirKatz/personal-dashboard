import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertCircle, ArrowRight } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { cn } from '../../utils'
import ProgressBar from './ProgressBar'
import PvmBossCard from './PvmBossCard'
import PvmNotes from './PvmNotes'
import { allGoals, bossGoals, countDone, nextGoal, stageGoals } from './pvm'
import { PVM_HONOURABLE_MENTIONS, PVM_STAGES, type PvmStage } from './pvm-data'
import { usePvmProgress } from './usePvmProgress'

type Props = {
  userId: string
  characterId: string
}

const TABS = [...PVM_STAGES.map(s => s.id), 'notes'] as string[]

function StagePanel({ stage, done, onToggleGoal }: { stage: PvmStage; done: ReadonlySet<string>; onToggleGoal: (key: string, next: boolean) => void }) {
  // Starts with the first unfinished boss open; later taps decide, so ticking a goal never collapses the card being worked on.
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const first = stage.bosses.find(b => countDone(bossGoals(b), done).done < bossGoals(b).length)
    return first ? { [first.key]: true } : {}
  })

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{stage.blurb}</p>

      {stage.id === 'introductory' && (
        <div className="space-y-1.5 rounded-2xl bg-muted/60 p-3.5">
          <h2 className="text-sm font-semibold">Quick lessons for brand-new players</h2>
          <p className="text-xs text-muted-foreground">Honourable mentions that teach one or two specific mechanics:</p>
          <ul className="space-y-0.5 text-sm">
            {PVM_HONOURABLE_MENTIONS.map(m => (
              <li key={m.name}><span className="font-medium">{m.name}</span> <span className="text-muted-foreground">· {m.teaches}</span></li>
            ))}
          </ul>
        </div>
      )}

      {stage.bosses.map(boss => (
        <PvmBossCard
          key={boss.key}
          boss={boss}
          done={done}
          open={open[boss.key] ?? false}
          onToggleOpen={() => setOpen(o => ({ ...o, [boss.key]: !o[boss.key] }))}
          onToggleGoal={onToggleGoal}
        />
      ))}
    </div>
  )
}

export default function PvmBoard({ userId, characterId }: Props) {
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('tab') ?? ''
  const tab = TABS.includes(requested) ? requested : PVM_STAGES[0].id
  const progress = usePvmProgress(userId, characterId)

  if (progress.loading) return <div className="h-24 animate-pulse rounded-2xl bg-muted" />
  if (progress.loadFailed) {
    return (
      <div className="flex gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="space-y-2">
          <p>Could not load your PvM progress.</p>
          <Button size="sm" variant="outline" onClick={progress.reload}>Try again</Button>
        </div>
      </div>
    )
  }

  const { done } = progress
  const overall = countDone(allGoals(), done)
  const next = nextGoal(done)

  return (
    <div className="space-y-3">
      {progress.message && (
        <button onClick={progress.dismissMessage} className="flex w-full items-start gap-2 rounded-xl bg-destructive/10 px-3.5 py-2.5 text-left text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /> <span>{progress.message}</span>
        </button>
      )}

      <section className="space-y-2.5 rounded-2xl border border-border bg-card p-3.5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Path progress</h2>
          <span className="text-sm tabular-nums text-muted-foreground">
            <span className="font-semibold text-foreground">{overall.done}</span> / {overall.total} goals
          </span>
        </div>
        <ProgressBar value={overall.done} max={overall.total} complete={overall.done === overall.total} />
        {next ? (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span><span className="font-medium text-foreground">Next:</span> {next.boss.name} · {next.goal.text}</span>
          </p>
        ) : (
          <p className="text-xs font-medium text-emerald-700">Every goal on the path is done.</p>
        )}
      </section>

      <Tabs value={tab} onValueChange={t => setSearchParams(t === PVM_STAGES[0].id ? {} : { tab: t }, { replace: true })}>
        <TabsList className="grid h-auto w-full grid-cols-4">
          {PVM_STAGES.map(stage => {
            const c = countDone(stageGoals(stage), done)
            return (
              <TabsTrigger key={stage.id} value={stage.id} className="flex-col gap-0.5 px-0.5 py-1.5">
                <span className="text-[13px] max-[359px]:text-[11px]">{stage.label}</span>
                <span className={cn('text-[11px] font-normal tabular-nums', c.done === c.total ? 'text-emerald-600' : 'text-muted-foreground')}>{c.done}/{c.total}</span>
              </TabsTrigger>
            )
          })}
          <TabsTrigger value="notes" className="flex-col gap-0.5 px-0.5 py-1.5">
            <span className="text-[13px] max-[359px]:text-[11px]">Notes</span>
            <span className="text-[11px] font-normal text-muted-foreground">Guide</span>
          </TabsTrigger>
        </TabsList>

        {/* Kept mounted (just hidden) so each tab keeps its open cards when you switch. */}
        {PVM_STAGES.map(stage => (
          <TabsContent key={stage.id} value={stage.id} forceMount className="mt-4 data-[state=inactive]:hidden">
            <StagePanel stage={stage} done={done} onToggleGoal={progress.setGoal} />
          </TabsContent>
        ))}
        <TabsContent value="notes" forceMount className="mt-4 data-[state=inactive]:hidden">
          <PvmNotes />
        </TabsContent>
      </Tabs>
    </div>
  )
}
