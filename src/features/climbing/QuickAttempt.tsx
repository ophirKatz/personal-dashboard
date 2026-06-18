import { QUICK_LOG_GRADES } from '../../utils'
import { haptic } from '../../lib/haptics'

type Props = {
  onAdd: (grade: string) => void
}

export default function QuickAttempt({ onAdd }: Props) {
  function handleAdd(grade: string) {
    haptic('selection')
    onAdd(grade)
  }

  return (
    <div className="bg-muted/50 rounded-2xl p-4 space-y-3">
      <p className="text-sm font-medium text-muted-foreground">Quick add attempt</p>
      <div className="grid grid-cols-3 gap-2">
        {QUICK_LOG_GRADES.map(grade => (
          <button
            key={grade}
            onClick={() => handleAdd(grade)}
            className="flex items-center justify-center h-14 rounded-xl bg-card border border-border font-semibold text-base active:scale-95 active:bg-accent transition-transform"
          >
            {grade}
          </button>
        ))}
      </div>
    </div>
  )
}
