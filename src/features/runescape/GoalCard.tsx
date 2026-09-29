import { Link } from 'react-router-dom'
import { Check, Scroll, Sparkles, Trash2, Undo2 } from 'lucide-react'
import type { RsGoal } from '../../supabase'
import { cn } from '../../utils'
import { SKILL_BY_ID } from './skills'
import type { GoalProgress } from './goals'
import ProgressRing from './ProgressRing'

type Props = {
  goal: RsGoal
  title: string
  progress: GoalProgress
  onToggleComplete: () => void
  onDelete: () => void
}

export default function GoalCard({ goal, title, progress, onToggleComplete, onDelete }: Props) {
  const SkillIcon = goal.type === 'skill' ? SKILL_BY_ID.get(goal.skill_id ?? -1)?.icon : undefined
  const Icon = SkillIcon ?? (goal.type === 'quest' ? Scroll : Sparkles)
  const done = progress.done || !!goal.completed_at
  // Skill/quest goals complete themselves from live data; only free-text goals are checked off by hand.
  const manual = goal.type === 'arbitrary'

  return (
    <div className={cn('flex items-center gap-3 rounded-2xl border p-3.5 transition-colors animate-in fade-in-0 slide-in-from-bottom-2 duration-300', done ? 'border-emerald-200 bg-emerald-50/60' : 'border-border bg-card')}>
      <ProgressRing
        value={progress.fraction}
        size={52}
        stroke={4}
        barClassName={done ? 'stroke-emerald-500' : 'stroke-primary'}
        trackClassName={done ? 'stroke-emerald-100' : 'stroke-muted'}
      >
        {done ? <Check className="h-5 w-5 text-emerald-600" /> : <Icon className="h-5 w-5 text-muted-foreground" />}
      </ProgressRing>
      <div className="min-w-0 flex-1">
        {goal.type === 'quest' ? (
          <Link to={`/runescape/quests/${encodeURIComponent(title)}`} className={cn('block font-semibold truncate hover:underline', done && 'text-emerald-800')}>
            {title}
          </Link>
        ) : (
          <div className={cn('font-semibold truncate', done && 'text-emerald-800')}>{title}</div>
        )}
        <div className="text-xs text-muted-foreground truncate">
          {progress.label}{progress.detail ? ` · ${progress.detail}` : ''}
        </div>
      </div>
      {manual && (
        <button
          onClick={onToggleComplete}
          aria-label={goal.completed_at ? 'Mark as not done' : 'Mark as done'}
          className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {goal.completed_at ? <Undo2 className="h-4 w-4" /> : <Check className="h-4 w-4" />}
        </button>
      )}
      <button onClick={onDelete} aria-label="Delete goal" className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-destructive">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
