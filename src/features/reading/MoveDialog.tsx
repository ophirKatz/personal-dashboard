import { useMemo, useState } from 'react'
import { ChevronRight, Folder as FolderIcon, FolderPlus, Home } from 'lucide-react'
import type { ReadingFolder } from '../../supabase'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../../components/ui/dialog'
import { buildChildrenMap, getPath, type FolderId } from './folderTree'
import { cn } from '../../utils'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  confirmLabel?: string
  folders: ReadingFolder[]
  /** Where the item currently lives; "Move here" is disabled there. */
  currentFolderId: FolderId
  /** Folders that can't be picked or entered (the moved folder and its descendants). */
  disabledIds?: Set<string>
  /** Allow confirming the location the item is already in (used when saving a new book). */
  allowSameFolder?: boolean
  onConfirm: (targetId: FolderId) => void | Promise<void>
  /** Create a folder under `parentId`; resolves once the folder list has refreshed. */
  onCreateFolder: (parentId: FolderId, name: string) => Promise<void>
}

/** Google-Drive-style folder picker: drill into folders, create one in place, then confirm. */
export default function MoveDialog({
  open, onClose, title, confirmLabel = 'Move here', folders, currentFolderId,
  disabledIds, allowSameFolder, onConfirm, onCreateFolder,
}: Props) {
  const [browsingId, setBrowsingId] = useState<FolderId>(currentFolderId)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

  const children = useMemo(() => buildChildrenMap(folders), [folders])
  const path = useMemo(() => getPath(folders, browsingId), [folders, browsingId])
  const visible = (children.get(browsingId) ?? [])
  const insideDisabled = browsingId !== null && !!disabledIds?.has(browsingId)

  async function createFolder(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setBusy(true)
    await onCreateFolder(browsingId, newName.trim())
    setBusy(false)
    setNewName('')
    setCreating(false)
  }

  async function confirm() {
    setBusy(true)
    await onConfirm(browsingId)
    setBusy(false)
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader className="pr-12">
          <DialogTitle className="line-clamp-1">{title}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Location">
            <button
              onClick={() => setBrowsingId(null)}
              className={cn('flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-accent', path.length === 0 ? 'font-semibold' : 'text-muted-foreground')}
            >
              <Home className="h-3.5 w-3.5" /> Reading list
            </button>
            {path.map((f, i) => (
              <span key={f.id} className="flex items-center gap-1">
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                <button
                  onClick={() => setBrowsingId(f.id)}
                  className={cn('rounded-md px-1.5 py-1 hover:bg-accent', i === path.length - 1 ? 'font-semibold' : 'text-muted-foreground')}
                >
                  {f.name}
                </button>
              </span>
            ))}
          </nav>

          <div className="max-h-64 min-h-[8rem] overflow-y-auto rounded-xl border border-border divide-y divide-border">
            {visible.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">No folders here</p>
            )}
            {visible.map(f => {
              const disabled = disabledIds?.has(f.id)
              const hasChildren = (children.get(f.id) ?? []).length > 0
              return (
                <button
                  key={f.id}
                  disabled={disabled}
                  onClick={() => setBrowsingId(f.id)}
                  className="w-full flex items-center gap-3 p-3 text-left transition-colors hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <FolderIcon className="h-5 w-5 text-blue-400 shrink-0" />
                  <span className="flex-1 truncate">{f.name}</span>
                  {hasChildren && !disabled && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </button>
              )
            })}
          </div>

          {creating ? (
            <form onSubmit={createFolder} className="flex gap-2">
              <Input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="New folder name"
                className="h-10 rounded-xl"
              />
              <Button type="submit" disabled={busy || !newName.trim()} className="rounded-xl">Create</Button>
            </form>
          ) : (
            <button
              onClick={() => setCreating(true)}
              disabled={insideDisabled}
              className="flex items-center gap-2 text-sm font-medium text-primary disabled:opacity-40"
            >
              <FolderPlus className="h-4 w-4" /> New folder here
            </button>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button
            onClick={confirm}
            disabled={busy || insideDisabled || (!allowSameFolder && browsingId === currentFolderId)}
            className="rounded-xl"
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
