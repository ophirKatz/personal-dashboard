import { useState } from 'react'
import { cn, formatDate } from '../../utils'
import { Checkbox } from '../../components/ui/checkbox'
import { haptic } from '../../lib/haptics'
import { toggleGoogleTask } from './googleTasks'
import type { GoogleTask } from './googleTasks'

type Props = {
  task: GoogleTask
  onChange: () => void
}

export default function GoogleTaskItem({ task, onChange }: Props) {
  const [pending, setPending] = useState(false)

  async function toggleComplete() {
    haptic(task.completed ? 'light' : 'success')
    setPending(true)
    await toggleGoogleTask(task.id, !task.completed)
    setPending(false)
    onChange()
  }

  return (
    <div className={cn('flex items-start gap-3 p-4 bg-card border border-border rounded-xl transition-opacity', (task.completed || pending) && 'opacity-60')}>
      <Checkbox
        checked={task.completed}
        onCheckedChange={toggleComplete}
        disabled={pending}
        className="mt-0.5 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={cn('font-medium truncate', task.completed && 'line-through text-muted-foreground')}>{task.title}</p>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 shrink-0">Google</span>
        </div>
        {task.due && (
          <p className="text-xs text-muted-foreground mt-1">{formatDate(task.due)}</p>
        )}
        {task.notes && <p className="text-sm text-muted-foreground mt-1 truncate">{task.notes}</p>}
      </div>
    </div>
  )
}
