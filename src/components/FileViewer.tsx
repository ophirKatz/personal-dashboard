import { useEffect, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { supabase } from '../supabase'
import type { FileRecord } from '../supabase'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from './ui/dialog'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const MIN_SCALE = 0.5
const MAX_SCALE = 3

export function FileViewer({ file, onClose }: { file: FileRecord | null; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    setUrl(null)
    setError(null)
    setNumPages(0)
    setScale(1)
    if (!file) return
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

  const isPdf = file?.mime_type === 'application/pdf'
  const zoomIn = () => setScale(s => Math.min(MAX_SCALE, +(s + 0.25).toFixed(2)))
  const zoomOut = () => setScale(s => Math.max(MIN_SCALE, +(s - 0.25).toFixed(2)))

  return (
    <Dialog open={!!file} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-3xl p-0 gap-0">
        <DialogHeader className="p-4 pb-3">
          <DialogTitle className="truncate pr-8">{file?.name}</DialogTitle>
        </DialogHeader>

        {url && !error && (
          <div className="flex items-center justify-center gap-3 px-4 py-2 border-y border-border">
            <button onClick={zoomOut} disabled={scale <= MIN_SCALE} className="p-2 rounded-lg hover:bg-accent disabled:opacity-40 text-muted-foreground">
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-sm text-muted-foreground w-12 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={zoomIn} disabled={scale >= MAX_SCALE} className="p-2 rounded-lg hover:bg-accent disabled:opacity-40 text-muted-foreground">
              <ZoomIn className="h-4 w-4" />
            </button>
            <button onClick={() => setScale(1)} disabled={scale === 1} className="p-2 rounded-lg hover:bg-accent disabled:opacity-40 text-muted-foreground">
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        )}

        <DialogBody className="p-4 flex justify-center items-start overflow-auto max-h-[70vh]">
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : !url ? (
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : isPdf ? (
            <Document
              file={url}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              onLoadError={e => setError(e.message)}
              loading={<div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
            >
              <div className="flex flex-col gap-3 items-center">
                {Array.from({ length: numPages }, (_, i) => (
                  <Page key={i} pageNumber={i + 1} scale={scale} renderTextLayer={false} renderAnnotationLayer={false} className="shadow rounded" />
                ))}
              </div>
            </Document>
          ) : (
            <img
              src={url}
              alt={file?.name}
              style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
              className="max-w-full max-h-[60vh] rounded-lg object-contain"
            />
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
