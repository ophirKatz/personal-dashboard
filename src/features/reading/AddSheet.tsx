import { Search, FolderPlus } from 'lucide-react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'

type Props = {
  open: boolean
  onClose: () => void
  onSearchBook: () => void
  onNewFolder: () => void
}

const OPTIONS = [
  { key: 'book', icon: Search, title: 'Search for a book', description: 'Find a book online and save it to your list.' },
  { key: 'folder', icon: FolderPlus, title: 'New folder', description: 'Organize your books. Folders can be nested.' },
] as const

export default function AddSheet({ open, onClose, onSearchBook, onNewFolder }: Props) {
  return (
    <Drawer open={open} onOpenChange={v => !v && onClose()}>
      <DrawerContent>
        <DrawerHeader><DrawerTitle>Add to reading list</DrawerTitle></DrawerHeader>
        <DrawerBody className="space-y-2">
          {OPTIONS.map(option => (
            <button
              key={option.key}
              onClick={() => { onClose(); option.key === 'book' ? onSearchBook() : onNewFolder() }}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card hover:bg-accent text-left transition-colors"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <option.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">{option.title}</p>
                <p className="text-sm text-muted-foreground">{option.description}</p>
              </div>
            </button>
          ))}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
