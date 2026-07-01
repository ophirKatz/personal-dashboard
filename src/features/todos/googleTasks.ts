import { supabase } from '../../supabase'
import type { Todo } from '../../supabase'
import { logFriendInteractionsForCompletedTask } from './friendInteractions'

export async function refreshGoogleTasks(): Promise<void> {
  await supabase.functions.invoke('fetch-google-tasks')
}

async function callGoogleTasksApi(method: 'PATCH' | 'DELETE', body: Record<string, unknown>): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return false

  const res = await fetch('/api/google-tasks', {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  return res.ok
}

export async function toggleGoogleTask(todo: Todo): Promise<boolean> {
  if (!todo.google_task_id) return false

  const completed = !todo.completed
  const ok = await callGoogleTasksApi('PATCH', { taskId: todo.google_task_id, completed })
  if (!ok) return false

  await supabase
    .from('todos')
    .update({ completed, completed_at: completed ? new Date().toISOString() : null })
    .eq('id', todo.id)

  if (completed) {
    logFriendInteractionsForCompletedTask(todo.id)
  }

  return true
}

export type GoogleTaskUpdate = {
  title: string
  notes: string | null
  due_date: string | null
}

export async function updateGoogleTask(todo: Todo, updates: GoogleTaskUpdate): Promise<boolean> {
  if (!todo.google_task_id) return false

  const ok = await callGoogleTasksApi('PATCH', {
    taskId: todo.google_task_id,
    title: updates.title,
    notes: updates.notes,
    due: updates.due_date,
  })
  if (!ok) return false

  await supabase
    .from('todos')
    .update({ title: updates.title, notes: updates.notes, due_date: updates.due_date })
    .eq('id', todo.id)

  return true
}

export async function deleteGoogleTask(todo: Todo): Promise<boolean> {
  if (!todo.google_task_id) return false

  const ok = await callGoogleTasksApi('DELETE', { taskId: todo.google_task_id })
  if (!ok) return false

  await supabase.from('todos').delete().eq('id', todo.id)
  return true
}
