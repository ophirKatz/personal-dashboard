import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateGoogleRequest } from './_googleAuth.js'

type GoogleDriveFile = { id: string; name: string }

const FOLDER_MIME = 'application/vnd.google-apps.folder'

// Drive API query syntax: a literal single quote inside a string value must be backslash-escaped.
function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await authenticateGoogleRequest(req)
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error })
    return
  }

  const search = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const parentId = typeof req.query.parentId === 'string' && req.query.parentId ? req.query.parentId : 'root'

  const q = search
    ? `mimeType='${FOLDER_MIME}' and trashed=false and name contains '${escapeDriveQueryValue(search)}'`
    : `mimeType='${FOLDER_MIME}' and trashed=false and '${escapeDriveQueryValue(parentId)}' in parents`

  const params = new URLSearchParams({
    q,
    fields: 'files(id,name)',
    orderBy: 'name',
    pageSize: '100',
  })

  let driveRes: Response
  try {
    driveRes = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })
  } catch (err) {
    console.error('google-drive-browse: Drive API request failed for user', auth.userId, err)
    res.status(502).json({ error: 'UPSTREAM_ERROR' })
    return
  }

  if (driveRes.status === 403) {
    res.status(403).json({ error: 'INSUFFICIENT_SCOPE' })
    return
  }
  if (!driveRes.ok) {
    console.error('google-drive-browse: Drive API rejected request for user', auth.userId, driveRes.status, await driveRes.text())
    res.status(502).json({ error: 'UPSTREAM_ERROR' })
    return
  }

  const data: { files?: GoogleDriveFile[] } = await driveRes.json()
  res.status(200).json({ folders: data.files ?? [] })
}
