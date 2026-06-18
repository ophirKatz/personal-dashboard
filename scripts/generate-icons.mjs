import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

// Minimal PNG encoder: flat background with a centered rounded square mark.
// Avoids a dependency on an image library for these placeholder app icons.

const BG = [37, 99, 235] // matches the app's --primary blue
const MARK = [255, 255, 255]

function crc32(buf) {
  let c
  const table = crc32.table ?? (crc32.table = (() => {
    const t = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c
    }
    return t
  })())
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function inRoundedSquare(x, y, size, margin, radius) {
  const lo = margin, hi = size - margin
  if (x < lo || x >= hi || y < lo || y >= hi) return false
  const cx = x < lo + radius ? lo + radius : x > hi - radius ? hi - radius : x
  const cy = y < lo + radius ? lo + radius : y > hi - radius ? hi - radius : y
  const dx = x - cx, dy = y - cy
  return dx * dx + dy * dy <= radius * radius
}

function makePng(size, { maskable = false } = {}) {
  const margin = maskable ? Math.round(size * 0.3) : Math.round(size * 0.22)
  const radius = Math.round(size * 0.12)
  const rowBytes = size * 3 + 1
  const raw = Buffer.alloc(rowBytes * size)

  for (let y = 0; y < size; y++) {
    const rowStart = y * rowBytes
    raw[rowStart] = 0 // no filter
    for (let x = 0; x < size; x++) {
      const isMark = inRoundedSquare(x, y, size, margin, radius)
      const [r, g, b] = isMark ? MARK : BG
      const px = rowStart + 1 + x * 3
      raw[px] = r
      raw[px + 1] = g
      raw[px + 2] = b
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: RGB
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const idat = deflateSync(raw)
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const outputs = [
  ['public/icon-192.png', 192, {}],
  ['public/icon-512.png', 512, {}],
  ['public/icon-maskable-512.png', 512, { maskable: true }],
  ['public/apple-touch-icon.png', 180, {}],
]

for (const [path, size, opts] of outputs) {
  writeFileSync(path, makePng(size, opts))
  console.log('wrote', path)
}
