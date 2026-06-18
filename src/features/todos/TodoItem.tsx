import { Pencil, Trash2, CalendarDays } from 'lucide-react'
import { supabase } from '../../supabase'
import type { Todo } from '../../supabase'
import { cn, PRIORITY_CONFIG, formatDate, formatTime } from '../../utils'
import { Checkbox } from '../../components/ui/checkbox'

type Props = {
  todo: Todo
  onEdit: () => void
  onDelete: () => void
  onChange: () => void
}

export default function TodoItem({ todo, onEdit, onDelete, onChange }: Props) {
  async function toggleComplete() {
    await supabase.from('todos').update({
      completed: !todo.completed,
      completed_at: todo.completed ? null : new Date().toISOString(),
    }).eq('id', todo.id)
    onChange()
  }

  const priority = PRIORITY_CONFIG[todo.priority]

  return (
    <div className={cn('flex items-start gap-3 p-4 bg-card border border-border rounded-xl transition-opacity', todo.completed && 'opacity-60')}>
      <Checkbox
        checked={todo.completed}
        onCheckedChange={toggleComplete}
        className="mt-0.5 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className={cn('font-medium', todo.completed && 'line-through text-muted-foreground')}>{todo.title}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', priority.className)}>
            {priority.label}
          </span>
          {todo.due_date && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              {formatDate(todo.due_date)}{todo.due_time && ` · ${formatTime(todo.due_time)}`}
            </span>
          )}
        </div>
        {todo.notes && <p className="text-sm text-muted-foreground mt-1 truncate">{todo.notes}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground">
          <Pencil className="h-4 w-4" />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
