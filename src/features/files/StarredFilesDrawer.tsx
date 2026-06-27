import { lazy, Suspense, useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import type { FileRecord } from '../../supabase'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
import StarredFilesGrid from './StarredFilesGrid'

const FileViewer = lazy(() => import('../../components/FileViewer').then(m => ({ default: m.FileViewer })))

type Props = {
  open: boolean
  onClose: () => void
}

export default function StarredFilesDrawer({ open, onClose }: Props) {
  const [files, setFiles] = useState<FileRecord[]>([])
  const [viewingFile, setViewingFile] = useState<FileRecord | null>(null)

  useEffect(() => {
    if (!open) return
    supabase.from('files').select('*').eq('is_starred', true).order('name').then(({ data }) => setFiles(data ?? []))
  }, [open])

  return (
    <>
      <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Starred files</DrawerTitle>
          </DrawerHeader>
          <DrawerBody>
            <StarredFilesGrid files={files} onSelect={setViewingFile} emptyMessage="No starred files yet" />
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {viewingFile && (
        <Suspense fallback={null}>
          <FileViewer file={viewingFile} onClose={() => setViewingFile(null)} />
        </Suspense>
      )}
    </>
  )
}
