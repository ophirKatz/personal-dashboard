import { useEffect, useState } from 'react'
import { Plus, Folder as FolderIcon, X, ExternalLink, Link2, Trash2 } from 'lucide-react'
import { Button } from '../components/ui/button'
import { format } from 'date-fns'
import { formatFileSize, fileIcon } from '../utils'
import { connectGoogle } from '../lib/googleAuth'
import { DriveFolderPicker } from '../features/drive/DriveFolderPicker'
import {
  fetchSelectedDriveFolders, addDriveFolder, removeDriveFolder, fetchDriveFolderFiles,
} from '../features/drive/googleDrive'
import type { DriveFolder, DriveFile } from '../features/drive/googleDrive'

export default function Drive() {
  const [connected, setConnected] = useState(true)
  const [folders, setFolders] = useState<DriveFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [openFolder, setOpenFolder] = useState<DriveFolder | null>(null)
  const [files, setFiles] = useState<DriveFile[]>([])
  const [filesLoading, setFilesLoading] = useState(false)

  async function load() {
    const res = await fetchSelectedDriveFolders()
    setConnected(res.connected)
    setFolders(res.folders)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function loadFiles(folder: DriveFolder) {
    setFilesLoading(true)
    const res = await fetchDriveFolderFiles(folder.folder_id)
    setFiles(res.files)
    setFilesLoading(false)
  }

  async function handleSelectFolder(folderId: string, folderName: string) {
    const ok = await addDriveFolder(folderId, folderName)
    setPickerOpen(false)
    if (ok) load()
  }

  async function handleRemoveFolder(folder: DriveFolder) {
    if (!confirm(`Stop syncing "${folder.folder_name}"?`)) return
    await removeDriveFolder(folder.folder_id)
    load()
  }

  if (openFolder) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setOpenFolder(null)} className="p-2 rounded-lg hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold truncate">{openFolder.folder_name}</h1>
            <p className="text-sm text-muted-foreground">{files.length} file{files.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {filesLoading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : files.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <div className="text-4xl mb-3">📂</div>
            <p className="font-medium">No files in this folder</p>
          </div>
        ) : (
          <div className="space-y-2">
            {files.map(file => (
              <div key={file.id} className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl">
                <span className="text-2xl">{fileIcon(file.mimeType)}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {file.sizeBytes != null && <>{formatFileSize(file.sizeBytes)} · </>}
                    {format(new Date(file.modifiedTime), 'MMM d, yyyy')}
                  </p>
                </div>
                {file.webViewLink && (
                  <a href={file.webViewLink} target="_blank" rel="noreferrer" className="p-2 rounded-lg hover:bg-accent text-muted-foreground">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Drive</h1>
        {connected && (
          <Button onClick={() => setPickerOpen(true)} size="icon" className="rounded-xl h-11 w-11">
            <Plus className="h-5 w-5" />
          </Button>
        )}
      </div>

      {!loading && !connected && (
        <button
          onClick={connectGoogle}
          className="w-full flex items-center justify-center gap-2 mb-6 p-3 rounded-xl border border-dashed border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
        >
          <Link2 className="h-4 w-4" />
          Connect Google Drive
        </button>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : connected && folders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-4xl mb-3">📁</div>
          <p className="font-medium">No folders synced yet</p>
          <p className="text-sm mt-1">Tap + to choose a Drive folder</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {folders.map(folder => (
            <div
              key={folder.id}
              className="relative flex flex-col items-start gap-2 p-4 bg-card border border-border rounded-xl hover:bg-accent transition-colors text-left"
            >
              <button
                onClick={() => handleRemoveFolder(folder)}
                className="absolute top-2 right-2 p-1 rounded-lg hover:bg-background text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => { setOpenFolder(folder); loadFiles(folder) }}
                className="flex flex-col items-start gap-2 w-full"
              >
                <FolderIcon className="h-8 w-8 text-amber-400" />
                <p className="font-medium text-sm truncate max-w-full pr-4">{folder.folder_name}</p>
              </button>
            </div>
          ))}
        </div>
      )}

      <DriveFolderPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={handleSelectFolder} />
    </div>
  )
}
