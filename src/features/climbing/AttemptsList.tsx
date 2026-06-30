import { X } from 'lucide-react'

type Attempt = { grade: string; result: 'sent' | 'project' }

type Props = {
  attempts: Attempt[]
  onToggleResult: (index: number) => void
  onRemove: (index: number) => void
}

export default function AttemptsList({ attempts, onToggleResult, onRemove }: Props) {
  if (attempts.length === 0) return null
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{attempts.length} attempt{attempts.length !== 1 ? 's' : ''}</p>
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {attempts.map((a, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2 bg-card border border-border rounded-lg animate-in fade-in-0 slide-in-from-top-1 duration-200">
            <button
              onClick={() => onToggleResult(i)}
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${a.result === 'sent' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}
            >
              {a.result === 'sent' ? 'SENT' : 'PROJ'}
            </button>
            <span className="font-medium text-sm">{a.grade}</span>
            <button onClick={() => onRemove(i)} className="ml-auto text-muted-foreground hover:text-destructive">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
