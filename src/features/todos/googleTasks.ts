import { supabase } from '../../supabase'

export type GoogleTask = {
  id: string
  title: string
  notes: string | null
  due: string | null
  completed: boolean
}

export async function fetchGoogleTasks(): Promise<{ connected: boolean; tasks: GoogleTask[] }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { connected: false, tasks: [] }

  const res = await fetch('/api/google-tasks', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })

  if (!res.ok) return { connected: false, tasks: [] }

  const data = await res.json()
  return { connected: true, tasks: data.tasks ?? [] }
}

export async function toggleGoogleTask(taskId: string, completed: boolean): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return false

  const res = await fetch('/api/google-tasks', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ taskId, completed }),
  })

  return res.ok
}
