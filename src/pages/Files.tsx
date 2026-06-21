import { useEffect, useState, useRef, lazy, Suspense } from 'react'
import { Plus, Download, Trash2, Folder as FolderIcon, Upload, X, Eye, Pencil, Search, Link2, ExternalLink } from 'lucide-react'
import { supabase } from '../supabase'
import type { FileRecord } from '../supabase'
import type { User } from '@supabase/supabase-js'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { formatFileSize, fileIcon, isViewable } from '../utils'
import { format } from 'date-fns'
import { connectGoogle } from '../lib/googleAuth'
import { DriveFolderPicker } from '../features/drive/DriveFolderPicker'
import { fetchSelectedDriveFolders, addDriveFolder, removeDriveFolder, fetchDriveFolderFiles } from '../features/drive/googleDrive'
import type { DriveFolder, DriveFile } from '../features/drive/googleDrive'

const FileViewer = lazy(() => import('../components/FileViewer').then(m => ({ default: m.FileViewer })))

type SelectedFolder =
  | { source: 'local'; name: string }
  | { source: 'google'; folder: DriveFolder }

export default function Files() {
  const [user, setUser] = useState<User | null>(null)
  const [files, setFiles] = useState<FileRecord[]>([])
  const [googleConnected, setGoogleConnected] = useState(true)
  const [googleFolders, setGoogleFolders] = useState<DriveFolder[]>([])
  const [selected, setSelected] = useState<SelectedFolder | null>(null)
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([])
  const [driveFilesLoading, setDriveFilesLoading] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [newFolder, setNewFolder] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewingFile, setViewingFile] = useState<FileRecord | null>(null)
  const [search, setSearch] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  async function load() {
    const [filesRes, driveRes] = await Promise.all([
      supabase.from('files').select('*').order('created_at', { ascending: false }),
      fetchSelectedDriveFolders(),
    ])
    setFiles(filesRes.data ?? [])
    setGoogleConnected(driveRes.connected)
    setGoogleFolders(driveRes.folders)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const folders = [...new Set(files.map(f => f.folder))].sort()
  const query = search.trim().toLowerCase()
  const searchResults = query ? files.filter(f => f.name.toLowerCase().includes(query)) : []

  async function loadDriveFiles(folder: DriveFolder) {
    setDriveFilesLoading(true)
    const res = await fetchDriveFolderFiles(folder.folder_id)
    setDriveFiles(res.files)
    setDriveFilesLoading(false)
  }

  function openGoogleFolder(folder: DriveFolder) {
    setSelected({ source: 'google', folder })
    loadDriveFiles(folder)
  }

  async function handleSelectDriveFolder(folderId: string, folderName: string) {
    const ok = await addDriveFolder(folderId, folderName)
    setPickerOpen(false)
    if (ok) load()
  }

  async function handleRemoveDriveFolder(folder: DriveFolder) {
    if (!confirm(`Stop syncing "${folder.folder_name}"?`)) return
    await removeDriveFolder(folder.folder_id)
    setSelected(null)
    load()
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || !user || selected?.source !== 'local') return
    const file = e.target.files[0]
    setUploading(true)
    setUploadProgress(`Uploading ${file.name}…`)

    const ext = file.name.split('.').pop()
    const path = `${user.id}/${selected.name}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('user-files')
      .upload(path, file)

    if (uploadError) {
      setUploadProgress(`Error: ${uploadError.message}`)
      setUploading(false)
      return
    }

    await supabase.from('files').insert({
      user_id: user.id,
      name: file.name,
      folder: selected.name,
      storage_path: path,
      size_bytes: file.size,
      mime_type: file.type || 'application/octet-stream',
    })

    setUploadProgress(null)
    setUploading(false)
    e.target.value = ''
    load()
  }

  async function downloadFile(file: FileRecord) {
    const { data } = await supabase.storage.from('user-files').createSignedUrl(file.storage_path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function deleteFile(file: FileRecord) {
    if (!confirm(`Delete "${file.name}"?`)) return
    await supabase.storage.from('user-files').remove([file.storage_path])
    await supabase.from('files').delete().eq('id', file.id)
    load()
  }

  async function renameFile(file: FileRecord) {
    const name = prompt('Rename file', file.name)?.trim()
    if (!name || name === file.name) return
    await supabase.from('files').update({ name }).eq('id', file.id)
    load()
  }

  async function createFolder(e: React.FormEvent) {
    e.preventDefault()
    if (!newFolder.trim()) return
    setSelected({ source: 'local', name: newFolder.trim() })
    setNewFolder('')
  }

  function FileRow({ file, showFolder }: { file: FileRecord; showFolder?: boolean }) {
    return (
      <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl">
        <span className="text-2xl">{fileIcon(file.mime_type)}</span>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{file.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {showFolder && <>{file.folder} · </>}
            {formatFileSize(file.size_bytes)} · {format(new Date(file.created_at), 'MMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {isViewable(file.mime_type) && (
            <button onClick={() => setViewingFile(file)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground">
              <Eye className="h-4 w-4" />
            </button>
          )}
          <button onClick={() => renameFile(file)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => downloadFile(file)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground">
            <Download className="h-4 w-4" />
          </button>
          <button onClick={() => deleteFile(file)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  function DriveFileRow({ file }: { file: DriveFile }) {
    return (
      <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl">
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
    )
  }

  const currentFiles = selected?.source === 'local' ? files.filter(f => f.folder === selected.name) : []

  if (selected?.source === 'local') {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{selected.name}</h1>
            <p className="text-sm text-muted-foreground">{currentFiles.length} file{currentFiles.length !== 1 ? 's' : ''}</p>
          </div>
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            size="icon"
            className="rounded-xl h-11 w-11"
          >
            <Upload className="h-5 w-5" />
          </Button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
        </div>

        {uploadProgress && (
          <div className="mb-4 px-4 py-3 bg-muted rounded-xl text-sm text-muted-foreground">
            {uploadProgress}
          </div>
        )}

        {currentFiles.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <div className="text-4xl mb-3">📂</div>
            <p className="font-medium">No files yet</p>
            <p className="text-sm mt-1">Tap the upload button to add files</p>
          </div>
        ) : (
          <div className="space-y-2">
            {currentFiles.map(file => <FileRow key={file.id} file={file} />)}
          </div>
        )}

        {viewingFile && (
          <Suspense fallback={null}>
            <FileViewer file={viewingFile} onClose={() => setViewingFile(null)} />
          </Suspense>
        )}
      </div>
    )
  }

  if (selected?.source === 'google') {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-2xl font-bold truncate">{selected.folder.folder_name}</h1>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 shrink-0">Google</span>
            </div>
            <p className="text-sm text-muted-foreground">{driveFiles.length} file{driveFiles.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => handleRemoveDriveFolder(selected.folder)}
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>

        {driveFilesLoading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : driveFiles.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <div className="text-4xl mb-3">📂</div>
            <p className="font-medium">No files in this folder</p>
          </div>
        ) : (
          <div className="space-y-2">
            {driveFiles.map(file => <DriveFileRow key={file.id} file={file} />)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Files</h1>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search files by name…"
          className="pl-9"
        />
      </div>

      {query ? (
        <div className="space-y-2">
          {searchResults.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <div className="text-4xl mb-3">🔍</div>
              <p className="font-medium">No files found</p>
              <p className="text-sm mt-1">Try a different search term</p>
            </div>
          ) : (
            searchResults.map(file => <FileRow key={file.id} file={file} showFolder />)
          )}
        </div>
      ) : (
        <>
          <form onSubmit={createFolder} className="flex gap-2 mb-3">
            <Input
              value={newFolder}
              onChange={e => setNewFolder(e.target.value)}
              placeholder="New folder name…"
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={!newFolder.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </form>

          {!loading && (googleConnected ? (
            <button
              onClick={() => setPickerOpen(true)}
              className="w-full flex items-center justify-center gap-2 mb-5 p-3 rounded-xl border border-dashed border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
            >
              <Plus className="h-4 w-4" />
              Sync a Google Drive folder
            </button>
          ) : (
            <button
              onClick={connectGoogle}
              className="w-full flex items-center justify-center gap-2 mb-5 p-3 rounded-xl border border-dashed border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
            >
              <Link2 className="h-4 w-4" />
              Connect Google Drive
            </button>
          ))}

          {loading ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : folders.length === 0 && googleFolders.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <div className="text-4xl mb-3">📁</div>
              <p className="font-medium">No folders yet</p>
              <p className="text-sm mt-1">Create a folder or sync one from Google Drive</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {folders.map(folder => {
                const count = files.filter(f => f.folder === folder).length
                return (
                  <button
                    key={`local-${folder}`}
                    onClick={() => setSelected({ source: 'local', name: folder })}
                    className="flex flex-col items-start gap-2 p-4 bg-card border border-border rounded-xl hover:bg-accent transition-colors text-left"
                  >
                    <FolderIcon className="h-8 w-8 text-amber-400" />
                    <div>
                      <p className="font-medium text-sm truncate max-w-full">{folder}</p>
                      <p className="text-xs text-muted-foreground">{count} file{count !== 1 ? 's' : ''}</p>
                    </div>
                  </button>
                )
              })}
              {googleFolders.map(gf => (
                <div
                  key={`google-${gf.id}`}
                  className="relative flex flex-col items-start gap-2 p-4 bg-card border border-border rounded-xl hover:bg-accent transition-colors text-left"
                >
                  <button
                    onClick={() => handleRemoveDriveFolder(gf)}
                    className="absolute top-2 right-2 p-1 rounded-lg hover:bg-background text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => openGoogleFolder(gf)} className="flex flex-col items-start gap-2 w-full pr-4">
                    <FolderIcon className="h-8 w-8 text-blue-400" />
                    <div>
                      <p className="font-medium text-sm truncate max-w-full">{gf.folder_name}</p>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">Google</span>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {viewingFile && (
        <Suspense fallback={null}>
          <FileViewer file={viewingFile} onClose={() => setViewingFile(null)} />
        </Suspense>
      )}

      <DriveFolderPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={handleSelectDriveFolder} />
    </div>
  )
}
