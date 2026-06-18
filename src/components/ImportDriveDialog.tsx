import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from './ui/dialog'
import { requestDriveAccessToken, extractFolderId, listFilesRecursive, downloadFileBlob } from '../lib/googleDrive'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
  onImported: () => void
}

type ItemStatus = 'pending' | 'uploading' | 'done' | 'error'
type Item = { name: string; status: ItemStatus; error?: string }

const CLIENT_ID = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID as string | undefined

export function ImportDriveDialog({ open, onOpenChange, user, onImported }: Props) {
  const [driveLink, setDriveLink] = useState('')
  const [destFolder, setDestFolder] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [phase, setPhase] = useState<'idle' | 'listing' | 'importing' | 'done'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function reset() {
    setDriveLink('')
    setDestFolder('')
    setItems([])
    setPhase('idle')
    setErrorMessage(null)
  }

  async function startImport(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !driveLink.trim() || !destFolder.trim()) return
    if (!CLIENT_ID) {
      setErrorMessage('Google Drive import is not configured (missing VITE_GOOGLE_DRIVE_CLIENT_ID).')
      return
    }

    setErrorMessage(null)
    try {
      setPhase('listing')
      const folderId = extractFolderId(driveLink)
      const accessToken = await requestDriveAccessToken(CLIENT_ID)
      const files = await listFilesRecursive(folderId, accessToken)

      if (files.length === 0) {
        setErrorMessage('No files found in that folder.')
        setPhase('idle')
        return
      }

      setItems(files.map(f => ({ name: f.pathPrefix ? `${f.pathPrefix}/${f.file.name}` : f.file.name, status: 'pending' })))
      setPhase('importing')

      for (let i = 0; i < files.length; i++) {
        const { file, pathPrefix } = files[i]
        setItems(prev => prev.map((it, idx) => (idx === i ? { ...it, status: 'uploading' } : it)))
        try {
          const blob = await downloadFileBlob(file, accessToken)
          const displayName = pathPrefix ? `${pathPrefix} - ${file.name}` : file.name
          const ext = displayName.includes('.') ? displayName.split('.').pop() : 'bin'
          const path = `${user.id}/${destFolder.trim()}/${Date.now()}-${i}.${ext}`
          const mimeType = blob.type || 'application/octet-stream'

          const { error: uploadError } = await supabase.storage.from('user-files').upload(path, blob, { contentType: mimeType })
          if (uploadError) throw uploadError

          const { error: insertError } = await supabase.from('files').insert({
            user_id: user.id,
            name: displayName,
            folder: destFolder.trim(),
            storage_path: path,
            size_bytes: blob.size,
            mime_type: mimeType,
          })
          if (insertError) throw insertError

          setItems(prev => prev.map((it, idx) => (idx === i ? { ...it, status: 'done' } : it)))
        } catch (err) {
          setItems(prev => prev.map((it, idx) => (idx === i ? { ...it, status: 'error', error: (err as Error).message } : it)))
        }
      }

      setPhase('done')
      onImported()
    } catch (err) {
      setErrorMessage((err as Error).message)
      setPhase('idle')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import from Google Drive</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {errorMessage && (
            <div className="px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm">{errorMessage}</div>
          )}

          {phase === 'idle' && (
            <form onSubmit={startImport} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="drive-link">Google Drive folder link</Label>
                <Input
                  id="drive-link"
                  value={driveLink}
                  onChange={e => setDriveLink(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dest-folder">Import into folder named</Label>
                <Input
                  id="dest-folder"
                  value={destFolder}
                  onChange={e => setDestFolder(e.target.value)}
                  placeholder="e.g. id documents"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Subfolders are imported too — their files are flattened into the folder above, with the subfolder name prefixed to the filename.
              </p>
              <DialogFooter>
                <Button type="submit">Connect & Import</Button>
              </DialogFooter>
            </form>
          )}

          {phase === 'listing' && <p className="text-sm text-muted-foreground">Listing files in Drive…</p>}

          {(phase === 'importing' || phase === 'done') && (
            <div className="space-y-3">
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate flex-1" title={item.error}>{item.name}</span>
                    <span
                      className={
                        item.status === 'done'
                          ? 'text-green-600'
                          : item.status === 'error'
                            ? 'text-destructive'
                            : item.status === 'uploading'
                              ? 'text-amber-600'
                              : 'text-muted-foreground'
                      }
                    >
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
              {phase === 'done' && (
                <DialogFooter>
                  <Button onClick={() => { onOpenChange(false); reset() }}>Done</Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
