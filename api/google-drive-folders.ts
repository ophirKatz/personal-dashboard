import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateGoogleRequest } from './_googleAuth.js'

// A sync call only ever runs for ~8s before returning a cursor (or finishing),
// refreshing sync_heartbeat_at each time. If a folder is still "syncing" long
// after its last heartbeat, the client that was driving it (tab closed, crashed,
// lost connection) is gone for good — there's nothing left to finish the sync,
// so flip it to an error state and let the user retry.
const STALE_SYNC_MS = 2 * 60 * 1000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await authenticateGoogleRequest(req)
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error })
    return
  }

  if (req.method === 'GET') {
    const { data, error } = await auth.supabase
      .from('google_drive_folders')
      .select('id, folder_id, folder_name, created_at, sync_status, sync_error, last_synced_at, sync_heartbeat_at')
      .order('created_at')

    if (error) {
      res.status(500).json({ error: 'DB_ERROR' })
      return
    }

    const staleIds = (data ?? [])
      .filter(f => f.sync_status === 'syncing' && (!f.sync_heartbeat_at || Date.now() - new Date(f.sync_heartbeat_at).getTime() > STALE_SYNC_MS))
      .map(f => f.id)

    if (staleIds.length > 0) {
      await auth.supabase
        .from('google_drive_folders')
        .update({ sync_status: 'error', sync_error: 'SYNC_TIMEOUT' })
        .in('id', staleIds)
      for (const f of data ?? []) {
        if (staleIds.includes(f.id)) {
          f.sync_status = 'error'
          f.sync_error = 'SYNC_TIMEOUT'
        }
      }
    }

    res.status(200).json({ folders: (data ?? []).map(({ sync_heartbeat_at, ...f }) => f) })
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
      .select('id, folder_id, folder_name, created_at, sync_status, sync_error, last_synced_at')
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

    // Remove the downloaded copies from Storage before dropping the folder row
    // (the files table rows themselves cascade-delete via the FK).
    const { data: syncedFiles } = await auth.supabase
      .from('files')
      .select('storage_path')
      .eq('source', 'google_drive')
      .eq('root_folder_id', folder_id)

    if (syncedFiles && syncedFiles.length > 0) {
      await auth.supabase.storage.from('user-files').remove(syncedFiles.map(f => f.storage_path))
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
