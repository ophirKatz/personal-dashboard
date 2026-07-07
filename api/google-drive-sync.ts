import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateGoogleRequest } from './_googleAuth.js'

const FOLDER_MIME = 'application/vnd.google-apps.folder'
const BUCKET = 'user-files'

// Each invocation only works for a bounded slice of time/files, then returns a
// cursor for the client to resume with — keeps every call well within a
// serverless function's execution time limit regardless of folder size.
const TIME_BUDGET_MS = 8_000
const MAX_FILES_PER_CALL = 20

const GOOGLE_EXPORT_MAP: Record<string, { mimeType: string; ext: string }> = {
  'application/vnd.google-apps.document': { mimeType: 'application/pdf', ext: 'pdf' },
  'application/vnd.google-apps.spreadsheet': { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' },
  'application/vnd.google-apps.presentation': { mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ext: 'pptx' },
  'application/vnd.google-apps.drawing': { mimeType: 'image/png', ext: 'png' },
}
const GOOGLE_APPS_SKIP = new Set([
  'application/vnd.google-apps.form',
  'application/vnd.google-apps.site',
  'application/vnd.google-apps.map',
  'application/vnd.google-apps.shortcut',
  'application/vnd.google-apps.script',
])

type DriveItem = { id: string; name: string; mimeType: string; modifiedTime: string }

type QueueItem =
  | { type: 'folder'; id: string; path: string }
  | { type: 'file'; id: string; name: string; mimeType: string; modifiedTime: string; path: string }

type SyncCursor = {
  queue: QueueItem[]
  visitedFolders: string[]
  seenDriveFileIds: string[]
  existing: Record<string, string | null>
}

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function ensureExtension(name: string, ext: string) {
  return name.toLowerCase().endsWith(`.${ext}`) ? name : `${name}.${ext}`
}

async function listDriveChildren(folderId: string, accessToken: string): Promise<DriveItem[]> {
  const results: DriveItem[] = []
  let pageToken: string | undefined
  do {
    const params = new URLSearchParams({
      q: `trashed=false and '${escapeDriveQueryValue(folderId)}' in parents`,
      fields: 'nextPageToken, files(id,name,mimeType,modifiedTime)',
      pageSize: '1000',
    })
    if (pageToken) params.set('pageToken', pageToken)

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) throw new Error('DRIVE_LIST_FAILED')

    const data: { files?: DriveItem[]; nextPageToken?: string } = await res.json()
    results.push(...(data.files ?? []))
    pageToken = data.nextPageToken
  } while (pageToken)
  return results
}

async function downloadDriveFile(item: { id: string; name: string; mimeType: string }, accessToken: string) {
  let url: string
  let contentType: string
  let finalName = item.name

  if (item.mimeType.startsWith('application/vnd.google-apps.')) {
    if (GOOGLE_APPS_SKIP.has(item.mimeType)) return null
    const exportTarget = GOOGLE_EXPORT_MAP[item.mimeType] ?? { mimeType: 'application/pdf', ext: 'pdf' }
    contentType = exportTarget.mimeType
    finalName = ensureExtension(item.name, exportTarget.ext)
    url = `https://www.googleapis.com/drive/v3/files/${item.id}/export?mimeType=${encodeURIComponent(exportTarget.mimeType)}`
  } else {
    contentType = item.mimeType
    url = `https://www.googleapis.com/drive/v3/files/${item.id}?alt=media`
  }

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error('DRIVE_DOWNLOAD_FAILED')

  const buffer = Buffer.from(await res.arrayBuffer())
  return { buffer, contentType, finalName }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
    return
  }

  const auth = await authenticateGoogleRequest(req)
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error })
    return
  }

  const { folder_id, cursor } = (req.body ?? {}) as { folder_id?: string; cursor?: SyncCursor }
  if (typeof folder_id !== 'string' || !folder_id) {
    res.status(400).json({ error: 'INVALID_BODY' })
    return
  }

  const { data: folderRow } = await auth.supabase
    .from('google_drive_folders')
    .select('folder_id, folder_name')
    .eq('folder_id', folder_id)
    .maybeSingle()

  if (!folderRow) {
    res.status(404).json({ error: 'FOLDER_NOT_SELECTED' })
    return
  }

  await auth.supabase
    .from('google_drive_folders')
    .update({ sync_status: 'syncing', sync_error: null, sync_heartbeat_at: new Date().toISOString() })
    .eq('folder_id', folder_id)

  let queue: QueueItem[]
  let visitedFolders: Set<string>
  let seenDriveFileIds: Set<string>
  let existing: Record<string, string | null>

  if (cursor) {
    queue = cursor.queue
    visitedFolders = new Set(cursor.visitedFolders)
    seenDriveFileIds = new Set(cursor.seenDriveFileIds)
    existing = cursor.existing
  } else {
    queue = [{ type: 'folder', id: folder_id, path: '' }]
    visitedFolders = new Set()
    seenDriveFileIds = new Set()
    const { data: existingRows } = await auth.supabase
      .from('files')
      .select('drive_file_id, drive_modified_time')
      .eq('source', 'google_drive')
      .eq('root_folder_id', folder_id)
    existing = {}
    for (const row of existingRows ?? []) {
      if (row.drive_file_id) existing[row.drive_file_id] = row.drive_modified_time
    }
  }

  const start = Date.now()
  let processed = 0
  let syncError: string | null = null

  try {
    while (queue.length > 0 && Date.now() - start < TIME_BUDGET_MS && processed < MAX_FILES_PER_CALL) {
      const item = queue.shift()!

      if (item.type === 'folder') {
        if (visitedFolders.has(item.id)) continue
        visitedFolders.add(item.id)

        const children = await listDriveChildren(item.id, auth.accessToken)
        for (const child of children) {
          const childPath = item.path ? `${item.path}/${child.name}` : child.name
          if (child.mimeType === FOLDER_MIME) {
            queue.push({ type: 'folder', id: child.id, path: childPath })
          } else {
            queue.push({ type: 'file', id: child.id, name: child.name, mimeType: child.mimeType, modifiedTime: child.modifiedTime, path: item.path })
          }
        }
        continue
      }

      // Unchanged since last sync — skip the download/upload round trip entirely.
      if (existing[item.id] === item.modifiedTime) {
        seenDriveFileIds.add(item.id)
        continue
      }

      try {
        const downloaded = await downloadDriveFile(item, auth.accessToken)
        if (downloaded) {
          const storagePath = `${auth.userId}/google-drive/${item.id}`
          const { error: uploadError } = await auth.supabase.storage
            .from(BUCKET)
            .upload(storagePath, downloaded.buffer, { contentType: downloaded.contentType, upsert: true })

          if (!uploadError) {
            await auth.supabase.from('files').upsert(
              {
                user_id: auth.userId,
                name: downloaded.finalName,
                folder: folderRow.folder_name,
                storage_path: storagePath,
                size_bytes: downloaded.buffer.byteLength,
                mime_type: downloaded.contentType,
                source: 'google_drive',
                root_folder_id: folder_id,
                drive_file_id: item.id,
                relative_path: item.path,
                drive_modified_time: item.modifiedTime,
              },
              { onConflict: 'user_id,drive_file_id' },
            )
          } else {
            console.error('drive-sync: storage upload failed', item.id, item.name, uploadError)
          }
        }
        seenDriveFileIds.add(item.id)
      } catch (err) {
        // Skip files that fail to download/upload (e.g. over the storage size limit)
        // rather than aborting the whole sync; they'll be retried on the next sync.
        console.error('drive-sync: failed on file', item.id, item.name, err)
      }
      processed++
    }
  } catch (err) {
    syncError = err instanceof Error ? err.message : 'SYNC_FAILED'
  }

  if (syncError) {
    await auth.supabase
      .from('google_drive_folders')
      .update({ sync_status: 'error', sync_error: syncError })
      .eq('folder_id', folder_id)
    res.status(502).json({ error: syncError })
    return
  }

  const done = queue.length === 0
  if (!done) {
    res.status(200).json({
      done: false,
      syncedCount: processed,
      cursor: {
        queue,
        visitedFolders: [...visitedFolders],
        seenDriveFileIds: [...seenDriveFileIds],
        existing,
      },
    })
    return
  }

  // Final pass: remove local copies of anything that's gone from Drive.
  const { data: allSyncedRows } = await auth.supabase
    .from('files')
    .select('id, storage_path, drive_file_id')
    .eq('source', 'google_drive')
    .eq('root_folder_id', folder_id)

  const stale = (allSyncedRows ?? []).filter(r => r.drive_file_id && !seenDriveFileIds.has(r.drive_file_id))
  if (stale.length > 0) {
    await auth.supabase.storage.from(BUCKET).remove(stale.map(r => r.storage_path))
    await auth.supabase.from('files').delete().in('id', stale.map(r => r.id))
  }

  await auth.supabase
    .from('google_drive_folders')
    .update({ sync_status: 'idle', sync_error: null, last_synced_at: new Date().toISOString() })
    .eq('folder_id', folder_id)

  res.status(200).json({ done: true, syncedCount: processed })
}
