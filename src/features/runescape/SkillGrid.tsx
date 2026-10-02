import { cn } from '../../utils'
import type { CharacterStats } from './api'
import { SKILLS, VIRTUAL_MAX, formatXp, progressToNext, progressToVirtualMax, realLevel, skillLevel } from './skills'
import ProgressRing from './ProgressRing'

export default function SkillGrid({ stats }: { stats: CharacterStats }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
      {SKILLS.map((skill, i) => {
        const stat = stats.skills.get(skill.id)
        const virtual = stat ? skillLevel(skill, stat) : 1
        const real = stat ? realLevel(skill, stat) : 1
        const hasVirtual = virtual > real
        const mastered = real >= 99
        const maxed = virtual >= VIRTUAL_MAX
        const Icon = skill.icon
        // Ring: progress to the next level (real, or virtual once past the real cap).
        const ring = !stat ? 0 : skill.elite ? virtual / VIRTUAL_MAX : progressToNext(stat.xp, virtual, VIRTUAL_MAX)
        // Bar: overall progress toward 120, only meaningful once the real scale is done.
        const toMax = stat && !skill.elite ? progressToVirtualMax(stat.xp) : 0
        return (
          <div
            key={skill.id}
            style={{ animationDelay: `${i * 18}ms` }}
            title={stat ? `${skill.name}: ${formatXp(stat.xp)} xp${hasVirtual ? ` · virtual level ${virtual}` : ''}${stat.rank ? ` · rank ${stat.rank.toLocaleString('en-US')}` : ''}` : skill.name}
            className={cn(
              'flex flex-col gap-1 overflow-hidden rounded-xl border p-2 animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-backwards duration-300',
              maxed
                ? 'border-amber-300/70 bg-gradient-to-b from-amber-50 to-amber-100/60'
                : mastered
                  ? 'border-amber-200 bg-amber-50/50'
                  : 'border-border bg-card',
            )}
          >
            <div className="flex items-center justify-between gap-1">
              <ProgressRing
                value={ring}
                size={30}
                stroke={3}
                trackClassName={mastered ? 'stroke-amber-200' : 'stroke-muted'}
                barClassName={maxed ? 'stroke-amber-500' : mastered ? 'stroke-amber-400' : 'stroke-primary'}
              >
                <Icon className={cn('h-3.5 w-3.5', maxed ? 'text-amber-600' : mastered ? 'text-amber-500' : 'text-muted-foreground')} />
              </ProgressRing>
              <div className={cn('text-xl font-bold leading-none tabular-nums', mastered && 'text-amber-700')}>{stat ? real : '—'}</div>
            </div>
            <div className="flex items-baseline justify-between gap-1 leading-none">
              <span className="truncate text-[10px] text-muted-foreground">{skill.name}</span>
              {hasVirtual && <span className="text-[10px] font-bold text-amber-600 tabular-nums">{virtual}</span>}
            </div>
            <div
              className={cn('h-1 w-full overflow-hidden rounded-full', mastered && !skill.elite ? 'bg-amber-200/70' : 'bg-transparent')}
              title={mastered && !skill.elite ? `${Math.round(toMax * 100)}% to level ${VIRTUAL_MAX}` : undefined}
            >
              {mastered && !skill.elite && (
                <div className="h-full rounded-full bg-amber-500 transition-[width] duration-700" style={{ width: `${toMax * 100}%` }} />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
