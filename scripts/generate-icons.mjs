import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

// App icon: an abstract mini mock-up of the home page — the quick-access
// chip row, the Today card (header, sun glyph, list rows), and the Focus
// card (sparkle + summary lines). Rendered with supersampling for
// anti-aliased edges. Avoids a dependency on an image library.

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

function pngFromRaw(size, raw) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: RGB
  const idat = deflateSync(raw)
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

// Renders `colorAtFactory(virtualSize)` (shape math expressed as fractions
// of `size`) at `size * ssFactor` resolution, then box-averages ssFactor x
// ssFactor blocks down to `size`, giving smooth anti-aliased edges.
function makePngSupersampled(size, ssFactor, colorAtFactory) {
  const colorAt = colorAtFactory(size * ssFactor)
  const rowBytes = size * 3 + 1
  const raw = Buffer.alloc(rowBytes * size)
  const norm = ssFactor * ssFactor
  for (let oy = 0; oy < size; oy++) {
    const rowStart = oy * rowBytes
    raw[rowStart] = 0
    for (let ox = 0; ox < size; ox++) {
      let r = 0, g = 0, b = 0
      for (let sy = 0; sy < ssFactor; sy++) {
        const yy = oy * ssFactor + sy
        for (let sx = 0; sx < ssFactor; sx++) {
          const xx = ox * ssFactor + sx
          const [cr, cg, cb] = colorAt(xx, yy)
          r += cr; g += cg; b += cb
        }
      }
      const px = rowStart + 1 + ox * 3
      raw[px] = Math.round(r / norm)
      raw[px + 1] = Math.round(g / norm)
      raw[px + 2] = Math.round(b / norm)
    }
  }
  return pngFromRaw(size, raw)
}

function inRoundedRect(x, y, x0, y0, x1, y1, radius) {
  if (x < x0 || x >= x1 || y < y0 || y >= y1) return false
  const cx = x < x0 + radius ? x0 + radius : x > x1 - radius ? x1 - radius : x
  const cy = y < y0 + radius ? y0 + radius : y > y1 - radius ? y1 - radius : y
  const dx = x - cx, dy = y - cy
  return dx * dx + dy * dy <= radius * radius
}

function inDiamond(x, y, cx, cy, a, b) {
  return Math.abs(x - cx) / a + Math.abs(y - cy) / b <= 1
}

function inSparkle(x, y, cx, cy, r) {
  return inDiamond(x, y, cx, cy, r * 0.32, r) || inDiamond(x, y, cx, cy, r, r * 0.32)
}

const BG = [248, 250, 252]

function homepageIcon(size) {
  const cardBg = [241, 245, 249]
  const focusCardBg = [228, 238, 253]
  const textBar = [148, 163, 184]
  const headerBar = [71, 85, 105]

  const chips = [
    { bg: [199, 240, 217], accent: [22, 163, 74] }, // shopping
    { bg: [253, 224, 196], accent: [234, 88, 12] }, // climbing
    { bg: [253, 240, 189], accent: [202, 138, 4] }, // finance
    { bg: [233, 221, 247], accent: [124, 58, 237] }, // files
  ]
  const rowY0 = size * 0.06, rowY1 = size * 0.2
  const rowMargin = size * 0.08
  const rowGap = size * 0.035
  const chipW = (size - 2 * rowMargin - 3 * rowGap) / 4
  const chipRadius = size * 0.035

  const todayX0 = size * 0.08, todayX1 = size * 0.92
  const todayY0 = size * 0.27, todayY1 = size * 0.62
  const cardRadius = size * 0.045
  const pad = size * 0.05

  const focusY0 = size * 0.68, focusY1 = size * 0.94

  return (x, y) => {
    let color = BG

    for (let i = 0; i < chips.length; i++) {
      const x0 = rowMargin + i * (chipW + rowGap)
      const x1 = x0 + chipW
      if (inRoundedRect(x, y, x0, rowY0, x1, rowY1, chipRadius)) {
        color = chips[i].bg
        const ccx = (x0 + x1) / 2, ccy = (rowY0 + rowY1) / 2
        if (Math.hypot(x - ccx, y - ccy) <= chipW * 0.26) color = chips[i].accent
      }
    }

    if (inRoundedRect(x, y, todayX0, todayY0, todayX1, todayY1, cardRadius)) {
      color = cardBg
      if (inRoundedRect(x, y, todayX0 + pad, todayY0 + pad, todayX0 + pad + size * 0.22, todayY0 + pad + size * 0.035, size * 0.015)) {
        color = headerBar
      }
      const sunCx = todayX1 - pad - size * 0.035, sunCy = todayY0 + pad + size * 0.0175
      if (Math.hypot(x - sunCx, y - sunCy) <= size * 0.035) color = [251, 191, 36]

      const rows = [
        { y: todayY0 + size * 0.13, w: 0.62, bullet: 'circle', bulletColor: [100, 116, 139] },
        { y: todayY0 + size * 0.2, w: 0.5, bullet: 'circle', bulletColor: [100, 116, 139] },
        { y: todayY0 + size * 0.27, w: 0.38, bullet: 'square', bulletColor: [37, 99, 235] },
      ]
      for (const row of rows) {
        const bx = todayX0 + pad
        const by0 = row.y, by1 = row.y + size * 0.022
        const bulletR = size * 0.016
        const bcx = bx + bulletR, bcy = (by0 + by1) / 2
        if (row.bullet === 'circle') {
          if (Math.hypot(x - bcx, y - bcy) <= bulletR) color = row.bulletColor
        } else if (inRoundedRect(x, y, bcx - bulletR, bcy - bulletR, bcx + bulletR, bcy + bulletR, size * 0.005)) {
          color = row.bulletColor
        }
        const lineX0 = bx + bulletR * 2 + size * 0.02
        const lineX1 = todayX0 + pad + (todayX1 - todayX0 - 2 * pad) * row.w
        if (inRoundedRect(x, y, lineX0, by0, lineX1, by1, size * 0.011)) color = textBar
      }
    }

    if (inRoundedRect(x, y, todayX0, focusY0, todayX1, focusY1, cardRadius)) {
      color = focusCardBg
      const sparkCx = todayX0 + pad + size * 0.02, sparkCy = focusY0 + size * 0.055
      if (inSparkle(x, y, sparkCx, sparkCy, size * 0.035)) color = [37, 99, 235]

      const lines = [
        { y: focusY0 + size * 0.025, w: 0.68 },
        { y: focusY0 + size * 0.09, w: 0.55 },
      ]
      for (const line of lines) {
        const lx0 = sparkCx + size * 0.05
        const lx1 = todayX0 + pad + (todayX1 - todayX0 - 2 * pad) * line.w
        if (inRoundedRect(x, y, lx0, line.y, lx1, line.y + size * 0.022, size * 0.011)) color = textBar
      }
    }

    return color
  }
}

// Maskable icons get cropped to a circle/squircle by the OS, so the
// composition is shrunk and centered inside a safe zone, with the
// background filling the full bleed.
function homepageIconMaskable(size) {
  const innerSize = size * 0.7
  const offset = (size - innerSize) / 2
  const inner = homepageIcon(innerSize)
  return (x, y) => {
    const ix = x - offset, iy = y - offset
    if (ix >= 0 && ix < innerSize && iy >= 0 && iy < innerSize) return inner(ix, iy)
    return BG
  }
}

const SS_FACTOR = 4
const outputs = [
  ['public/icon-192.png', 192, homepageIcon],
  ['public/icon-512.png', 512, homepageIcon],
  ['public/icon-maskable-512.png', 512, homepageIconMaskable],
  ['public/apple-touch-icon.png', 180, homepageIcon],
]

for (const [path, size, iconFactory] of outputs) {
  writeFileSync(path, makePngSupersampled(size, SS_FACTOR, iconFactory))
  console.log('wrote', path)
}
