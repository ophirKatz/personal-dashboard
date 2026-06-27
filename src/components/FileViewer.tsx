import { useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { supabase } from '../supabase'
import type { FileRecord } from '../supabase'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from './ui/dialog'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
const BOX_PADDING = 32 // matches DialogBody's p-4 (16px each side)

export function FileViewer({ file, onClose }: { file: FileRecord | null; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [fitScale, setFitScale] = useState(1)
  const [fitReady, setFitReady] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const fittedRef = useRef(false)

  useEffect(() => {
    setUrl(null)
    setError(null)
    setNumPages(0)
    setZoom(1)
    setFitScale(1)
    setFitReady(false)
    fittedRef.current = false
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
  const renderScale = fitScale * zoom
  const zoomIn = () => setZoom(z => Math.min(MAX_ZOOM, +(z + 0.25).toFixed(2)))
  const zoomOut = () => setZoom(z => Math.max(MIN_ZOOM, +(z - 0.25).toFixed(2)))

  // Fit the first page's native size into the viewer box so the whole page is visible by default.
  function fitToBox(nativeWidth: number, nativeHeight: number) {
    if (fittedRef.current || !boxRef.current || !nativeWidth || !nativeHeight) return
    const availWidth = boxRef.current.clientWidth - BOX_PADDING
    const availHeight = boxRef.current.clientHeight - BOX_PADDING
    if (availWidth <= 0 || availHeight <= 0) return
    const fit = Math.min(availWidth / nativeWidth, availHeight / nativeHeight, 1)
    setFitScale(Math.max(+fit.toFixed(3), 0.1))
    fittedRef.current = true
    setFitReady(true)
  }

  return (
    <Dialog open={!!file} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-3xl p-0 gap-0">
        <DialogHeader className="p-4 pb-3">
          <DialogTitle className="truncate pr-8">{file?.name}</DialogTitle>
        </DialogHeader>

        {url && !error && (
          <div className="flex items-center justify-center gap-3 px-4 py-2 border-y border-border">
            <button onClick={zoomOut} disabled={zoom <= MIN_ZOOM} className="p-2 rounded-lg hover:bg-accent disabled:opacity-40 text-muted-foreground">
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-sm text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={zoomIn} disabled={zoom >= MAX_ZOOM} className="p-2 rounded-lg hover:bg-accent disabled:opacity-40 text-muted-foreground">
              <ZoomIn className="h-4 w-4" />
            </button>
            <button onClick={() => setZoom(1)} disabled={zoom === 1} className="p-2 rounded-lg hover:bg-accent disabled:opacity-40 text-muted-foreground">
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        )}

        <DialogBody ref={boxRef} className="p-4 flex justify-center items-start overflow-auto max-h-[70vh]">
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : !url ? (
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : isPdf ? (
            <div className="relative">
              {!fitReady && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <Document
                file={url}
                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                onLoadError={e => setError(e.message)}
                loading={<div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
              >
                <div className={`flex flex-col gap-3 items-center ${fitReady ? '' : 'opacity-0'}`}>
                  {Array.from({ length: numPages }, (_, i) => (
                    <Page
                      key={i}
                      pageNumber={i + 1}
                      scale={renderScale}
                      onLoadSuccess={i === 0 ? page => fitToBox(page.getViewport({ scale: 1 }).width, page.getViewport({ scale: 1 }).height) : undefined}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      className="shadow rounded"
                    />
                  ))}
                </div>
              </Document>
            </div>
          ) : (
            <img
              src={url}
              alt={file?.name}
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
              className="max-w-full max-h-[60vh] rounded-lg object-contain"
            />
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
