import { supabase } from '../../supabase'
import type { Todo } from '../../supabase'

export async function refreshGoogleTasks(): Promise<void> {
  await supabase.functions.invoke('fetch-google-tasks')
}

export async function toggleGoogleTask(todo: Todo): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session || !todo.google_task_id) return false

  const completed = !todo.completed
  const res = await fetch('/api/google-tasks', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ taskId: todo.google_task_id, completed }),
  })

  if (!res.ok) return false

  await supabase
    .from('todos')
    .update({ completed, completed_at: completed ? new Date().toISOString() : null })
    .eq('id', todo.id)

  return true
}
