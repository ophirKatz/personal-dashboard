import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { CLIMB_RESULT_BADGE, CLIMB_RESULT_LABEL, type ClimbResult } from './climbResult'

type Attempt = { grade: string; result: ClimbResult }

type Props = {
  attempts: Attempt[]
  onToggleResult: (index: number) => void
  onRemove: (index: number) => void
  // Reserve a fixed-height area (even when empty) so adding an attempt never
  // resizes a bottom-anchored sheet and shifts the controls above the list
  fixedHeight?: boolean
}

export default function AttemptsList({ attempts, onToggleResult, onRemove, fixedHeight = false }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevCount = useRef(attempts.length)

  // Keep the newest attempt in view once the list outgrows its fixed height
  useEffect(() => {
    const el = scrollRef.current
    if (el && attempts.length > prevCount.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
    prevCount.current = attempts.length
  }, [attempts.length])

  if (attempts.length === 0 && !fixedHeight) return null

  return (
    <div className={fixedHeight ? 'flex h-52 flex-col space-y-2' : 'space-y-2'}>
      <p className="text-sm font-medium">{attempts.length} attempt{attempts.length !== 1 ? 's' : ''}</p>
      {attempts.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
          Tap a grade to log an attempt
        </div>
      ) : (
        <div
          ref={scrollRef}
          className={`space-y-1.5 overflow-y-auto ${fixedHeight ? 'min-h-0 flex-1 overscroll-contain' : 'max-h-48'}`}
        >
          {attempts.map((a, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 bg-card border border-border rounded-lg animate-in fade-in-0 slide-in-from-top-1 duration-200">
              <button
                onClick={() => onToggleResult(i)}
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${CLIMB_RESULT_BADGE[a.result]}`}
              >
                {CLIMB_RESULT_LABEL[a.result]}
              </button>
              <span className="font-medium text-sm">{a.grade}</span>
              <button onClick={() => onRemove(i)} className="ml-auto text-muted-foreground hover:text-destructive">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
