import { describe, expect, it, vi } from 'vitest'
import { PDFDocument, PDFName, PDFNumber, PDFRawStream } from 'pdf-lib'
import { compressPdf, InvalidPdfError, readJpegInfo, type JpegEncoder } from './compressPdf'

const u16 = (n: number) => [(n >> 8) & 0xff, n & 0xff]

// A JPEG that is only a valid header (SOI, optional EXIF, SOF0) plus filler up to `size`
// bytes: enough for pdf-lib to embed it and for our header parser, with no codec needed.
function fakeJpeg(width: number, height: number, opts: { components?: number; size?: number; orientation?: number; bigEndianExif?: boolean } = {}) {
  const { components = 3, size = 100_000, orientation, bigEndianExif = false } = opts
  const bytes: number[] = [0xff, 0xd8]
  if (orientation !== undefined) {
    const le = !bigEndianExif
    const p16 = (n: number) => (le ? [n & 0xff, (n >> 8) & 0xff] : u16(n))
    const p32 = (n: number) => (le ? [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff] : [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff])
    const tiff = [...(le ? [0x49, 0x49] : [0x4d, 0x4d]), ...p16(0x2a), ...p32(8), ...p16(1), ...p16(0x0112), ...p16(3), ...p32(1), ...p16(orientation), 0, 0, ...p32(0)]
    const body = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff]
    bytes.push(0xff, 0xe1, ...u16(body.length + 2), ...body)
  }
  bytes.push(0xff, 0xc0, ...u16(8 + 3 * components), 8, ...u16(height), ...u16(width), components)
  for (let c = 0; c < components; c++) bytes.push(c + 1, 0x11, 0)
  while (bytes.length < size - 2) bytes.push(0x55)
  bytes.push(0xff, 0xd9)
  return new Uint8Array(bytes)
}

async function pdfWith(...images: Uint8Array[]) {
  const doc = await PDFDocument.create()
  const page = doc.addPage([600, 800])
  for (const bytes of images) page.drawImage(await doc.embedJpg(bytes), { x: 0, y: 0, width: 100, height: 100 })
  return doc.save()
}

// The stub encoder stands in for the browser: returns a 30%-size RGB JPEG at the target size.
const shrink: JpegEncoder = async (jpeg, { width, height }) => fakeJpeg(width, height, { size: Math.round(jpeg.length * 0.3) })

type ImageInfo = { width: number; height: number; colorSpace: string | undefined; filter: string | undefined; size: number }
async function imagesOf(bytes: Uint8Array): Promise<ImageInfo[]> {
  const doc = await PDFDocument.load(bytes)
  const out: ImageInfo[] = []
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream) || obj.dict.lookup(PDFName.of('Subtype'))?.toString() !== '/Image') continue
    out.push({
      width: (obj.dict.lookup(PDFName.of('Width')) as PDFNumber).asNumber(),
      height: (obj.dict.lookup(PDFName.of('Height')) as PDFNumber).asNumber(),
      colorSpace: obj.dict.lookup(PDFName.of('ColorSpace'))?.toString(),
      filter: obj.dict.lookup(PDFName.of('Filter'))?.toString(),
      size: obj.contents.length,
    })
  }
  return out
}

describe('readJpegInfo', () => {
  it('reads dimensions and components', () => {
    expect(readJpegInfo(fakeJpeg(640, 480))).toEqual({ width: 640, height: 480, components: 3, precision: 8, orientation: 1 })
    expect(readJpegInfo(fakeJpeg(10, 20, { components: 1 }))?.components).toBe(1)
  })
  it('reads EXIF orientation in either byte order', () => {
    expect(readJpegInfo(fakeJpeg(8, 8, { orientation: 6 }))?.orientation).toBe(6)
    expect(readJpegInfo(fakeJpeg(8, 8, { orientation: 3, bigEndianExif: true }))?.orientation).toBe(3)
  })
  it('rejects non-JPEGs and unsupported frame types', () => {
    expect(readJpegInfo(new Uint8Array([1, 2, 3, 4, 5]))).toBeNull()
    expect(readJpegInfo(new Uint8Array([0xff, 0xd8]))).toBeNull()
    const arithmetic = fakeJpeg(8, 8)
    arithmetic[3] = 0xc9 // SOF9: arithmetic-coded, browsers can't decode it
    expect(readJpegInfo(arithmetic)).toBeNull()
  })
})

describe('compressPdf', () => {
  it('downscales and recompresses large JPEGs, keeping them DCT and the page intact', async () => {
    const input = await pdfWith(fakeJpeg(3000, 2000, { size: 400_000 }))
    const r = await compressPdf(input, 'balanced', shrink)
    expect(r.imagesRecompressed).toBe(1)
    expect(r.bytes.length).toBeLessThan(input.length * 0.5)
    expect(await imagesOf(r.bytes)).toEqual([expect.objectContaining({ width: 1800, height: 1200, filter: '/DCTDecode', colorSpace: '/DeviceRGB' })])
    expect((await PDFDocument.load(r.bytes)).getPageCount()).toBe(1)
  })

  it('passes each level\'s size cap and quality to the encoder', async () => {
    const input = await pdfWith(fakeJpeg(3000, 2000, { size: 400_000 }))
    const spy = vi.fn(shrink)
    await compressPdf(input, 'maximum', spy)
    expect(spy).toHaveBeenCalledWith(expect.any(Uint8Array), { width: 1200, height: 800, quality: 0.5 })
    spy.mockClear()
    await compressPdf(input, 'light', spy)
    expect(spy).toHaveBeenCalledWith(expect.any(Uint8Array), { width: 2500, height: 1667, quality: 0.8 })
  })

  it('never upscales an image that is already under the cap', async () => {
    const input = await pdfWith(fakeJpeg(1000, 800, { size: 300_000 }))
    const r = await compressPdf(input, 'maximum', shrink)
    expect(await imagesOf(r.bytes)).toEqual([expect.objectContaining({ width: 1000, height: 800 })])
  })

  it('turns grey JPEGs into DeviceRGB, since the browser always writes 3 components', async () => {
    const input = await pdfWith(fakeJpeg(2400, 2400, { components: 1, size: 300_000 }))
    const r = await compressPdf(input, 'balanced', shrink)
    expect(await imagesOf(r.bytes)).toEqual([expect.objectContaining({ width: 1800, height: 1800, colorSpace: '/DeviceRGB' })])
  })

  it('recompresses an image used on several pages only once', async () => {
    const doc = await PDFDocument.create()
    const img = await doc.embedJpg(fakeJpeg(3000, 2000, { size: 300_000 }))
    for (let i = 0; i < 3; i++) doc.addPage([600, 800]).drawImage(img, { x: 0, y: 0, width: 100, height: 100 })
    const spy = vi.fn(shrink)
    const r = await compressPdf(await doc.save(), 'balanced', spy)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(r.imagesRecompressed).toBe(1)
    expect((await PDFDocument.load(r.bytes)).getPageCount()).toBe(3)
  })

  it('leaves images it cannot safely swap alone and returns the input untouched', async () => {
    const input = await pdfWith(
      fakeJpeg(3000, 2000, { size: 15_000 }), // too small to be worth it
      fakeJpeg(3000, 2000, { size: 300_000, orientation: 6 }), // EXIF-rotated: PDF viewers ignore it, decoders don't
      fakeJpeg(3000, 2000, { size: 300_000, components: 4 }), // CMYK
    )
    const spy = vi.fn(shrink)
    const r = await compressPdf(input, 'balanced', spy)
    expect(spy).not.toHaveBeenCalled()
    expect(r.imagesFound).toBe(3)
    expect(r.imagesRecompressed).toBe(0)
    expect(r.bytes).toBe(input)
  })

  it('skips images with a /Decode array', async () => {
    // embedJpg is lazy (the image stream only exists after a save), so round-trip first.
    const doc = await PDFDocument.load(await pdfWith(fakeJpeg(3000, 2000, { size: 300_000 })))
    const [, obj] = doc.context.enumerateIndirectObjects().find(([, o]) => o instanceof PDFRawStream && o.dict.has(PDFName.of('Width')))!
    ;(obj as PDFRawStream).dict.set(PDFName.of('Decode'), doc.context.obj([1, 0, 1, 0, 1, 0]))
    const spy = vi.fn(shrink)
    await compressPdf(await doc.save(), 'balanced', spy)
    expect(spy).not.toHaveBeenCalled()
  })

  it('keeps the original when the encoder fails, throws, or does not actually shrink the image', async () => {
    const input = await pdfWith(fakeJpeg(3000, 2000, { size: 300_000 }))
    for (const encoder of [
      async () => null,
      async () => { throw new Error('out of memory') },
      async (jpeg: Uint8Array, t: { width: number; height: number }) => fakeJpeg(t.width, t.height, { size: jpeg.length }), // not smaller
      async (jpeg: Uint8Array) => fakeJpeg(10, 10, { size: Math.round(jpeg.length / 4) }), // wrong dimensions
    ] satisfies JpegEncoder[]) {
      const r = await compressPdf(input, 'balanced', encoder)
      expect(r.imagesRecompressed).toBe(0)
      expect(r.bytes).toBe(input)
    }
  })

  it('reports progress per image', async () => {
    const input = await pdfWith(fakeJpeg(3000, 2000, { size: 300_000 }), fakeJpeg(2000, 3000, { size: 300_000 }))
    const calls: Array<[number, number]> = []
    await compressPdf(input, 'balanced', shrink, (done, total) => calls.push([done, total]))
    expect(calls).toEqual([[0, 2], [1, 2], [2, 2]])
  })

  it('rejects data that is not a PDF', async () => {
    await expect(compressPdf(new Uint8Array([1, 2, 3, 4]), 'balanced', shrink)).rejects.toThrow(InvalidPdfError)
  })
})
