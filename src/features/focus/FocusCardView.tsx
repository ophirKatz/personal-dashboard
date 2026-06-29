import { CalendarDays, CheckSquare } from 'lucide-react'
import type { FocusCard } from '../../supabase'
import { formatDate, formatTime } from '../../utils'

const PRIORITY_DOT = {
  low: 'bg-blue-500',
  medium: 'bg-amber-500',
  high: 'bg-red-500',
} as const

export default function FocusCardView({ card }: { card: FocusCard }) {
  return (
    <div className="p-3 bg-card border border-border rounded-xl space-y-2">
      <div>
        <p className="text-sm font-medium">{card.label}</p>
        {card.insight && <p className="text-xs text-muted-foreground mt-0.5">{card.insight}</p>}
      </div>
      <div className="space-y-1.5">
        {card.items.map(item => (
          <div key={`${item.type}-${item.id}`} className="flex items-center gap-2">
            {item.type === 'todo' ? (
              <>
                <CheckSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {item.priority && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[item.priority]}`} />}
              </>
            ) : (
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            )}
            <span className="text-sm truncate flex-1">{item.title}</span>
            {(item.date || item.time) && (
              <span className="text-xs text-muted-foreground shrink-0">
                {item.date ? formatDate(item.date) : ''}
                {item.time ? `${item.date ? ' · ' : ''}${formatTime(item.time)}` : ''}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
