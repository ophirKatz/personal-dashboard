import { supabase } from '../../supabase'
import type { Todo } from '../../supabase'
import { tomorrow } from '../../utils'
import { updateGoogleTask } from './googleTasks'

export async function postponeToTomorrow(todo: Todo): Promise<boolean> {
  const nextDue = tomorrow()

  if (todo.source === 'google') {
    return updateGoogleTask(todo, { title: todo.title, notes: todo.notes, due_date: nextDue })
  }

  const nextRemindAt = todo.remind_at && todo.due_time ? new Date(`${nextDue}T${todo.due_time}`).toISOString() : null
  const { error } = await supabase
    .from('todos')
    .update({ due_date: nextDue, remind_at: nextRemindAt, notified_at: null })
    .eq('id', todo.id)
  return !error
}
