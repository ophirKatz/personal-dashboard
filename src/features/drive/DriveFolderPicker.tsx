import { useEffect, useState } from 'react'
import { ChevronRight, Folder as FolderIcon, Search } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { browseDriveFolders } from './googleDrive'
import type { DriveBrowseFolder } from './googleDrive'

type Crumb = { id: string; name: string }

const ROOT: Crumb = { id: 'root', name: 'My Drive' }

export function DriveFolderPicker({ open, onClose, onSelect }: {
  open: boolean
  onClose: () => void
  onSelect: (folderId: string, folderName: string) => void
}) {
  const [path, setPath] = useState<Crumb[]>([ROOT])
  const [folders, setFolders] = useState<DriveBrowseFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const current = path[path.length - 1]
  const query = search.trim()

  async function load() {
    setLoading(true)
    const res = query
      ? await browseDriveFolders({ q: query })
      : await browseDriveFolders({ parentId: current.id })
    setFolders(res.folders)
    setLoading(false)
  }

  useEffect(() => {
    if (open) load()
  }, [open, current.id, query])

  useEffect(() => {
    if (open) { setPath([ROOT]); setSearch('') }
  }, [open])

  function enterFolder(folder: DriveBrowseFolder) {
    setSearch('')
    setPath(prev => [...prev, { id: folder.id, name: folder.name }])
  }

  function goToCrumb(index: number) {
    setSearch('')
    setPath(prev => prev.slice(0, index + 1))
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Choose a Drive folder</DialogTitle></DialogHeader>
        <DialogBody className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search folders by name…"
              className="pl-9"
            />
          </div>

          {!query && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground overflow-x-auto whitespace-nowrap">
              {path.map((crumb, i) => (
                <span key={crumb.id} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                  <button
                    onClick={() => goToCrumb(i)}
                    disabled={i === path.length - 1}
                    className={i === path.length - 1 ? 'font-medium text-foreground' : 'hover:underline'}
                  >
                    {crumb.name}
                  </button>
                </span>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : folders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No folders found</p>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {folders.map(folder => (
                <div
                  key={folder.id}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent group"
                >
                  <button
                    onClick={() => enterFolder(folder)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    <FolderIcon className="h-5 w-5 text-amber-400 shrink-0" />
                    <span className="text-sm truncate">{folder.name}</span>
                  </button>
                  <Button size="sm" variant="outline" onClick={() => onSelect(folder.id, folder.name)}>
                    Select
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
