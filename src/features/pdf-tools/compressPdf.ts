import { PDFArray, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef, ParseSpeeds } from 'pdf-lib'
import { COMPRESSION_LEVELS, type CompressionLevel } from './tools'

// Shrinks a PDF by recompressing the JPEG images embedded in it (scans and photos are
// nearly all of the weight in a large PDF). Pages, text, fonts and vector graphics are
// never touched, so text stays selectable and searchable.
//
// Deliberately conservative: an image is only replaced when we can be sure the swap is
// invisible to the PDF around it, and only when it actually gets smaller. Anything we
// can't reason about (CMYK, masks, /Decode arrays, EXIF-rotated, non-JPEG) is left as-is.

// Below this an image isn't worth the generation loss of re-encoding it.
const MIN_IMAGE_BYTES = 20 * 1024
// A replacement must be at least this much smaller than the original to be used.
const MAX_SIZE_RATIO = 0.9

export type JpegTarget = { width: number; height: number; quality: number }

// Decodes `jpeg`, resizes it to exactly width×height and returns a new baseline RGB
// JPEG — or null if the browser couldn't (the image is then left alone).
export type JpegEncoder = (jpeg: Uint8Array, target: JpegTarget) => Promise<Uint8Array | null>

export type CompressResult = {
  bytes: Uint8Array
  imagesFound: number
  imagesRecompressed: number
}

export class InvalidPdfError extends Error {}

export type JpegInfo = { width: number; height: number; components: number; precision: number; orientation: number }

// EXIF orientation (tag 0x0112) from an APP1 segment body, or null if absent/unreadable.
function exifOrientation(view: DataView, start: number, end: number): number | null {
  // "Exif\0\0" + TIFF header (2 byte order, 0x002A, 4 byte IFD0 offset)
  if (end - start < 14 || view.getUint32(start) !== 0x45786966 || view.getUint16(start + 4) !== 0) return null
  const tiff = start + 6
  const order = view.getUint16(tiff)
  if (order !== 0x4949 && order !== 0x4d4d) return null
  const le = order === 0x4949
  const ifd = tiff + view.getUint32(tiff + 4, le)
  if (ifd + 2 > end) return null
  const count = view.getUint16(ifd, le)
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12
    if (entry + 12 > end) return null
    if (view.getUint16(entry, le) === 0x0112) return view.getUint16(entry + 8, le)
  }
  return null
}

// Reads the frame header of a baseline / extended / progressive Huffman JPEG. Returns
// null for anything else (arithmetic-coded, lossless, truncated, not a JPEG at all).
export function readJpegInfo(bytes: Uint8Array): JpegInfo | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let orientation = 1
  let pos = 2
  while (pos + 4 <= bytes.length) {
    if (bytes[pos] !== 0xff) return null
    const marker = bytes[pos + 1]
    if (marker === 0xff) { pos++; continue } // fill byte
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) { pos += 2; continue } // standalone markers
    const length = view.getUint16(pos + 2)
    if (length < 2) return null
    const body = pos + 4
    const end = Math.min(pos + 2 + length, bytes.length)
    if (marker === 0xe1) orientation = exifOrientation(view, body, end) ?? orientation
    if (marker >= 0xc0 && marker <= 0xc2) {
      if (body + 6 > bytes.length) return null
      return {
        precision: bytes[body],
        height: view.getUint16(body + 1),
        width: view.getUint16(body + 3),
        components: bytes[body + 5],
        orientation,
      }
    }
    // Any other frame type, or the scan itself arriving before a frame header.
    if ((marker >= 0xc3 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) || marker === 0xda) return null
    pos += 2 + length
  }
  return null
}

const N = PDFName.of
const nameOf = (obj: unknown) => (obj instanceof PDFName ? obj.decodeText() : undefined)
const numberOf = (obj: unknown) => (obj instanceof PDFNumber ? obj.asNumber() : undefined)

// True when the stream's only filter is DCTDecode (as a name or a one-element array).
function isPlainDct(stream: PDFRawStream): boolean {
  const filter = stream.dict.lookup(N('Filter'))
  if (filter instanceof PDFArray) return filter.size() === 1 && nameOf(filter.lookup(0)) === 'DCTDecode'
  return nameOf(filter) === 'DCTDecode'
}

// Number of colour components the PDF declares for an image, for the colour spaces whose
// values we can carry across a decode/encode round trip unchanged.
function declaredComponents(stream: PDFRawStream): number | undefined {
  const cs = stream.dict.lookup(N('ColorSpace'))
  const name = nameOf(cs)
  if (name === 'DeviceRGB') return 3
  if (name === 'DeviceGray') return 1
  if (cs instanceof PDFArray && nameOf(cs.lookup(0)) === 'ICCBased') {
    const profile = cs.lookup(1)
    return profile instanceof PDFRawStream ? numberOf(profile.dict.lookup(N('N'))) : undefined
  }
  return undefined
}

type Candidate = { ref: PDFRef; stream: PDFRawStream; info: JpegInfo }

function findCandidates(doc: PDFDocument): { candidates: Candidate[]; found: number } {
  const candidates: Candidate[] = []
  let found = 0
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream) || nameOf(obj.dict.lookup(N('Subtype'))) !== 'Image' || !isPlainDct(obj)) continue
    found++
    const { dict } = obj
    if (obj.contents.length < MIN_IMAGE_BYTES) continue
    // Masks and inverted /Decode arrays depend on the exact sample values; stencil
    // masks aren't colour images at all. DecodeParms would carry a ColorTransform override.
    if (dict.has(N('Decode')) || dict.has(N('Mask')) || dict.has(N('DecodeParms'))) continue
    if (dict.lookup(N('ImageMask'))?.toString() === 'true') continue
    if (numberOf(dict.lookup(N('BitsPerComponent'))) !== 8) continue

    const info = readJpegInfo(obj.contents)
    if (!info || info.precision !== 8) continue
    // PDF viewers ignore EXIF; a decoder that honours it would rotate the image.
    if (info.orientation !== 1) continue
    if (info.components !== declaredComponents(obj)) continue
    if (info.width !== numberOf(dict.lookup(N('Width'))) || info.height !== numberOf(dict.lookup(N('Height')))) continue
    candidates.push({ ref, stream: obj, info })
  }
  return { candidates, found }
}

export async function compressPdf(
  input: Uint8Array,
  level: CompressionLevel,
  encode: JpegEncoder,
  onProgress?: (done: number, total: number) => void,
): Promise<CompressResult> {
  const { maxDimension, quality } = COMPRESSION_LEVELS[level]

  let doc: PDFDocument
  try {
    doc = await PDFDocument.load(input, { updateMetadata: false, parseSpeed: ParseSpeeds.Fast })
  } catch {
    throw new InvalidPdfError('This is not a valid PDF (or it is password-protected)')
  }

  const { candidates, found } = findCandidates(doc)
  let recompressed = 0
  onProgress?.(0, candidates.length)

  for (let i = 0; i < candidates.length; i++) {
    const { ref, stream, info } = candidates[i]
    const scale = Math.min(1, maxDimension / Math.max(info.width, info.height))
    const width = Math.max(1, Math.round(info.width * scale))
    const height = Math.max(1, Math.round(info.height * scale))

    let out: Uint8Array | null = null
    try {
      out = await encode(stream.contents, { width, height, quality })
    } catch {
      out = null // undecodable here (huge, exotic, out of memory): keep the original
    }
    const outInfo = out && readJpegInfo(out)
    if (out && outInfo && outInfo.width === width && outInfo.height === height && outInfo.components === 3
      && out.length <= stream.contents.length * MAX_SIZE_RATIO) {
      const dict = stream.dict.clone(doc.context)
      dict.set(N('Width'), PDFNumber.of(width))
      dict.set(N('Height'), PDFNumber.of(height))
      // Canvas output is always 3-component, so a grey source becomes (grey) RGB.
      if (info.components === 1) dict.set(N('ColorSpace'), N('DeviceRGB'))
      doc.context.assign(ref, PDFRawStream.of(dict, out))
      recompressed++
    }
    onProgress?.(i + 1, candidates.length)
  }

  if (recompressed === 0) return { bytes: input, imagesFound: found, imagesRecompressed: 0 }
  const bytes = await doc.save({ addDefaultPage: false })
  // Rewriting can occasionally cost more than the images saved (e.g. a few tiny wins).
  if (bytes.length >= input.length) return { bytes: input, imagesFound: found, imagesRecompressed: 0 }
  return { bytes, imagesFound: found, imagesRecompressed: recompressed }
}
