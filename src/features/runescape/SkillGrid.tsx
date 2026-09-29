import { cn } from '../../utils'
import type { CharacterStats } from './api'
import { SKILLS, formatXp, progressToNext } from './skills'
import ProgressRing from './ProgressRing'

export default function SkillGrid({ stats }: { stats: CharacterStats }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
      {SKILLS.map((skill, i) => {
        const stat = stats.skills.get(skill.id)
        const level = stat?.level ?? 1
        const mastered = level >= 99
        const maxed = level >= skill.maxLevel
        const Icon = skill.icon
        const progress = !stat ? 0 : skill.elite ? level / skill.maxLevel : progressToNext(stat.xp, level, skill.maxLevel)
        return (
          <div
            key={skill.id}
            style={{ animationDelay: `${i * 18}ms` }}
            title={stat ? `${skill.name}: ${formatXp(stat.xp)} xp${stat.rank ? ` · rank ${stat.rank.toLocaleString('en-US')}` : ''}` : skill.name}
            className={cn(
              'group relative flex flex-col items-center gap-1.5 rounded-2xl border p-3 animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-backwards duration-300',
              maxed
                ? 'border-amber-300/70 bg-gradient-to-b from-amber-50 to-amber-100/60'
                : mastered
                  ? 'border-amber-200 bg-amber-50/50'
                  : 'border-border bg-card',
            )}
          >
            <ProgressRing
              value={progress}
              size={56}
              stroke={4}
              trackClassName={maxed ? 'stroke-amber-200' : 'stroke-muted'}
              barClassName={maxed ? 'stroke-amber-500' : mastered ? 'stroke-amber-400' : 'stroke-primary'}
            >
              <Icon className={cn('h-5 w-5', maxed ? 'text-amber-600' : mastered ? 'text-amber-500' : 'text-muted-foreground')} />
            </ProgressRing>
            <div className="text-center leading-tight">
              <div className="text-[11px] text-muted-foreground truncate max-w-full">{skill.name}</div>
              <div className={cn('text-lg font-bold tabular-nums', maxed && 'text-amber-700')}>{stat ? level : '—'}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
