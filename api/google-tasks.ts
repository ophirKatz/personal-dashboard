import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateGoogleRequest } from './_googleAuth.js'

const TASKS_BASE = 'https://tasks.googleapis.com/tasks/v1/lists/@default/tasks'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await authenticateGoogleRequest(req)
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error })
    return
  }

  if (req.method === 'PATCH') {
    const { taskId, completed, title, notes, due } = req.body ?? {}
    if (typeof taskId !== 'string') {
      res.status(400).json({ error: 'INVALID_BODY' })
      return
    }

    const body: Record<string, unknown> = {}
    if (typeof completed === 'boolean') {
      body.status = completed ? 'completed' : 'needsAction'
      body.completed = completed ? new Date().toISOString() : null
    }
    if (typeof title === 'string') body.title = title
    if (notes !== undefined) body.notes = notes
    if (due !== undefined) body.due = due ? `${due}T00:00:00.000Z` : null

    if (Object.keys(body).length === 0) {
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
        body: JSON.stringify(body),
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

  if (req.method === 'DELETE') {
    const { taskId } = req.body ?? {}
    if (typeof taskId !== 'string') {
      res.status(400).json({ error: 'INVALID_BODY' })
      return
    }

    let deleteRes: Response
    try {
      deleteRes = await fetch(`${TASKS_BASE}/${encodeURIComponent(taskId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      })
    } catch {
      res.status(502).json({ error: 'UPSTREAM_ERROR' })
      return
    }

    if (deleteRes.status === 403) {
      res.status(403).json({ error: 'INSUFFICIENT_SCOPE' })
      return
    }
    if (!deleteRes.ok && deleteRes.status !== 404) {
      res.status(502).json({ error: 'UPSTREAM_ERROR' })
      return
    }

    res.status(200).json({ ok: true })
    return
  }

  res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
}
