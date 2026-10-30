import { openPage, goto, navigate, shot, shotEl, settle, run, closeBrowser } from './lib.mjs'
import { buildSeed, d, iso, mk } from './seed.mjs'
import { applyAll, mockExternal } from './seed2.mjs'

const only = process.argv[2]
const S = 'screens/'

function fullStore() {
  const s = buildSeed()
  applyAll(s)
  return s
}

async function visit(name, route, { store, signedIn = true, viewport, now, mock = {}, wait = 1100 } = {}, fn) {
  if (only && !name.includes(only)) return
  await run(name, async () => {
    const st = store ?? fullStore()
    const ctx = await openPage(st, { signedIn, viewport, now, mock: { external: mockExternal, ...mock } })
    try {
      await goto(ctx.page, typeof route === 'function' ? route(st) : route, { wait })
      await fn(ctx.page, ctx, st)
    } finally {
      await ctx.context.close()
    }
  })
}

const click = async (page, loc, wait = 600) => { await loc.click(); await page.waitForTimeout(wait) }
const tab = (page, name) => page.getByRole('tab', { name })

// ================================================================================ Login / lock
await visit('login', '/', { signedIn: false }, async page => {
  await shot(page, S + 'login-signed-out-sign-in-with-google', { mode: 'viewport' })
})

await visit('unlock', '/wealth', {}, async page => {
  await shot(page, S + 'unlock-code-entry-keypad-opens-locked-wealth-page', { mode: 'viewport' })
  const key = n => page.getByRole('button', { name: String(n), exact: true })
  for (const n of [1, 2, 3, 4]) await key(n).click()
  await page.waitForTimeout(120)
  await shot(page, S + 'unlock-wrong-code-red-dots-and-tries-left-message', { mode: 'viewport' })
  await page.waitForTimeout(700)
  for (let i = 0; i < 6; i++) {
    const locked = await page.getByText(/Too many wrong codes/).count()
    if (locked) break
    for (const n of [1, 2, 3, 4]) { if (await key(n).isEnabled()) await key(n).click().catch(() => {}) }
    await page.waitForTimeout(650)
  }
  await page.waitForTimeout(300)
  await shot(page, S + 'unlock-too-many-wrong-codes-locked-out-with-cooldown', { mode: 'viewport' })
})

// ================================================================================ Wealth
await visit('wealth', '/wealth', {}, async page => {
  const key = n => page.getByRole('button', { name: String(n), exact: true })
  for (const n of [0, 0, 0, 0]) await key(n).click()
  await page.waitForTimeout(1500)
  await shot(page, S + 'wealth-accounts-tab-net-worth-summary-and-accounts-by-category')
  await page.getByRole('button', { name: 'Ophir', exact: true }).first().click().catch(() => {})
  await page.waitForTimeout(600)
  await shot(page, S + 'wealth-accounts-tab-filtered-to-one-owner')
  await page.getByRole('button', { name: 'All', exact: true }).first().click().catch(() => {})
  await page.getByRole('button', { name: 'Goals', exact: true }).click()
  await page.waitForTimeout(700)
  await shot(page, S + 'wealth-goals-tab-progress-towards-savings-goals')
  await page.getByRole('button', { name: 'Trend', exact: true }).click()
  await page.waitForTimeout(1200)
  await shot(page, S + 'wealth-trend-tab-net-worth-over-time-chart')
  await page.getByRole('button', { name: 'Accounts', exact: true }).click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: /add/i }).last().click().catch(() => {})
  await page.waitForTimeout(800)
  await shot(page, S + 'wealth-add-account-drawer-open', { mode: 'viewport' })
})

// ================================================================================ Simple pages
await visit('habits', '/habits', {}, async (page) => {
  await shot(page, S + 'habits-list-with-streaks-frequency-and-owed-badges')
  await page.locator('button:has(svg.lucide-plus)').first().click()
  await page.waitForTimeout(800)
  await shot(page, S + 'habits-add-habit-form-drawer-open', { mode: 'viewport' })
})
await visit('tasks', '/todos', {}, async page => {
  await shot(page, S + 'tasks-upcoming-tab-default-view-with-filter-tabs')
})
await visit('climbing', '/climbing', {}, async page => {
  await shot(page, S + 'climbing-log-tab-quick-add-attempt-grid-empty-session', { mode: 'viewport' })
  for (const g of ['v3-4', 'v4-5', 'v4-5', 'v5-6']) await page.getByRole('button', { name: g, exact: true }).first().click()
  await page.waitForTimeout(300)
  await shot(page, S + 'climbing-log-tab-session-with-four-attempts-logged')
  await click(page, tab(page, 'History'))
  await shot(page, S + 'climbing-history-tab-past-sessions')
  await click(page, tab(page, 'Stats'), 1000)
  await shot(page, S + 'climbing-stats-tab-grade-charts-and-totals')
})
await visit('shopping', '/shopping', {}, async page => {
  await shot(page, S + 'shopping-to-buy-tab-unchecked-items')
  await click(page, tab(page, /Completed/))
  await shot(page, S + 'shopping-completed-tab-checked-off-items')
})
await visit('calendar', '/calendar', {}, async page => {
  await shot(page, S + 'calendar-list-tab-upcoming-events-grouped-by-day')
  await click(page, tab(page, 'Month'), 800)
  await shot(page, S + 'calendar-month-tab-grid-with-event-dots')
})
await visit('files', '/files', {}, async page => {
  await shot(page, S + 'files-root-folders-and-loose-files')
})
await visit('converter', '/converter', {}, async page => {
  await shot(page, S + 'converter-currency-converter-with-live-rate-and-alerts')
})
await visit('stocks', '/stocks', {}, async page => {
  await shot(page, S + 'stocks-watchlist-quotes-and-price-alerts')
})
await visit('settings', '/settings', {}, async page => {
  await shot(page, S + 'settings-all-sections-full-length', { maxHeight: 9000 })
})
await visit('about', '/about', {}, async page => {
  await shot(page, S + 'links-about-page-supabase-vercel-and-other-dashboards')
})
await visit('friends', '/friends', {}, async page => {
  await shot(page, S + 'friends-list-overdue-first-with-goals-and-last-contact')
})
await visit('recipes', '/recipes', {}, async page => {
  await shot(page, S + 'recipes-list-with-collections-rail-and-recipe-cards')
})
await visit('reading', '/reading', {}, async page => {
  await shot(page, S + 'reading-list-folders-and-books')
})
await visit('runescape', '/runescape', {}, async page => {
  await shot(page, S + 'runescape-character-overview-skills-and-goals')
})
await visit('meals', '/meals', {}, async page => {
  await shot(page, S + 'meal-ideas-list-with-tag-filters')
})
await visit('workout', '/workout', {}, async page => {
  await shot(page, S + 'workout-log-tab-log-a-home-workout')
  await click(page, tab(page, 'History'))
  await shot(page, S + 'workout-history-tab-logged-workouts')
  await click(page, tab(page, 'Settings'))
  await shot(page, S + 'workout-settings-tab-presets-exercises-and-tracking')
})
await visit('games', '/games', {}, async page => {
  await shot(page, S + 'games-utilities-list')
})
await visit('dice', '/games/dice', {}, async page => {
  await shot(page, S + 'games-dice-roller')
})
await visit('pdf', '/pdf-tools', {}, async page => {
  await shot(page, S + 'pdf-tools-merge-pdf-tool-selected-default')
})

await closeBrowser()
