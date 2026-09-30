import { Link } from 'react-router-dom'
import { CheckCircle2, ChevronRight, Dumbbell } from 'lucide-react'

export default function WorkoutWidget({ doneToday }: { doneToday: boolean }) {
  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Workout</span>
        <Link to="/workout" className="flex items-center gap-0.5 text-xs text-primary">
          {doneToday ? 'History' : 'Start'} <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      {doneToday ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-primary" /> Workout done today
        </div>
      ) : (
        <Link
          to="/workout"
          className="flex items-center gap-3 rounded-lg p-3 bg-primary/5 border border-primary/20 active:scale-[0.99] transition-transform"
        >
          <Dumbbell className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium flex-1">Time for your home workout</span>
          <ChevronRight className="h-4 w-4 text-primary shrink-0" />
        </Link>
      )}
    </div>
  )
}
