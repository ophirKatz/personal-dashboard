import { Combine, Scissors, FileOutput, Trash2, RotateCw, ImagePlus, Droplets } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type PdfToolKey = 'merge' | 'split' | 'extract' | 'remove' | 'rotate' | 'images-to-pdf' | 'watermark'

export type PdfToolDef = {
  key: PdfToolKey
  label: string
  description: string
  icon: LucideIcon
  accept: string
  multiple: boolean
  minFiles: number
  // Which option inputs the tool needs.
  options: Array<'pages' | 'angle' | 'text' | 'opacity'>
  pagesRequired?: boolean
  pagesLabel?: string
  pagesPlaceholder?: string
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
]

export const MAX_FILE_BYTES = 15 * 1024 * 1024
export const MAX_TOTAL_BYTES = 30 * 1024 * 1024
