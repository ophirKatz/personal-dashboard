const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
const GOOGLE_APP_MIME_PREFIX = 'application/vnd.google-apps.'

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: { access_token?: string; error?: string }) => void
            error_callback?: (error: { message?: string }) => void
          }) => { requestAccessToken: () => void }
        }
      }
    }
  }
}

let gisScriptPromise: Promise<void> | null = null

function loadGisScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (!gisScriptPromise) {
    gisScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = GIS_SCRIPT_SRC
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load Google Identity Services script'))
      document.head.appendChild(script)
    })
  }
  return gisScriptPromise
}

export async function requestDriveAccessToken(clientId: string): Promise<string> {
  await loadGisScript()
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) reject(new Error(response.error || 'No access token returned'))
        else resolve(response.access_token)
      },
      error_callback: (error) => reject(new Error(error?.message || 'Google authorization failed or was cancelled')),
    })
    client.requestAccessToken()
  })
}

export function extractFolderId(input: string): string {
  const trimmed = input.trim()
  const urlMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  if (urlMatch) return urlMatch[1]
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed
  throw new Error('Could not find a folder ID in that link — paste the full Drive folder URL or its ID')
}

export type DriveFile = {
  id: string
  name: string
  mimeType: string
  size?: string
}

export type FlatDriveFile = {
  file: DriveFile
  pathPrefix: string
}

async function driveFetch(url: string, accessToken: string): Promise<Response> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Drive API error ${res.status}: ${body.slice(0, 200)}`)
  }
  return res
}

async function listFolderChildren(folderId: string, accessToken: string): Promise<DriveFile[]> {
  const children: DriveFile[] = []
  let pageToken: string | undefined
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, size)',
      pageSize: '1000',
    })
    if (pageToken) params.set('pageToken', pageToken)
    const res = await driveFetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, accessToken)
    const data = await res.json()
    children.push(...(data.files ?? []))
    pageToken = data.nextPageToken
  } while (pageToken)
  return children
}

export async function listFilesRecursive(folderId: string, accessToken: string, pathPrefix = ''): Promise<FlatDriveFile[]> {
  const children = await listFolderChildren(folderId, accessToken)
  const result: FlatDriveFile[] = []
  for (const child of children) {
    if (child.mimeType === FOLDER_MIME) {
      const nestedPrefix = pathPrefix ? `${pathPrefix}/${child.name}` : child.name
      result.push(...(await listFilesRecursive(child.id, accessToken, nestedPrefix)))
    } else {
      result.push({ file: child, pathPrefix })
    }
  }
  return result
}

export async function downloadFileBlob(file: DriveFile, accessToken: string): Promise<Blob> {
  if (file.mimeType.startsWith(GOOGLE_APP_MIME_PREFIX)) {
    const res = await driveFetch(
      `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=application/pdf`,
      accessToken,
    )
    return res.blob()
  }
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, accessToken)
  return res.blob()
}
