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
              'relative flex flex-col items-center gap-1.5 overflow-hidden rounded-2xl border p-3 animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-backwards duration-300',
              maxed
                ? 'border-amber-300/70 bg-gradient-to-b from-amber-50 to-amber-100/60'
                : mastered
                  ? 'border-amber-200 bg-amber-50/50'
                  : 'border-border bg-card',
            )}
          >
            {hasVirtual && (
              <span className="absolute right-1.5 top-1.5 rounded-full bg-amber-500 px-1.5 py-px text-[10px] font-bold leading-tight text-white tabular-nums">
                {virtual}
              </span>
            )}
            <ProgressRing
              value={ring}
              size={56}
              stroke={4}
              trackClassName={mastered ? 'stroke-amber-200' : 'stroke-muted'}
              barClassName={maxed ? 'stroke-amber-500' : mastered ? 'stroke-amber-400' : 'stroke-primary'}
            >
              <Icon className={cn('h-5 w-5', maxed ? 'text-amber-600' : mastered ? 'text-amber-500' : 'text-muted-foreground')} />
            </ProgressRing>
            <div className="text-center leading-tight">
              <div className="text-[11px] text-muted-foreground truncate max-w-full">{skill.name}</div>
              <div className={cn('text-lg font-bold tabular-nums', mastered && 'text-amber-700')}>{stat ? real : '—'}</div>
            </div>
            {mastered && !skill.elite && (
              <div className="h-1 w-full overflow-hidden rounded-full bg-amber-200/70" title={`${Math.round(toMax * 100)}% to level ${VIRTUAL_MAX}`}>
                <div className="h-full rounded-full bg-amber-500 transition-[width] duration-700" style={{ width: `${toMax * 100}%` }} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
