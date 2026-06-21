import { supabase } from '../../supabase'

export type DriveFolder = { id: string; folder_id: string; folder_name: string; created_at: string }
export type DriveBrowseFolder = { id: string; name: string }
export type DriveFile = {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  webViewLink: string | null
  iconLink: string | null
  sizeBytes: number | null
}

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

export async function fetchDriveFolderFiles(folderId: string): Promise<{ connected: boolean; files: DriveFile[] }> {
  const headers = await authHeaders()
  if (!headers) return { connected: false, files: [] }

  const res = await fetch(`/api/google-drive-files?folderId=${encodeURIComponent(folderId)}`, { headers })
  if (res.status === 404) return { connected: false, files: [] }
  if (!res.ok) return { connected: false, files: [] }

  const data = await res.json()
  return { connected: true, files: data.files ?? [] }
}
