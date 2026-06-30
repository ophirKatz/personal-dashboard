import { format } from 'date-fns'
import { supabase } from '../../supabase'
import type { Todo } from '../../supabase'
import { tomorrow } from '../../utils'
import { updateGoogleTask } from './googleTasks'

function computeRemindAt(todo: Todo, dueDate: string, dueTime: string | null): string | null {
  return todo.remind_at && dueTime ? new Date(`${dueDate}T${dueTime}`).toISOString() : null
}

export async function postponeToTomorrow(todo: Todo): Promise<boolean> {
  const nextDue = tomorrow()

  if (todo.source === 'google') {
    return updateGoogleTask(todo, { title: todo.title, notes: todo.notes, due_date: nextDue })
  }

  const { error } = await supabase
    .from('todos')
    .update({ due_date: nextDue, remind_at: computeRemindAt(todo, nextDue, todo.due_time), notified_at: null })
    .eq('id', todo.id)
  return !error
}

export async function postponeToDateTime(todo: Todo, target: Date): Promise<boolean> {
  const nextDue = format(target, 'yyyy-MM-dd')
  const nextTime = format(target, 'HH:mm:ss')

  if (todo.source === 'google') {
    return updateGoogleTask(todo, { title: todo.title, notes: todo.notes, due_date: nextDue })
  }

  const { error } = await supabase
    .from('todos')
    .update({ due_date: nextDue, due_time: nextTime, remind_at: computeRemindAt(todo, nextDue, nextTime), notified_at: null })
    .eq('id', todo.id)
  return !error
}
