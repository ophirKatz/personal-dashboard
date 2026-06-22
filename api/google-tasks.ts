import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { SupabaseClient } from '@supabase/supabase-js'
import { authenticateGoogleRequest } from './_googleAuth.js'

type GoogleTaskItem = {
  id: string
  title?: string
  notes?: string
  due?: string
  status?: string
  completed?: string
  hidden?: boolean
  deleted?: boolean
}

type SyncedTask = {
  id: string
  title: string
  notes: string | null
  due: string | null
  completed: boolean
  completedAt: string | null
}

const TASKS_BASE = 'https://tasks.googleapis.com/tasks/v1/lists/@default/tasks'

async function syncGoogleTasksToDb(supabase: SupabaseClient, userId: string, tasks: SyncedTask[]) {
  const { data: existingRows } = await supabase
    .from('todos')
    .select('google_task_id, due_date, notified_at')
    .eq('user_id', userId)
    .eq('source', 'google')

  const existingByGoogleId = new Map((existingRows ?? []).map(r => [r.google_task_id as string, r]))

  const rows = tasks.map(task => {
    const existing = existingByGoogleId.get(task.id)
    const notifiedAt = existing && existing.due_date === task.due ? existing.notified_at : null
    return {
      user_id: userId,
      title: task.title,
      notes: task.notes,
      due_date: task.due,
      completed: task.completed,
      completed_at: task.completedAt,
      source: 'google',
      google_task_id: task.id,
      notified_at: notifiedAt,
    }
  })

  if (rows.length > 0) {
    await supabase.from('todos').upsert(rows, { onConflict: 'user_id,google_task_id' })
  }

  const currentIds = new Set(tasks.map(t => t.id))
  const staleIds = [...existingByGoogleId.keys()].filter(id => !currentIds.has(id))
  if (staleIds.length > 0) {
    await supabase.from('todos').delete().eq('user_id', userId).eq('source', 'google').in('google_task_id', staleIds)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await authenticateGoogleRequest(req)
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error })
    return
  }

  if (req.method === 'GET') {
    const params = new URLSearchParams({ showCompleted: 'true', showHidden: 'true', maxResults: '100' })
    let tasksRes: Response
    try {
      tasksRes = await fetch(`${TASKS_BASE}?${params}`, {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      })
    } catch {
      res.status(502).json({ error: 'UPSTREAM_ERROR' })
      return
    }

    if (tasksRes.status === 403) {
      res.status(403).json({ error: 'INSUFFICIENT_SCOPE' })
      return
    }
    if (!tasksRes.ok) {
      res.status(502).json({ error: 'UPSTREAM_ERROR' })
      return
    }

    const data: { items?: GoogleTaskItem[] } = await tasksRes.json()
    const tasks: SyncedTask[] = (data.items ?? [])
      .filter(t => !t.deleted && !t.hidden)
      .map(t => ({
        id: t.id,
        title: t.title ?? '(No title)',
        notes: t.notes ?? null,
        due: t.due ? t.due.slice(0, 10) : null,
        completed: t.status === 'completed',
        completedAt: t.completed ?? null,
      }))

    try {
      await syncGoogleTasksToDb(auth.supabase, auth.userId, tasks)
    } catch {
      // best-effort persistence; the live fetch above still serves the response either way
    }

    res.status(200).json({ tasks })
    return
  }

  if (req.method === 'PATCH') {
    const { taskId, completed } = req.body ?? {}
    if (typeof taskId !== 'string' || typeof completed !== 'boolean') {
      res.status(400).json({ error: 'INVALID_BODY' })
      return
    }

    let patchRes: Response
    try {
      patchRes = await fetch(`${TASKS_BASE}/${encodeURIComponent(taskId)}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: completed ? 'completed' : 'needsAction',
          completed: completed ? new Date().toISOString() : null,
        }),
      })
    } catch {
      res.status(502).json({ error: 'UPSTREAM_ERROR' })
      return
    }

    if (patchRes.status === 403) {
      res.status(403).json({ error: 'INSUFFICIENT_SCOPE' })
      return
    }
    if (!patchRes.ok) {
      res.status(502).json({ error: 'UPSTREAM_ERROR' })
      return
    }

    res.status(200).json({ ok: true })
    return
  }

  res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
}
