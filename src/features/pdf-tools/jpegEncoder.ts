import type { JpegEncoder } from './compressPdf'

// Decodes with the browser's own JPEG decoder and re-encodes through a canvas, which
// is far faster than any JS codec and runs off the main thread for the heavy parts.
export const browserJpegEncoder: JpegEncoder = async (jpeg, { width, height, quality }) => {
  // 'none': keep the raw sample values. PDF colour spaces describe the stored numbers,
  // so letting the browser colour-convert via an embedded ICC profile would shift them.
  // (BlobPart cast: TS types pdf-lib's bytes as maybe-SharedArrayBuffer-backed; they never are.)
  const bitmap = await createImageBitmap(new Blob([jpeg as BlobPart], { type: 'image/jpeg' }), { colorSpaceConversion: 'none' })
  try {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
    // Free the backing store now rather than waiting for GC: a scan can have dozens of pages.
    canvas.width = canvas.height = 0
    return blob ? new Uint8Array(await blob.arrayBuffer()) : null
  } finally {
    bitmap.close()
  }
}
