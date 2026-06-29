import { useState } from 'react'
import { Pencil, Trash2, CalendarDays, CalendarArrowUp, Check, Bell, RefreshCw } from 'lucide-react'
import { supabase } from '../../supabase'
import type { Todo } from '../../supabase'
import { cn, formatDate, formatTime, advanceRecurrence, formatRecurrence, isOverdue } from '../../utils'
import { Checkbox } from '../../components/ui/checkbox'
import { Input } from '../../components/ui/input'
import { haptic } from '../../lib/haptics'
import { postponeToTomorrow } from './postpone'

type Props = {
  todo: Todo
  onEdit: () => void
  onDelete: () => void
  onChange: () => void
}

export default function TodoItem({ todo, onEdit, onDelete, onChange }: Props) {
  const [editingDate, setEditingDate] = useState(false)
  const [dueDate, setDueDate] = useState(todo.due_date ?? '')
  const [dueTime, setDueTime] = useState(todo.due_time ?? '')

  async function toggleComplete() {
    if (!todo.completed && todo.due_date && todo.recurrence_interval && todo.recurrence_unit) {
      haptic('success')
      const nextDue = advanceRecurrence(todo.due_date, todo.recurrence_interval, todo.recurrence_unit)
      const nextRemindAt = todo.remind_at && todo.due_time ? new Date(`${nextDue}T${todo.due_time}`).toISOString() : null
      await supabase.from('todos').update({
        due_date: nextDue,
        remind_at: nextRemindAt,
        notified_at: null,
      }).eq('id', todo.id)
      onChange()
      return
    }
    haptic(todo.completed ? 'light' : 'success')
    await supabase.from('todos').update({
      completed: !todo.completed,
      completed_at: todo.completed ? null : new Date().toISOString(),
    }).eq('id', todo.id)
    onChange()
  }

  function handleDateTimeChange(value: string) {
    const [nextDate, nextTime] = value ? value.split('T') : ['', '']
    saveDateTime(nextDate ?? '', nextTime ?? '')
  }

  async function saveDateTime(nextDate: string, nextTime: string) {
    setDueDate(nextDate)
    setDueTime(nextTime)
    const remindAt = nextDate && nextTime ? new Date(`${nextDate}T${nextTime}`).toISOString() : null
    await supabase.from('todos').update({
      due_date: nextDate || null,
      due_time: nextDate ? nextTime || null : null,
      reminder_enabled: !!remindAt,
      remind_at: remindAt,
      notified_at: remindAt === todo.remind_at ? todo.notified_at : null,
    }).eq('id', todo.id)
    onChange()
  }

  function handleDelete() {
    haptic('warning')
    onDelete()
  }

  async function handlePostpone() {
    haptic('light')
    await postponeToTomorrow(todo)
    onChange()
  }

  const overdue = !todo.completed && isOverdue(todo.due_date)

  return (
    <div className={cn('flex items-start gap-3 p-4 bg-card border border-border rounded-xl transition-opacity', todo.completed && 'opacity-60')}>
      <Checkbox
        checked={todo.completed}
        onCheckedChange={toggleComplete}
        className="mt-0.5 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p dir="auto" className={cn('font-medium', todo.completed && 'line-through text-muted-foreground')}>{todo.title}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {editingDate ? (
            <div className="flex items-center gap-1.5">
              <Input
                type="datetime-local"
                value={dueDate ? `${dueDate}T${dueTime || '00:00'}` : ''}
                onChange={e => handleDateTimeChange(e.target.value)}
                className="h-7 text-xs px-2 w-auto"
              />
              <button onClick={() => setEditingDate(false)} className="p-1 rounded-lg hover:bg-accent text-muted-foreground shrink-0">
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button onClick={() => setEditingDate(true)} className={cn('flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground', overdue && 'text-destructive')}>
              <CalendarDays className="h-3 w-3" />
              {todo.due_date ? `${formatDate(todo.due_date)}${todo.due_time ? ` · ${formatTime(todo.due_time)}` : ''}` : 'Add date'}
            </button>
          )}
          {todo.reminder_enabled && todo.due_date && (
            <Bell className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
          {todo.recurrence_interval && todo.recurrence_unit && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground shrink-0">
              <RefreshCw className="h-3 w-3" />
              {formatRecurrence(todo.recurrence_interval, todo.recurrence_unit)}
            </span>
          )}
        </div>
        {todo.notes && <p className="text-sm text-muted-foreground mt-1 truncate">{todo.notes}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {overdue && (
          <button onClick={handlePostpone} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground" title="Postpone to tomorrow">
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
