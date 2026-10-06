import { supabase } from '../../supabase'
import type { PdfToolKey } from './tools'

export type PdfToolOptions = { pages?: string; angle?: number; text?: string; opacity?: number }
export type PdfToolOutput = { blob: Blob; filename: string }

const MAX_FETCH_RETRIES = 3
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function baseName(name: string) {
  return name.replace(/\.[^.]+$/, '') || 'document'
}

// The function sets no filename header, so derive it from the tool + input.
function outputName(tool: PdfToolKey, files: File[], isZip: boolean): string {
  const base = baseName(files[0].name)
  switch (tool) {
    case 'merge': return 'merged.pdf'
    case 'images-to-pdf': return 'images.pdf'
    case 'split': return isZip ? `${base}_split.zip` : `${base}_split.pdf`
    case 'extract': return `${base}_extracted.pdf`
    case 'remove': return `${base}_trimmed.pdf`
    case 'rotate': return `${base}_rotated.pdf`
    case 'watermark': return `${base}_watermarked.pdf`
  }
}

export async function runPdfTool(tool: PdfToolKey, files: File[], options: PdfToolOptions): Promise<PdfToolOutput> {
  const form = new FormData()
  form.append('tool', tool)
  for (const f of files) form.append('files', f, f.name)
  if (options.pages) form.append('pages', options.pages)
  if (options.angle !== undefined) form.append('angle', String(options.angle))
  if (options.text) form.append('text', options.text)
  if (options.opacity !== undefined) form.append('opacity', String(options.opacity))

  for (let attempt = 1; attempt <= MAX_FETCH_RETRIES; attempt++) {
    const { data, error } = await supabase.functions.invoke('pdf-tools', { body: form })
    if (!error) {
      if (!(data instanceof Blob)) throw new Error('Unexpected response from server')
      return { blob: data, filename: outputName(tool, files, tool === 'split' && data.type !== 'application/pdf') }
    }
    // Network-level failures are safe to retry: the function has no side effects.
    if (error.name === 'FunctionsFetchError' && attempt < MAX_FETCH_RETRIES) {
      await sleep(500 * attempt)
      continue
    }
    const body = await error.context?.json?.().catch(() => null)
    throw new Error(body?.message ?? body?.error ?? error.message ?? 'Processing failed')
  }
  throw new Error('Processing failed')
}
