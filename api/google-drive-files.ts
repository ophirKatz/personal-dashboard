import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateGoogleRequest } from './_googleAuth'

type GoogleDriveFile = {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  webViewLink?: string
  iconLink?: string
  size?: string
}

const FOLDER_MIME = 'application/vnd.google-apps.folder'

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await authenticateGoogleRequest(req)
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error })
    return
  }

  const folderId = typeof req.query.folderId === 'string' ? req.query.folderId : ''
  if (!folderId) {
    res.status(400).json({ error: 'INVALID_QUERY' })
    return
  }

  // Only allow listing files for folders the user has explicitly added to their synced selection.
  const { data: folderRow } = await auth.supabase
    .from('google_drive_folders')
    .select('folder_id')
    .eq('folder_id', folderId)
    .maybeSingle()

  if (!folderRow) {
    res.status(404).json({ error: 'FOLDER_NOT_SELECTED' })
    return
  }

  const params = new URLSearchParams({
    q: `trashed=false and mimeType!='${FOLDER_MIME}' and '${escapeDriveQueryValue(folderId)}' in parents`,
    fields: 'files(id,name,mimeType,modifiedTime,webViewLink,iconLink,size)',
    orderBy: 'name',
    pageSize: '100',
  })

  let driveRes: Response
  try {
    driveRes = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })
  } catch {
    res.status(502).json({ error: 'UPSTREAM_ERROR' })
    return
  }

  if (driveRes.status === 403) {
    res.status(403).json({ error: 'INSUFFICIENT_SCOPE' })
    return
  }
  if (!driveRes.ok) {
    res.status(502).json({ error: 'UPSTREAM_ERROR' })
    return
  }

  const data: { files?: GoogleDriveFile[] } = await driveRes.json()
  const files = (data.files ?? []).map(f => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    modifiedTime: f.modifiedTime,
    webViewLink: f.webViewLink ?? null,
    iconLink: f.iconLink ?? null,
    sizeBytes: f.size ? Number(f.size) : null,
  }))

  res.status(200).json({ files })
}
