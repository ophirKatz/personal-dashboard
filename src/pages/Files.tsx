import { useEffect, useState, useRef, lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Download, Trash2, Folder as FolderIcon, FolderPlus, Upload, X, Pencil, Search, Link2, RefreshCw, MoreVertical, Star } from 'lucide-react'
import { supabase } from '../supabase'
import type { FileRecord } from '../supabase'
import type { User } from '@supabase/supabase-js'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../components/ui/dialog'
import { formatFileSize, fileIcon, isViewable } from '../utils'
import { format, formatDistanceToNow } from 'date-fns'
import { connectGoogle } from '../lib/googleAuth'
import { DriveFolderPicker } from '../features/drive/DriveFolderPicker'
import { fetchSelectedDriveFolders, addDriveFolder, removeDriveFolder, syncDriveFolder } from '../features/drive/googleDrive'
import type { DriveFolder } from '../features/drive/googleDrive'
import StarredFilesGrid from '../features/files/StarredFilesGrid'

const FileViewer = lazy(() => import('../components/FileViewer').then(m => ({ default: m.FileViewer })))

type SelectedFolder =
  | { source: 'local'; name: string }
  | { source: 'google'; folderId: string }

function splitPath(path: string): string[] {
  return path ? path.split('/') : []
}

export default function Files() {
  const [user, setUser] = useState<User | null>(null)
  const [files, setFiles] = useState<FileRecord[]>([])
  const [googleConnected, setGoogleConnected] = useState(true)
  const [googleFolders, setGoogleFolders] = useState<DriveFolder[]>([])
  const [selected, setSelected] = useState<SelectedFolder | null>(null)
  const [driveSubPath, setDriveSubPath] = useState('')
  const [syncingFolderIds, setSyncingFolderIds] = useState<Set<string>>(new Set())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [newFolderOpen, setNewFolderOpen] = useState(false)
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

  const folders = [...new Set(files.filter(f => f.source === 'local').map(f => f.folder))].sort()
  const query = search.trim().toLowerCase()
  const searchResults = query ? files.filter(f => f.name.toLowerCase().includes(query)) : []

  async function triggerSync(folderId: string) {
    setSyncingFolderIds(prev => new Set(prev).add(folderId))
    await syncDriveFolder(folderId, () => load())
    setSyncingFolderIds(prev => {
      const next = new Set(prev)
      next.delete(folderId)
      return next
    })
    load()
  }

  function openGoogleFolder(folder: DriveFolder) {
    setDriveSubPath('')
    setSelected({ source: 'google', folderId: folder.folder_id })
  }

  async function handleSelectDriveFolder(folderId: string, folderName: string) {
    const ok = await addDriveFolder(folderId, folderName)
    setPickerOpen(false)
    if (ok) {
      load()
      triggerSync(folderId)
    }
  }

  async function handleRemoveDriveFolder(folder: DriveFolder) {
    if (!confirm(`Stop syncing "${folder.folder_name}"?`)) return
    await removeDriveFolder(folder.folder_id)
    setSelected(null)
    setDriveSubPath('')
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

  async function toggleStar(file: FileRecord) {
    await supabase.from('files').update({ is_starred: !file.is_starred }).eq('id', file.id)
    load()
  }

  async function createFolder(e: React.FormEvent) {
    e.preventDefault()
    if (!newFolder.trim()) return
    setSelected({ source: 'local', name: newFolder.trim() })
    setNewFolder('')
    setNewFolderOpen(false)
  }

  const MENU_WIDTH = 144 // w-36

  function FileActionsMenu({ file }: { file: FileRecord }) {
    const [open, setOpen] = useState(false)
    const [coords, setCoords] = useState({ top: 0, left: 0 })
    const buttonRef = useRef<HTMLButtonElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)

    function openMenu(e: React.MouseEvent) {
      e.stopPropagation()
      const rect = buttonRef.current?.getBoundingClientRect()
      if (rect) setCoords({ top: rect.bottom + 4, left: Math.max(8, rect.right - MENU_WIDTH) })
      setOpen(o => !o)
    }

    useEffect(() => {
      if (!open) return
      function handleClick(e: MouseEvent) {
        if (
          menuRef.current && !menuRef.current.contains(e.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(e.target as Node)
        ) setOpen(false)
      }
      function handleScrollOrResize() { setOpen(false) }
      document.addEventListener('mousedown', handleClick)
      window.addEventListener('scroll', handleScrollOrResize, true)
      window.addEventListener('resize', handleScrollOrResize)
      return () => {
        document.removeEventListener('mousedown', handleClick)
        window.removeEventListener('scroll', handleScrollOrResize, true)
        window.removeEventListener('resize', handleScrollOrResize)
      }
    }, [open])

    return (
      <>
        <button
          ref={buttonRef}
          onClick={openMenu}
          className="p-2 rounded-lg hover:bg-accent text-muted-foreground"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {open && createPortal(
          <>
            <div className="fixed inset-0 z-40 bg-black/10" onClick={() => setOpen(false)} />
            <div
              ref={menuRef}
              style={{ position: 'fixed', top: coords.top, left: coords.left }}
              className="z-50 w-36 rounded-lg border border-border bg-popover shadow-md py-1"
            >
              <button
                onClick={e => { e.stopPropagation(); setOpen(false); toggleStar(file) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
              >
                <Star className={`h-4 w-4 ${file.is_starred ? 'fill-current' : ''}`} /> {file.is_starred ? 'Unstar' : 'Star'}
              </button>
              <button
                onClick={e => { e.stopPropagation(); setOpen(false); renameFile(file) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
              >
                <Pencil className="h-4 w-4" /> Rename
              </button>
              <button
                onClick={e => { e.stopPropagation(); setOpen(false); downloadFile(file) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
              >
                <Download className="h-4 w-4" /> Download
              </button>
              <button
                onClick={e => { e.stopPropagation(); setOpen(false); deleteFile(file) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-destructive text-left"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            </div>
          </>,
          document.body,
        )}
      </>
    )
  }

  function FileRow({ file, showFolder, hidePath }: { file: FileRecord; showFolder?: boolean; hidePath?: boolean }) {
    const viewable = isViewable(file.mime_type)
    return (
      <div
        onClick={() => viewable && setViewingFile(file)}
        className={`flex items-center gap-3 p-4 bg-card border border-border rounded-xl ${viewable ? 'cursor-pointer hover:bg-accent' : ''}`}
      >
        <span className="text-2xl">{fileIcon(file.mime_type)}</span>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{file.name}</p>
          {!hidePath && file.relative_path && <p className="text-xs text-muted-foreground truncate">{file.relative_path}</p>}
          <p className="text-xs text-muted-foreground mt-0.5">
            {showFolder && <>{file.folder} · </>}
            {formatFileSize(file.size_bytes)} · {format(new Date(file.created_at), 'MMM d, yyyy')}
          </p>
        </div>
        <FileActionsMenu file={file} />
      </div>
    )
  }

  const currentFiles = selected?.source === 'local' ? files.filter(f => f.source === 'local' && f.folder === selected.name) : []
  const selectedGoogleFolder = selected?.source === 'google' ? googleFolders.find(f => f.folder_id === selected.folderId) : undefined
  const currentDriveFiles = selectedGoogleFolder
    ? files.filter(f => f.source === 'google_drive' && f.root_folder_id === selectedGoogleFolder.folder_id)
    : []

  // Group files at the current drive sub-path into immediate subfolders vs. files in this directory.
  const drivePrefix = driveSubPath ? `${driveSubPath}/` : ''
  const driveSubfolderCounts = new Map<string, number>()
  const driveFilesHere: FileRecord[] = []
  for (const f of currentDriveFiles) {
    const rp = f.relative_path ?? ''
    if (rp === driveSubPath) {
      driveFilesHere.push(f)
    } else if (rp.startsWith(drivePrefix)) {
      const next = rp.slice(drivePrefix.length).split('/')[0]
      driveSubfolderCounts.set(next, (driveSubfolderCounts.get(next) ?? 0) + 1)
    }
  }
  const driveSubfolders = [...driveSubfolderCounts.entries()]
    .map(([name, count]) => ({ name, path: drivePrefix + name, count }))
    .sort((a, b) => a.name.localeCompare(b.name))

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

  if (selected?.source === 'google' && selectedGoogleFolder) {
    const folder = selectedGoogleFolder
    const syncing = folder.sync_status === 'syncing' || syncingFolderIds.has(folder.folder_id)
    const segments = splitPath(driveSubPath)
    const itemCount = driveSubfolders.length + driveFilesHere.length
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => { setSelected(null); setDriveSubPath('') }} className="p-2 rounded-lg hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setDriveSubPath('')}
                className={`text-2xl font-bold truncate hover:underline ${driveSubPath ? 'text-muted-foreground' : ''}`}
              >
                {folder.folder_name}
              </button>
              {segments.map((seg, i) => {
                const segPath = segments.slice(0, i + 1).join('/')
                const isLast = i === segments.length - 1
                return (
                  <span key={segPath} className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">/</span>
                    <button
                      onClick={() => setDriveSubPath(segPath)}
                      className={`text-2xl font-bold truncate hover:underline ${isLast ? '' : 'text-muted-foreground'}`}
                    >
                      {seg}
                    </button>
                  </span>
                )
              })}
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 shrink-0">Google</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {syncing
                ? 'Syncing…'
                : folder.sync_status === 'error'
                  ? `Sync failed: ${folder.sync_error ?? 'unknown error'}`
                  : `${itemCount} item${itemCount !== 1 ? 's' : ''}${folder.last_synced_at ? ` · synced ${formatDistanceToNow(new Date(folder.last_synced_at), { addSuffix: true })}` : ''}`}
            </p>
          </div>
          <button
            onClick={() => triggerSync(folder.folder_id)}
            disabled={syncing}
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground disabled:opacity-40"
          >
            <RefreshCw className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => handleRemoveDriveFolder(folder)}
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>

        {itemCount === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            {syncing ? (
              <div className="w-6 h-6 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <div className="text-4xl mb-3">📂</div>
                <p className="font-medium">No files in this folder</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {driveSubfolders.map(sf => (
              <button
                key={sf.path}
                onClick={() => setDriveSubPath(sf.path)}
                className="w-full flex items-center gap-3 p-4 bg-card border border-border rounded-xl hover:bg-accent transition-colors text-left"
              >
                <FolderIcon className="h-6 w-6 text-blue-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{sf.name}</p>
                  <p className="text-xs text-muted-foreground">{sf.count} file{sf.count !== 1 ? 's' : ''}</p>
                </div>
              </button>
            ))}
            {driveFilesHere.map(file => <FileRow key={file.id} file={file} hidePath />)}
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

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Files</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="rounded-xl"
            onClick={() => setNewFolderOpen(true)}
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
          {!loading && (googleConnected ? (
            <Button
              variant="outline"
              size="icon"
              className="rounded-xl"
              onClick={() => setPickerOpen(true)}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="outline"
              size="icon"
              className="rounded-xl"
              onClick={connectGoogle}
            >
              <Link2 className="h-4 w-4" />
            </Button>
          ))}
        </div>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search files by name…"
          className="pl-9"
        />
      </div>

      {!query && files.some(f => f.is_starred) && (
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-muted-foreground mb-2.5">Starred</h2>
          <StarredFilesGrid files={files} onSelect={setViewingFile} />
        </div>
      )}

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
                const count = files.filter(f => f.source === 'local' && f.folder === folder).length
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
              {googleFolders.map(gf => {
                const count = files.filter(f => f.source === 'google_drive' && f.root_folder_id === gf.folder_id).length
                const syncing = gf.sync_status === 'syncing' || syncingFolderIds.has(gf.folder_id)
                return (
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
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">Google</span>
                          {syncing ? (
                            <RefreshCw className="h-3 w-3 text-muted-foreground animate-spin" />
                          ) : gf.sync_status === 'error' ? (
                            <span className="text-[10px] text-destructive">sync failed</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">{count} file{count !== 1 ? 's' : ''}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  </div>
                )
              })}
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

      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New folder</DialogTitle></DialogHeader>
          <form onSubmit={createFolder}>
            <DialogBody>
              <Input
                value={newFolder}
                onChange={e => setNewFolder(e.target.value)}
                placeholder="Folder name…"
                autoFocus
              />
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewFolderOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={!newFolder.trim()}>
                <Plus className="h-4 w-4" />
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
