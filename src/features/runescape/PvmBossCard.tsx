import { Check, ChevronDown, ExternalLink } from 'lucide-react'
import { cn } from '../../utils'
import { haptic } from '../../lib/haptics'
import ProgressBar from './ProgressBar'
import { bossGoals, countDone, guideUrl } from './pvm'
import type { PvmBoss, PvmGoal } from './pvm-data'

type Props = {
  boss: PvmBoss
  done: ReadonlySet<string>
  open: boolean
  onToggleOpen: () => void
  onToggleGoal: (key: string, next: boolean) => void
}

function GoalGroup({ title, goals, done, onToggleGoal }: { title: string; goals: PvmGoal[]; done: ReadonlySet<string>; onToggleGoal: Props['onToggleGoal'] }) {
  const { done: n, total } = countDone(goals, done)
  return (
    <div className="space-y-1.5">
      <h4 className="flex items-baseline justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span>{title}</span>
        <span className="font-normal normal-case tabular-nums">{n}/{total}</span>
      </h4>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {goals.map(goal => {
          const isDone = done.has(goal.key)
          return (
            <li key={goal.key}>
              <button
                role="checkbox"
                aria-checked={isDone}
                onClick={() => onToggleGoal(goal.key, !isDone)}
                className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-accent/50"
              >
                <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border', isDone ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
                  {isDone && <Check className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0">
                  <span className={cn('block text-sm', isDone && 'text-muted-foreground line-through')}>{goal.text}</span>
                  {goal.note && <span className="mt-0.5 block text-xs text-muted-foreground">{goal.note}</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default function PvmBossCard({ boss, done, open, onToggleOpen, onToggleGoal }: Props) {
  const { done: n, total } = countDone(bossGoals(boss), done)
  const complete = n === total

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <button onClick={() => { haptic(); onToggleOpen() }} aria-expanded={open} className="w-full px-3.5 py-3 text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold">{boss.name}</span>
          <span className="flex shrink-0 items-center gap-2 text-xs tabular-nums text-muted-foreground">
            {complete && <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">Complete</span>}
            <ChevronDown className={cn('h-4 w-4 transition-transform', !open && '-rotate-90')} />
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <ProgressBar value={n} max={total} complete={complete} />
          <span className="text-xs tabular-nums text-muted-foreground">{n}/{total}</span>
        </div>
      </button>

      {open && (
        <div className="space-y-4 border-t border-border px-3.5 py-3.5">
          <div className="space-y-2 text-sm text-muted-foreground">
            {boss.summary.map((p, i) => <p key={i}>{p}</p>)}
          </div>

          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What to learn</h4>
            <ul className="list-disc space-y-1 pl-5 text-sm marker:text-muted-foreground">
              {boss.learn.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>

          <GoalGroup title="Introductory goals" goals={boss.introductory} done={done} onToggleGoal={onToggleGoal} />
          <GoalGroup title="Advanced goals" goals={boss.advanced} done={done} onToggleGoal={onToggleGoal} />

          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {boss.guides.map(g => (
              <a key={g.path} href={guideUrl(g.path)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                {g.label} <ExternalLink className="h-3 w-3" />
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
