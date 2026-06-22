import { supabase } from '../../supabase'

export type DriveFolder = {
  id: string
  folder_id: string
  folder_name: string
  created_at: string
  sync_status: 'idle' | 'syncing' | 'error'
  sync_error: string | null
  last_synced_at: string | null
}
export type DriveBrowseFolder = { id: string; name: string }

async function authHeaders(): Promise<Record<string, string> | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  return { Authorization: `Bearer ${session.access_token}` }
}

export async function browseDriveFolders(opts: { parentId?: string; q?: string } = {}): Promise<{ connected: boolean; folders: DriveBrowseFolder[] }> {
  const headers = await authHeaders()
  if (!headers) return { connected: false, folders: [] }

  const params = new URLSearchParams()
  if (opts.parentId) params.set('parentId', opts.parentId)
  if (opts.q) params.set('q', opts.q)

  const res = await fetch(`/api/google-drive-browse?${params}`, { headers })
  if (res.status === 404) return { connected: false, folders: [] }
  if (!res.ok) return { connected: false, folders: [] }

  const data = await res.json()
  return { connected: true, folders: data.folders ?? [] }
}

export async function fetchSelectedDriveFolders(): Promise<{ connected: boolean; folders: DriveFolder[] }> {
  const headers = await authHeaders()
  if (!headers) return { connected: false, folders: [] }

  const res = await fetch('/api/google-drive-folders', { headers })
  if (res.status === 404) return { connected: false, folders: [] }
  if (!res.ok) return { connected: false, folders: [] }

  const data = await res.json()
  return { connected: true, folders: data.folders ?? [] }
}

export async function addDriveFolder(folderId: string, folderName: string): Promise<boolean> {
  const headers = await authHeaders()
  if (!headers) return false

  const res = await fetch('/api/google-drive-folders', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder_id: folderId, folder_name: folderName }),
  })
  return res.ok
}

export async function removeDriveFolder(folderId: string): Promise<boolean> {
  const headers = await authHeaders()
  if (!headers) return false

  const res = await fetch('/api/google-drive-folders', {
    method: 'DELETE',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder_id: folderId }),
  })
  return res.ok
}

type SyncCursor = unknown

// Loops over /api/google-drive-sync, which only processes a bounded slice of the
// folder tree per call and returns a cursor to resume from, until the whole tree is synced.
export async function syncDriveFolder(
  folderId: string,
  onProgress?: (syncedSoFar: number) => void,
): Promise<{ ok: boolean; error?: string }> {
  const headers = await authHeaders()
  if (!headers) return { ok: false, error: 'NOT_CONNECTED' }

  let cursor: SyncCursor | undefined
  let total = 0

  for (;;) {
    const res = await fetch('/api/google-drive-sync', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_id: folderId, cursor }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { ok: false, error: data.error ?? 'SYNC_FAILED' }
    }

    const data = await res.json()
    total += data.syncedCount ?? 0
    onProgress?.(total)

    if (data.done) return { ok: true }
    cursor = data.cursor
  }
}
