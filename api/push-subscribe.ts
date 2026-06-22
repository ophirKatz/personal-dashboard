import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateRequest } from './_supabaseAuth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
    return
  }

  const auth = await authenticateRequest(req)
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error })
    return
  }

  const { endpoint, p256dh, auth: authKey } = req.body ?? {}
  if (typeof endpoint !== 'string' || typeof p256dh !== 'string' || typeof authKey !== 'string') {
    res.status(400).json({ error: 'INVALID_BODY' })
    return
  }

  const { error } = await auth.supabase
    .from('push_subscriptions')
    .upsert({ user_id: auth.userId, endpoint, p256dh, auth: authKey }, { onConflict: 'endpoint' })

  if (error) {
    res.status(500).json({ error: 'DB_ERROR' })
    return
  }

  res.status(200).json({ ok: true })
}
