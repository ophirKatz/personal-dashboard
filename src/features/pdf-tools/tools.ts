import { Combine, Scissors, FileOutput, Trash2, RotateCw, ImagePlus, Droplets, Minimize2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type PdfToolKey = 'merge' | 'split' | 'extract' | 'remove' | 'rotate' | 'images-to-pdf' | 'watermark' | 'compress'

export type PdfToolDef = {
  key: PdfToolKey
  label: string
  description: string
  icon: LucideIcon
  accept: string
  multiple: boolean
  minFiles: number
  // Which option inputs the tool needs.
  options: Array<'pages' | 'angle' | 'text' | 'opacity' | 'level'>
  pagesRequired?: boolean
  pagesLabel?: string
  pagesPlaceholder?: string
  // Runs in the browser instead of the pdf-tools edge function: nothing is uploaded,
  // and the server's upload caps don't apply (see `maxFileBytes`).
  local?: boolean
  maxFileBytes?: number
}

export const PDF_TOOLS: PdfToolDef[] = [
  {
    key: 'merge', label: 'Merge PDF', description: 'Combine several PDFs into one, in the order listed.',
    icon: Combine, accept: 'application/pdf', multiple: true, minFiles: 2, options: [],
  },
  {
    key: 'split', label: 'Split PDF', description: 'Break a PDF into separate files, downloaded as a ZIP.',
    icon: Scissors, accept: 'application/pdf', multiple: false, minFiles: 1, options: ['pages'],
    pagesLabel: 'Groups (optional)', pagesPlaceholder: '1-3;4;5-  — blank = one file per page',
  },
  {
    key: 'extract', label: 'Extract pages', description: 'Keep only the pages you pick.',
    icon: FileOutput, accept: 'application/pdf', multiple: false, minFiles: 1, options: ['pages'],
    pagesRequired: true, pagesLabel: 'Pages to keep', pagesPlaceholder: '1-3, 5, 8-',
  },
  {
    key: 'remove', label: 'Remove pages', description: 'Delete the pages you pick.',
    icon: Trash2, accept: 'application/pdf', multiple: false, minFiles: 1, options: ['pages'],
    pagesRequired: true, pagesLabel: 'Pages to remove', pagesPlaceholder: '2, 4-6',
  },
  {
    key: 'rotate', label: 'Rotate PDF', description: 'Rotate all pages, or just some.',
    icon: RotateCw, accept: 'application/pdf', multiple: false, minFiles: 1, options: ['angle', 'pages'],
    pagesLabel: 'Pages (optional)', pagesPlaceholder: 'blank = all pages',
  },
  {
    key: 'images-to-pdf', label: 'Images to PDF', description: 'Turn JPG/PNG images into a PDF, one per page.',
    icon: ImagePlus, accept: 'image/png,image/jpeg', multiple: true, minFiles: 1, options: [],
  },
  {
    key: 'watermark', label: 'Watermark', description: 'Stamp diagonal text across every page.',
    icon: Droplets, accept: 'application/pdf', multiple: false, minFiles: 1, options: ['text', 'opacity'],
  },
  {
    key: 'compress', label: 'Compress PDF',
    description: 'Shrink a PDF by recompressing its embedded JPEG images (scans and photos). Text and vector graphics are left untouched.',
    icon: Minimize2, accept: 'application/pdf', multiple: false, minFiles: 1, options: ['level'],
    // Bounded by browser memory (pdf-lib holds the whole document), not by the server.
    local: true, maxFileBytes: 50 * 1024 * 1024,
  },
]

export type CompressionLevel = 'light' | 'balanced' | 'maximum'

// `maxDimension` caps an image's longer side in pixels (~150 dpi on an A4 page at 1754);
// images already below it are never upscaled. `quality` is the JPEG quality, 0-1.
export const COMPRESSION_LEVELS: Record<CompressionLevel, { label: string; description: string; maxDimension: number; quality: number }> = {
  light: { label: 'Light', description: 'Near-original quality, modest savings.', maxDimension: 2500, quality: 0.8 },
  balanced: { label: 'Balanced', description: 'Good for screens and sharing — the usual pick.', maxDimension: 1800, quality: 0.65 },
  maximum: { label: 'Maximum', description: 'Smallest file; images get visibly softer.', maxDimension: 1200, quality: 0.5 },
}
export const DEFAULT_COMPRESSION_LEVEL: CompressionLevel = 'balanced'

export const MAX_FILE_BYTES = 15 * 1024 * 1024
export const MAX_TOTAL_BYTES = 30 * 1024 * 1024

// Per-tool upload limits: browser-side tools aren't bound by the edge function's caps.
export function limitsFor(tool: PdfToolDef): { file: number; total: number } {
  const file = tool.maxFileBytes ?? MAX_FILE_BYTES
  return { file, total: tool.local ? file : MAX_TOTAL_BYTES }
}
