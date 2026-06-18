import { useEffect, useState, useRef } from 'react'
import { Plus, Download, Trash2, Folder as FolderIcon, File, Upload, X, FolderInput } from 'lucide-react'
import { supabase } from '../supabase'
import type { FileRecord } from '../supabase'
import type { User } from '@supabase/supabase-js'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { ImportDriveDialog } from '../components/ImportDriveDialog'
import { formatFileSize, fileIcon, today } from '../utils'
import { format } from 'date-fns'

export default function Files() {
  const [user, setUser] = useState<User | null>(null)
  const [files, setFiles] = useState<FileRecord[]>([])
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [newFolder, setNewFolder] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [importOpen, setImportOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  async function load() {
    const { data } = await supabase.from('files').select('*').order('created_at', { ascending: false })
    setFiles(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const folders = [...new Set(files.map(f => f.folder))].sort()

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || !user || !selectedFolder) return
    const file = e.target.files[0]
    setUploading(true)
    setUploadProgress(`Uploading ${file.name}…`)

    const ext = file.name.split('.').pop()
    const path = `${user.id}/${selectedFolder}/${Date.now()}.${ext}`

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
      folder: selectedFolder,
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

  async function createFolder(e: React.FormEvent) {
    e.preventDefault()
    if (!newFolder.trim()) return
    setSelectedFolder(newFolder.trim())
    setNewFolder('')
  }

  const currentFiles = selectedFolder ? files.filter(f => f.folder === selectedFolder) : []

  if (selectedFolder) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setSelectedFolder(null)} className="p-2 rounded-lg hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{selectedFolder}</h1>
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
            {currentFiles.map(file => (
              <div key={file.id} className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl">
                <span className="text-2xl">{fileIcon(file.mime_type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatFileSize(file.size_bytes)} · {format(new Date(file.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => downloadFile(file)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground">
                    <Download className="h-4 w-4" />
                  </button>
                  <button onClick={() => deleteFile(file)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
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
        <h1 className="text-2xl font-bold">Files</h1>
        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="gap-1.5">
          <FolderInput className="h-4 w-4" />
          Import from Drive
        </Button>
      </div>

      <form onSubmit={createFolder} className="flex gap-2 mb-5">
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

      <ImportDriveDialog open={importOpen} onOpenChange={setImportOpen} user={user} onImported={load} />

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : folders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-4xl mb-3">📁</div>
          <p className="font-medium">No folders yet</p>
          <p className="text-sm mt-1">Create a folder to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {folders.map(folder => {
            const count = files.filter(f => f.folder === folder).length
            return (
              <button
                key={folder}
                onClick={() => setSelectedFolder(folder)}
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
        </div>
      )}
    </div>
  )
}
