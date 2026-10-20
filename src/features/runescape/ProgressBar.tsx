import { cn } from '../../utils'

export default function ProgressBar({ value, max, complete }: { value: number; max: number; complete: boolean }) {
  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
      <div className={cn('h-full rounded-full transition-all', complete ? 'bg-emerald-500' : 'bg-primary')} style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
    </div>
  )
}
