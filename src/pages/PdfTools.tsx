import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Download, Loader2, Upload, X } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { cn } from '../utils'
import { PDF_TOOLS, MAX_FILE_BYTES, MAX_TOTAL_BYTES, type PdfToolDef } from '../features/pdf-tools/tools'
import { runPdfTool, type PdfToolOutput } from '../features/pdf-tools/runPdfTool'

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

export default function PdfTools() {
  const [tool, setTool] = useState<PdfToolDef>(PDF_TOOLS[0])
  const [files, setFiles] = useState<File[]>([])
  const [pages, setPages] = useState('')
  const [angle, setAngle] = useState(90)
  const [text, setText] = useState('CONFIDENTIAL')
  const [opacity, setOpacity] = useState(0.25)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PdfToolOutput | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!result) { setResultUrl(null); return }
    const url = URL.createObjectURL(result.blob)
    setResultUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [result])

  function selectTool(next: PdfToolDef) {
    setTool(next)
    setFiles([])
    setPages('')
    setError(null)
    setResult(null)
  }

  function addFiles(list: FileList | null) {
    if (!list) return
    const incoming = Array.from(list)
    const tooBig = incoming.find(f => f.size > MAX_FILE_BYTES)
    if (tooBig) { setError(`"${tooBig.name}" is over ${formatSize(MAX_FILE_BYTES)}`); return }
    setError(null)
    setResult(null)
    setFiles(prev => (tool.multiple ? [...prev, ...incoming] : incoming.slice(0, 1)))
    if (inputRef.current) inputRef.current.value = ''
  }

  function move(index: number, delta: number) {
    setFiles(prev => {
      const next = [...prev]
      const target = index + delta
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    setResult(null)
  }

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0)
  const missingPages = !!tool.pagesRequired && !pages.trim()
  const canRun = files.length >= tool.minFiles && !missingPages && totalBytes <= MAX_TOTAL_BYTES
    && (!tool.options.includes('text') || !!text.trim()) && !running

  async function handleRun() {
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      setResult(await runPdfTool(tool.key, files, {
        pages: tool.options.includes('pages') ? pages.trim() : undefined,
        angle: tool.options.includes('angle') ? angle : undefined,
        text: tool.options.includes('text') ? text.trim() : undefined,
        opacity: tool.options.includes('opacity') ? opacity : undefined,
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold">PDF tools</h1>
        <p className="text-sm text-muted-foreground">Files are processed on the server and not stored.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {PDF_TOOLS.map(t => (
          <button
            key={t.key}
            onClick={() => selectTool(t)}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-colors',
              t.key === tool.key ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:bg-accent',
            )}
          >
            <t.icon className="h-5 w-5" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">{tool.description}</p>

        <input
          ref={inputRef}
          type="file"
          accept={tool.accept}
          multiple={tool.multiple}
          className="hidden"
          onChange={e => addFiles(e.target.files)}
        />
        <Button variant="outline" className="w-full" onClick={() => inputRef.current?.click()}>
          <Upload className="h-4 w-4" />
          {files.length === 0 ? (tool.multiple ? 'Choose files' : 'Choose file') : tool.multiple ? 'Add more files' : 'Replace file'}
        </Button>

        {files.length > 0 && (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{f.name}</div>
                  <div className="text-xs text-muted-foreground">{formatSize(f.size)}</div>
                </div>
                {tool.key === 'merge' && (
                  <>
                    <button aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="p-1.5 rounded hover:bg-accent disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                    <button aria-label="Move down" disabled={i === files.length - 1} onClick={() => move(i, 1)} className="p-1.5 rounded hover:bg-accent disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                  </>
                )}
                <button aria-label={`Remove ${f.name}`} onClick={() => { setFiles(prev => prev.filter((_, j) => j !== i)); setResult(null) }} className="p-1.5 rounded hover:bg-accent"><X className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
        {totalBytes > MAX_TOTAL_BYTES && (
          <p className="text-sm text-destructive">Total size is over {formatSize(MAX_TOTAL_BYTES)} — remove some files.</p>
        )}

        {tool.options.includes('pages') && (
          <div className="space-y-1.5">
            <Label htmlFor="pdf-pages">{tool.pagesLabel}</Label>
            <Input id="pdf-pages" value={pages} onChange={e => setPages(e.target.value)} placeholder={tool.pagesPlaceholder} />
          </div>
        )}
        {tool.options.includes('angle') && (
          <div className="space-y-1.5">
            <Label>Rotate clockwise</Label>
            <div className="flex gap-2">
              {[90, 180, 270].map(a => (
                <Button key={a} size="sm" variant={angle === a ? 'default' : 'outline'} onClick={() => setAngle(a)}>{a}°</Button>
              ))}
            </div>
          </div>
        )}
        {tool.options.includes('text') && (
          <div className="space-y-1.5">
            <Label htmlFor="pdf-wm-text">Watermark text</Label>
            <Input id="pdf-wm-text" value={text} maxLength={60} onChange={e => setText(e.target.value)} />
          </div>
        )}
        {tool.options.includes('opacity') && (
          <div className="space-y-1.5">
            <Label htmlFor="pdf-wm-opacity">Opacity ({Math.round(opacity * 100)}%)</Label>
            <input id="pdf-wm-opacity" type="range" min={0.05} max={1} step={0.05} value={opacity} onChange={e => setOpacity(Number(e.target.value))} className="w-full" />
          </div>
        )}

        <Button className="w-full" disabled={!canRun} onClick={handleRun}>
          {running && <Loader2 className="h-4 w-4 animate-spin" />}
          {running ? 'Processing…' : tool.label}
        </Button>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        {result && resultUrl && (
          <a
            href={resultUrl}
            download={result.filename}
            className="flex items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium hover:bg-secondary/80"
          >
            <Download className="h-4 w-4" />
            Download {result.filename} ({formatSize(result.blob.size)})
          </a>
        )}
      </div>
    </div>
  )
}
