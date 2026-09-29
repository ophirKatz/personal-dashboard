import { Button } from '../../components/ui/button'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select'
import { Label } from '../../components/ui/label'

export type ReadFilter = 'all' | 'unread' | 'read'

type Props = {
  open: boolean
  onClose: () => void
  readFilter: ReadFilter
  onReadFilterChange: (v: ReadFilter) => void
  author: string
  onAuthorChange: (v: string) => void
  authors: string[]
  counts: Record<ReadFilter, number>
  resultCount: number
  onClear: () => void
}

export default function FiltersDrawer({
  open, onClose, readFilter, onReadFilterChange, author, onAuthorChange, authors, counts, resultCount, onClear,
}: Props) {
  const active = readFilter !== 'all' || author !== 'all'
  return (
    <Drawer open={open} onOpenChange={v => !v && onClose()}>
      <DrawerContent>
        <DrawerHeader><DrawerTitle>Filters</DrawerTitle></DrawerHeader>
        <DrawerBody className="space-y-5">
          <div className="space-y-2">
            <Label>Status</Label>
            <Tabs value={readFilter} onValueChange={v => onReadFilterChange(v as ReadFilter)}>
              <TabsList className="w-full">
                <TabsTrigger value="all" className="flex-1">All ({counts.all})</TabsTrigger>
                <TabsTrigger value="unread" className="flex-1">To read ({counts.unread})</TabsTrigger>
                <TabsTrigger value="read" className="flex-1">Read ({counts.read})</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="space-y-2">
            <Label>Author</Label>
            <Select value={author} onValueChange={onAuthorChange}>
              <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="All authors" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All authors</SelectItem>
                {authors.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" disabled={!active} onClick={onClear} className="h-12 rounded-xl">Clear</Button>
            <Button onClick={onClose} className="h-12 flex-1 rounded-xl text-base font-semibold">
              Show {resultCount} book{resultCount === 1 ? '' : 's'}
            </Button>
          </div>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
