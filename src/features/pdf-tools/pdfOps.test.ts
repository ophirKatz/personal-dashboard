import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { unzipSync } from 'fflate'
import { parsePageRanges, runTool, ToolError } from '../../../supabase/functions/pdf-tools/pdf-ops'

async function makePdf(pages: number, name = 'a.pdf') {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage([200 + i, 300])
  return { name, bytes: await doc.save() }
}
const pageCount = async (bytes: Uint8Array) => (await PDFDocument.load(bytes)).getPageCount()

describe('parsePageRanges', () => {
  it('parses lists, ranges and open ends', () => {
    expect(parsePageRanges('1-2, 4', 5)).toEqual([0, 1, 3])
    expect(parsePageRanges('4-', 5)).toEqual([3, 4])
    expect(parsePageRanges('-2', 5)).toEqual([0, 1])
    expect(parsePageRanges('2,2,1', 5)).toEqual([0, 1])
  })
  it('rejects bad input', () => {
    expect(() => parsePageRanges('6', 5)).toThrow(ToolError)
    expect(() => parsePageRanges('3-1', 5)).toThrow(ToolError)
    expect(() => parsePageRanges('abc', 5)).toThrow(ToolError)
    expect(() => parsePageRanges('', 5)).toThrow(ToolError)
  })
})

describe('runTool', () => {
  it('merges in order', async () => {
    const r = await runTool('merge', [await makePdf(2), await makePdf(3)], {})
    const doc = await PDFDocument.load(r.bytes)
    expect(doc.getPageCount()).toBe(5)
    expect(doc.getPage(2).getWidth()).toBe(200)
  })
  it('requires two files to merge', async () => {
    await expect(runTool('merge', [await makePdf(1)], {})).rejects.toThrow(ToolError)
  })
  it('splits into a zip of ranges', async () => {
    const r = await runTool('split', [await makePdf(5)], { pages: '1-2;3;4-5' })
    const files = Object.values(unzipSync(r.bytes))
    expect(await Promise.all(files.map(pageCount))).toEqual([2, 1, 2])
  })
  it('extracts and removes pages', async () => {
    const f = await makePdf(5)
    expect(await pageCount((await runTool('extract', [f], { pages: '2,4' })).bytes)).toBe(2)
    expect(await pageCount((await runTool('remove', [f], { pages: '2,4' })).bytes)).toBe(3)
    await expect(runTool('remove', [f], { pages: '1-5' })).rejects.toThrow(ToolError)
  })
  it('rotates selected pages', async () => {
    const r = await runTool('rotate', [await makePdf(2)], { angle: 90, pages: '2' })
    const doc = await PDFDocument.load(r.bytes)
    expect(doc.getPage(0).getRotation().angle).toBe(0)
    expect(doc.getPage(1).getRotation().angle).toBe(90)
  })
  it('converts images to pdf and rejects other types', async () => {
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0))
    const r = await runTool('images-to-pdf', [{ name: 'x.png', bytes: png }], {})
    expect(await pageCount(r.bytes)).toBe(1)
    await expect(runTool('images-to-pdf', [{ name: 'x.txt', bytes: new Uint8Array([1, 2, 3]) }], {})).rejects.toThrow(ToolError)
  })
  it('watermarks every page', async () => {
    const r = await runTool('watermark', [await makePdf(2)], { text: 'DRAFT' })
    expect(await pageCount(r.bytes)).toBe(2)
    await expect(runTool('watermark', [await makePdf(1)], { text: '' })).rejects.toThrow(ToolError)
  })
})
