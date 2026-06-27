import { useState } from 'react'
import { Pencil, Trash2, CalendarArrowUp } from 'lucide-react'
import { cn, formatDate, isOverdue } from '../../utils'
import { Checkbox } from '../../components/ui/checkbox'
import { haptic } from '../../lib/haptics'
import { toggleGoogleTask } from './googleTasks'
import { postponeToTomorrow } from './postpone'
import type { Todo } from '../../supabase'

type Props = {
  task: Todo
  onEdit: () => void
  onDelete: () => void
  onChange: () => void
}

export default function GoogleTaskItem({ task, onEdit, onDelete, onChange }: Props) {
  const [pending, setPending] = useState(false)

  async function toggleComplete() {
    haptic(task.completed ? 'light' : 'success')
    setPending(true)
    await toggleGoogleTask(task)
    setPending(false)
    onChange()
  }

  function handleDelete() {
    haptic('warning')
    onDelete()
  }

  async function handlePostpone() {
    haptic('light')
    setPending(true)
    await postponeToTomorrow(task)
    setPending(false)
    onChange()
  }

  const overdue = !task.completed && isOverdue(task.due_date)

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
          <p dir="auto" className={cn('font-medium truncate', task.completed && 'line-through text-muted-foreground')}>{task.title}</p>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 shrink-0">Google</span>
        </div>
        {task.due_date && (
          <p className={cn('text-xs text-muted-foreground mt-1', overdue && 'text-destructive')}>{formatDate(task.due_date)}</p>
        )}
        {task.notes && <p className="text-sm text-muted-foreground mt-1 truncate">{task.notes}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {overdue && (
          <button onClick={handlePostpone} disabled={pending} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground" title="Postpone to tomorrow">
            <CalendarArrowUp className="h-4 w-4" />
          </button>
        )}
        <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground">
          <Pencil className="h-4 w-4" />
        </button>
        <button onClick={handleDelete} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
