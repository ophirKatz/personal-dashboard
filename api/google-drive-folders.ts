import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateGoogleRequest } from './_googleAuth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await authenticateGoogleRequest(req)
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error })
    return
  }

  if (req.method === 'GET') {
    const { data, error } = await auth.supabase
      .from('google_drive_folders')
      .select('id, folder_id, folder_name, created_at')
      .order('created_at')

    if (error) {
      res.status(500).json({ error: 'DB_ERROR' })
      return
    }

    res.status(200).json({ folders: data ?? [] })
    return
  }

  if (req.method === 'POST') {
    const { folder_id, folder_name } = req.body ?? {}
    if (typeof folder_id !== 'string' || !folder_id || typeof folder_name !== 'string' || !folder_name) {
      res.status(400).json({ error: 'INVALID_BODY' })
      return
    }

    const { data, error } = await auth.supabase
      .from('google_drive_folders')
      .upsert({ user_id: auth.userId, folder_id, folder_name }, { onConflict: 'user_id,folder_id' })
      .select('id, folder_id, folder_name, created_at')
      .single()

    if (error) {
      res.status(500).json({ error: 'DB_ERROR' })
      return
    }

    res.status(200).json({ folder: data })
    return
  }

  if (req.method === 'DELETE') {
    const { folder_id } = req.body ?? {}
    if (typeof folder_id !== 'string' || !folder_id) {
      res.status(400).json({ error: 'INVALID_BODY' })
      return
    }

    const { error } = await auth.supabase
      .from('google_drive_folders')
      .delete()
      .eq('folder_id', folder_id)

    if (error) {
      res.status(500).json({ error: 'DB_ERROR' })
      return
    }

    res.status(200).json({ ok: true })
    return
  }

  res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
}
