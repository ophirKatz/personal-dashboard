import { Check, Target } from 'lucide-react'
import type { WealthGoal } from '../../supabase'
import { cn } from '../../utils'
import { describeDaysLeft, formatMoney, formatMoneyRounded, goalProgress, scopeLabel, sortGoals } from './wealth'
import type { ItemValue } from './wealth'

type Props = {
  goals: WealthGoal[]
  /** All items' values (unfiltered): each goal applies its own owner scope. */
  values: ItemValue[]
  todayStr: string
  onOpen: (goal: WealthGoal) => void
}

export default function GoalsList({ goals, values, todayStr, onOpen }: Props) {
  if (goals.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Target className="mx-auto mb-3 h-10 w-10" />
        <p className="font-medium">No goals yet — tap + to set your first one</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {sortGoals(goals).map(goal => {
        const p = goalProgress(goal, values, todayStr)
        return (
          <button
            key={goal.id}
            type="button"
            onClick={() => onOpen(goal)}
            className="block w-full space-y-2.5 rounded-xl border border-border bg-card p-3.5 text-left transition-colors hover:border-primary/50"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold leading-tight">{goal.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{scopeLabel(goal.scope)}</p>
              </div>
              {p.reached ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                  <Check className="h-3 w-3" /> Reached
                </span>
              ) : (
                <span className="shrink-0 text-lg font-bold tabular-nums">{Math.floor(p.pct)}%</span>
              )}
            </div>

            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.floor(p.pct)}
              aria-label={`${goal.name} progress`}
            >
              <div
                className={cn('h-full rounded-full transition-all', p.reached ? 'bg-emerald-500' : 'bg-primary')}
                style={{ width: `${p.pct}%` }}
              />
            </div>

            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="tabular-nums">
                {formatMoneyRounded(p.current)} of {formatMoney(goal.target_amount)}
              </span>
              {p.daysLeft !== null && (
                <span className={cn(p.daysLeft < 0 && !p.reached && 'font-medium text-destructive')}>
                  {p.reached ? '' : describeDaysLeft(p.daysLeft)}
                </span>
              )}
            </div>

            {goal.notes && <p className="line-clamp-2 text-sm text-muted-foreground">{goal.notes}</p>}
          </button>
        )
      })}
    </div>
  )
}
