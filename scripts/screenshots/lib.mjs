import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Playwright isn't a project dependency. Use a local install if there is one, else the global one
// (in the Claude sandbox it lives at /opt/node22/lib/node_modules/playwright; override with PLAYWRIGHT_PATH).
const { chromium } = await import(process.env.PLAYWRIGHT_PATH ?? 'playwright').catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'))

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
import { installMock, signIn } from './mock.mjs'

process.env.PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK = '1'

export const BASE = 'http://localhost:5173'
export const OUT = process.env.SCREENSHOT_OUT ?? path.join(REPO_ROOT, 'screenshots')
export const MOBILE = { width: 390, height: 844 }
export const DESKTOP = { width: 1280, height: 800 }

// "Now" for every scenario unless overridden: Thursday 29 Oct 2026, 10:30 Israel time.
export const NOW = '2026-10-29T10:30:00+02:00'

let browser
export async function getBrowser() {
  if (!browser) browser = await chromium.launch()
  return browser
}
export async function closeBrowser() {
  if (browser) await browser.close()
  browser = undefined
}

/**
 * Opens a fresh page with the mock installed.
 * @param store seed tables
 * @param o     { now, viewport, signedIn, mock: installMock opts, scale }
 */
export async function openPage(store, o = {}) {
  const b = await getBrowser()
  const viewport = o.viewport ?? MOBILE
  const context = await b.newContext({
    viewport,
    deviceScaleFactor: o.scale ?? 2,
    isMobile: viewport.width < 768,
    hasTouch: viewport.width < 768,
    timezoneId: 'Asia/Jerusalem',
    locale: 'en-US',
    serviceWorkers: 'block',
    reducedMotion: 'reduce',
    permissions: [],
  })
  context.setDefaultTimeout(8000)
  const mock = await installMock(context, store, o.mock ?? {})
  if (o.signedIn !== false) await signIn(context)
  const page = await context.newPage()
  await page.clock.setFixedTime(new Date(o.now ?? NOW))
  page.on('pageerror', e => console.log('  [pageerror]', e.message.split('\n')[0]))
  page.on('console', m => {
    if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) console.log('  [console.error]', m.text().slice(0, 200))
  })
  return { page, context, mock, store }
}

export async function settle(page, ms = 700) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(ms)
}

const written = []
export function writtenFiles() { return written }

/**
 * Saves a screenshot. mode:
 *   'full'     – grow the viewport so the whole scrollable page content is visible (pages scroll inside <main>)
 *   'viewport' – exactly what a phone screen shows (use for drawers / dialogs / overlays)
 */
export async function shot(page, relPath, { mode = 'full', maxHeight = 4200 } = {}) {
  const file = path.join(OUT, relPath.endsWith('.png') ? relPath : `${relPath}.png`)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const vp = page.viewportSize()
  if (mode === 'full') {
    const h = await page.evaluate(() => {
      const main = document.querySelector('main')
      if (!main) return document.documentElement.scrollHeight
      return main.scrollHeight
    })
    const target = Math.min(Math.max(h, vp.height), maxHeight)
    if (target !== vp.height) {
      await page.setViewportSize({ width: vp.width, height: target })
      await page.waitForTimeout(250)
    }
  }
  await page.screenshot({ path: file })
  if (mode === 'full') {
    const cur = page.viewportSize()
    if (cur.height !== vp.height) {
      await page.setViewportSize(vp)
      await page.waitForTimeout(150)
    }
  }
  written.push(file)
  console.log('  saved', path.relative(OUT, file))
}

export async function goto(page, route, { wait = 900, settleNetwork = true } = {}) {
  if (!settleNetwork) {
    // For "still loading" shots: don't wait for in-flight (deliberately delayed) requests.
    await page.goto(BASE + route, { waitUntil: 'commit' })
    await page.waitForTimeout(wait)
    return
  }
  await page.goto(BASE + route)
  await settle(page, wait)
}

/** Client-side navigation (keeps in-memory unlocked state, unlike page.goto which reloads). */
export async function navigate(page, route, { wait = 900 } = {}) {
  await page.evaluate(r => {
    window.history.pushState({}, '', r)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, route)
  await settle(page, wait)
}

/** Screenshot of a single element (padded a little so borders/shadows aren't clipped). */
export async function shotEl(page, locator, relPath, pad = 6) {
  const file = path.join(OUT, relPath.endsWith('.png') ? relPath : `${relPath}.png`)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const el = locator.first()
  await el.scrollIntoViewIfNeeded()
  await page.waitForTimeout(150)
  const box = await el.boundingBox()
  const vp = page.viewportSize()
  const clip = {
    x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad),
    width: Math.min(vp.width, box.width + pad * 2), height: box.height + pad * 2,
  }
  // The element may extend below the fold: grow the viewport so the clip is on screen.
  if (clip.y + clip.height > vp.height - 100) {
    await page.setViewportSize({ width: vp.width, height: Math.ceil(clip.y + clip.height + 140) })
    await page.waitForTimeout(200)
    const box2 = await el.boundingBox()
    clip.y = Math.max(0, box2.y - pad)
    await page.screenshot({ path: file, clip })
    await page.setViewportSize(vp)
  } else {
    await page.screenshot({ path: file, clip })
  }
  written.push(file)
  console.log('  saved', path.relative(OUT, file))
}

export async function run(name, fn) {
  console.log(`# ${name}`)
  try { await fn() } catch (e) { console.log(`  !! FAILED ${name}: ${e.message.split('\n')[0]}`) }
}
