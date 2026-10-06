import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'
import { zipSync } from 'fflate'

export type PdfTool = 'merge' | 'split' | 'extract' | 'remove' | 'rotate' | 'images-to-pdf' | 'watermark'

export type ToolResult = { bytes: Uint8Array; contentType: string; filename: string }
export type InputFile = { name: string; bytes: Uint8Array }

export class ToolError extends Error {
  constructor(public code: string, message: string) {
    super(message)
  }
}

const PDF_TYPE = 'application/pdf'
const ZIP_TYPE = 'application/octet-stream'

// Parses "1-3, 5, 8-" (1-based, inclusive; open end = last page) into sorted,
// de-duplicated 0-based indices. Throws ToolError on anything out of range.
export function parsePageRanges(spec: string, pageCount: number): number[] {
  const pages = new Set<number>()
  for (const part of spec.split(',').map(p => p.trim()).filter(Boolean)) {
    const m = /^(\d+)?\s*(-)?\s*(\d+)?$/.exec(part)
    if (!m || (!m[1] && !m[3])) throw new ToolError('INVALID_PAGES', `Invalid page range "${part}"`)
    const start = m[1] ? Number(m[1]) : 1
    const end = m[2] ? (m[3] ? Number(m[3]) : pageCount) : start
    if (start < 1 || end > pageCount || start > end) {
      throw new ToolError('INVALID_PAGES', `Page range "${part}" is outside 1-${pageCount}`)
    }
    for (let p = start; p <= end; p++) pages.add(p - 1)
  }
  if (pages.size === 0) throw new ToolError('INVALID_PAGES', 'No pages selected')
  return [...pages].sort((a, b) => a - b)
}

function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_') || 'document'
}

async function load(file: InputFile): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(file.bytes)
  } catch {
    throw new ToolError('INVALID_PDF', `"${file.name}" is not a valid PDF (or is password-protected)`)
  }
}

async function copyPages(src: PDFDocument, indices: number[]): Promise<PDFDocument> {
  const out = await PDFDocument.create()
  const pages = await out.copyPages(src, indices)
  pages.forEach(p => out.addPage(p))
  return out
}

function requireFiles(files: InputFile[], min: number, max: number, what: string) {
  if (files.length < min) throw new ToolError('MISSING_FILES', `Add at least ${min} ${what}`)
  if (files.length > max) throw new ToolError('TOO_MANY_FILES', `At most ${max} ${what} are allowed`)
}

async function merge(files: InputFile[]): Promise<ToolResult> {
  requireFiles(files, 2, 20, 'PDF files')
  const out = await PDFDocument.create()
  for (const file of files) {
    const src = await load(file)
    const pages = await out.copyPages(src, src.getPageIndices())
    pages.forEach(p => out.addPage(p))
  }
  return { bytes: await out.save(), contentType: PDF_TYPE, filename: 'merged.pdf' }
}

// Each range group ("1-3;4-6") becomes its own PDF; with no groups, one PDF per page.
async function split(files: InputFile[], ranges: string): Promise<ToolResult> {
  requireFiles(files, 1, 1, 'PDF file')
  const src = await load(files[0])
  const count = src.getPageCount()
  const groups = ranges.trim()
    ? ranges.split(';').map(g => parsePageRanges(g, count))
    : src.getPageIndices().map(i => [i])
  if (groups.length > 200) throw new ToolError('TOO_MANY_FILES', 'Too many output files')
  const base = baseName(files[0].name)
  const entries: Record<string, Uint8Array> = {}
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i]
    const label = g.length === 1 ? `page-${g[0] + 1}` : `pages-${g[0] + 1}-${g[g.length - 1] + 1}`
    entries[`${base}_${String(i + 1).padStart(2, '0')}_${label}.pdf`] = await (await copyPages(src, g)).save()
  }
  return { bytes: zipSync(entries, { level: 0 }), contentType: ZIP_TYPE, filename: `${base}_split.zip` }
}

async function selectPages(files: InputFile[], pagesSpec: string, keep: boolean): Promise<ToolResult> {
  requireFiles(files, 1, 1, 'PDF file')
  const src = await load(files[0])
  const count = src.getPageCount()
  const chosen = new Set(parsePageRanges(pagesSpec, count))
  const indices = src.getPageIndices().filter(i => chosen.has(i) === keep)
  if (indices.length === 0) throw new ToolError('INVALID_PAGES', 'That would leave the PDF with no pages')
  const out = await copyPages(src, indices)
  return { bytes: await out.save(), contentType: PDF_TYPE, filename: `${baseName(files[0].name)}_${keep ? 'extracted' : 'trimmed'}.pdf` }
}

async function rotate(files: InputFile[], angle: number, pagesSpec: string): Promise<ToolResult> {
  requireFiles(files, 1, 1, 'PDF file')
  if (![90, 180, 270].includes(angle)) throw new ToolError('INVALID_OPTIONS', 'Angle must be 90, 180 or 270')
  const doc = await load(files[0])
  const count = doc.getPageCount()
  const indices = pagesSpec.trim() ? parsePageRanges(pagesSpec, count) : doc.getPageIndices()
  for (const i of indices) {
    const page = doc.getPage(i)
    page.setRotation(degrees((page.getRotation().angle + angle) % 360))
  }
  return { bytes: await doc.save(), contentType: PDF_TYPE, filename: `${baseName(files[0].name)}_rotated.pdf` }
}

function isPng(b: Uint8Array) { return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 }
function isJpg(b: Uint8Array) { return b[0] === 0xff && b[1] === 0xd8 }

// One page per image, sized to the image so nothing is scaled or cropped.
async function imagesToPdf(files: InputFile[]): Promise<ToolResult> {
  requireFiles(files, 1, 30, 'images')
  const out = await PDFDocument.create()
  for (const file of files) {
    let image
    if (isPng(file.bytes)) image = await out.embedPng(file.bytes)
    else if (isJpg(file.bytes)) image = await out.embedJpg(file.bytes)
    else throw new ToolError('INVALID_IMAGE', `"${file.name}" is not a PNG or JPEG image`)
    const page = out.addPage([image.width, image.height])
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
  }
  return { bytes: await out.save(), contentType: PDF_TYPE, filename: 'images.pdf' }
}

async function watermark(files: InputFile[], text: string, opacity: number): Promise<ToolResult> {
  requireFiles(files, 1, 1, 'PDF file')
  const clean = text.trim()
  if (!clean || clean.length > 60) throw new ToolError('INVALID_OPTIONS', 'Watermark text must be 1-60 characters')
  // Standard fonts only cover WinAnsi (Latin) — reject rather than crash mid-render.
  if (/[^\x20-\x7E\xA0-\xFF]/.test(clean)) throw new ToolError('INVALID_OPTIONS', 'Watermark text supports Latin characters only')
  const doc = await load(files[0])
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const alpha = Math.min(1, Math.max(0.05, opacity))
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize()
    const size = Math.min(width, height) / 8
    const textWidth = font.widthOfTextAtSize(clean, size)
    const angle = Math.PI / 4
    // Centre the rotated text: pdf-lib rotates around the draw origin (text start).
    page.drawText(clean, {
      x: width / 2 - (textWidth / 2) * Math.cos(angle) + (size / 3) * Math.sin(angle),
      y: height / 2 - (textWidth / 2) * Math.sin(angle) - (size / 3) * Math.cos(angle),
      size,
      font,
      color: rgb(0.5, 0.5, 0.5),
      opacity: alpha,
      rotate: degrees(45),
    })
  }
  return { bytes: await doc.save(), contentType: PDF_TYPE, filename: `${baseName(files[0].name)}_watermarked.pdf` }
}

export async function runTool(
  tool: PdfTool,
  files: InputFile[],
  options: { pages?: string; angle?: number; text?: string; opacity?: number },
): Promise<ToolResult> {
  switch (tool) {
    case 'merge': return merge(files)
    case 'split': return split(files, options.pages ?? '')
    case 'extract': return selectPages(files, options.pages ?? '', true)
    case 'remove': return selectPages(files, options.pages ?? '', false)
    case 'rotate': return rotate(files, options.angle ?? 90, options.pages ?? '')
    case 'images-to-pdf': return imagesToPdf(files)
    case 'watermark': return watermark(files, options.text ?? '', options.opacity ?? 0.25)
    default: throw new ToolError('INVALID_TOOL', 'Unknown tool')
  }
}
