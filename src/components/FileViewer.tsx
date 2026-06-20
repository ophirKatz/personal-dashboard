import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import type { FileRecord } from '../supabase'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from './ui/dialog'

export function isViewable(mimeType: string): boolean {
  return mimeType.startsWith('image/') || mimeType === 'application/pdf'
}

export function FileViewer({ file, onClose }: { file: FileRecord | null; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setUrl(null)
      setError(null)
      return
    }
    let cancelled = false
    supabase.storage.from('user-files').createSignedUrl(file.storage_path, 3600).then(({ data, error }) => {
      if (cancelled) return
      if (error || !data?.signedUrl) {
        setError(error?.message ?? 'Could not load file')
        return
      }
      setUrl(data.signedUrl)
    })
    return () => { cancelled = true }
  }, [file])

  return (
    <Dialog open={!!file} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{file?.name}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex justify-center items-center min-h-[60vh]">
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : !url ? (
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : file?.mime_type.startsWith('image/') ? (
            <img src={url} alt={file.name} className="max-w-full max-h-[75vh] rounded-lg object-contain" />
          ) : (
            <iframe src={url} title={file?.name} className="w-full h-[75vh] rounded-lg border border-border" />
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
