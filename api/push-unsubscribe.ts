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

  const { endpoint } = req.body ?? {}
  if (typeof endpoint !== 'string') {
    res.status(400).json({ error: 'INVALID_BODY' })
    return
  }

  await auth.supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', auth.userId)
  res.status(200).json({ ok: true })
}
