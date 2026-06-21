import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateGoogleRequest } from './_googleAuth.js'

type GoogleTaskItem = {
  id: string
  title?: string
  notes?: string
  due?: string
  status?: string
  hidden?: boolean
  deleted?: boolean
}

const TASKS_BASE = 'https://tasks.googleapis.com/tasks/v1/lists/@default/tasks'

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
    const tasks = (data.items ?? [])
      .filter(t => !t.deleted && !t.hidden)
      .map(t => ({
        id: t.id,
        title: t.title ?? '(No title)',
        notes: t.notes ?? null,
        due: t.due ? t.due.slice(0, 10) : null,
        completed: t.status === 'completed',
      }))

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
