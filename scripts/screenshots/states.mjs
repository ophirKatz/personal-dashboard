import { openPage, goto, shot, shotEl, run, closeBrowser } from './lib.mjs'
import { buildSeed, d, iso, mk } from './seed.mjs'
import { applyAll, mockExternal } from './seed2.mjs'

const only = process.argv[2]
const S = 'screens/'

function fullStore() {
  const s = buildSeed()
  applyAll(s)
  return s
}

async function visit(name, route, { store, signedIn = true, viewport, now, mock = {}, wait = 1100, init } = {}, fn) {
  if (only && !name.includes(only)) return
  await run(name, async () => {
    const st = store ?? fullStore()
    const ctx = await openPage(st, { signedIn, viewport, now, mock: { ...mock, external: { ...mockExternal, ...(mock.external ?? {}) } } })
    try {
      if (init) await ctx.page.addInitScript(init)
      await goto(ctx.page, typeof route === 'function' ? route(st) : route, { wait })
      await fn(ctx.page, ctx, st)
    } finally {
      await ctx.context.close()
    }
  })
}

const click = async (page, loc, wait = 700) => { await loc.click(); await page.waitForTimeout(wait) }
const tab = (page, name) => page.getByRole('tab', { name })
const btn = (page, name, opts = {}) => page.getByRole('button', { name, ...opts }).or(page.getByRole('tab', { name, ...opts }))
const plus = page => page.locator('button:has(svg.lucide-plus)')

// ================================================================================ Tasks
await visit('tasks tabs', '/todos', {}, async page => {
  for (const [label, file] of [['Overdue', 'overdue'], ['Today', 'today'], ['All', 'all'], ['Done', 'done']]) {
    await click(page, btn(page, label, { exact: true }), 500)
    await shot(page, S + `tasks-${file}-tab${file === 'all' ? '-every-task' : file === 'done' ? '-completed-tasks' : file === 'overdue' ? '-past-due-tasks' : '-due-today'}`)
  }
})
await visit('tasks drawers', '/todos', {}, async page => {
  await click(page, btn(page, 'Upcoming', { exact: true }), 400)
  await plus(page).last().click()
  await page.waitForTimeout(900)
  await shot(page, S + 'tasks-new-task-drawer-open', { mode: 'viewport' })
})
await visit('tasks edit', '/todos', {}, async page => {
  await click(page, btn(page, 'All', { exact: true }), 400)
  await page.locator('button:has(svg.lucide-pencil)').nth(2).click()
  await page.waitForTimeout(900)
  await shot(page, S + 'tasks-edit-task-drawer-open-with-repeat-and-linked-friend', { mode: 'viewport' })
})

// ================================================================================ Calendar
await visit('calendar select day', '/calendar', {}, async page => {
  await click(page, tab(page, 'Month'), 700)
  await page.getByRole('button', { name: /^29/ }).last().click()
  await page.waitForTimeout(600)
  await shot(page, S + 'calendar-month-tab-day-selected-shows-that-days-events', { mode: 'viewport' })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: /^31/ }).first().click()
  await page.waitForTimeout(600)
  await shot(page, S + 'calendar-month-tab-another-day-selected-with-one-event', { mode: 'viewport' })
})
await visit('calendar add event', '/calendar', {}, async page => {
  await plus(page).first().click()
  await page.waitForTimeout(900)
  await shot(page, S + 'calendar-new-event-drawer-open', { mode: 'viewport' })
})
await visit('calendar edit event', '/calendar', {}, async page => {
  const row = page.getByText('Dentist check-up').first().locator('xpath=ancestor::div[.//button[.//*[contains(@class,"lucide-pencil")]]][1]')
  await row.locator('button:has(svg.lucide-pencil)').first().click()
  await page.waitForTimeout(900)
  await shot(page, S + 'calendar-edit-event-drawer-open-with-times-location-and-reminders', { mode: 'viewport' })
})

// ================================================================================ Files
await visit('files folder', '/files', {}, async page => {
  await page.getByText('Documents', { exact: true }).first().click()
  await page.waitForTimeout(800)
  await shot(page, S + 'files-inside-a-folder-documents-file-list')
})
await visit('files drive', '/files', {}, async page => {
  await page.getByText('Work', { exact: true }).first().click()
  await page.waitForTimeout(900)
  await shot(page, S + 'files-inside-a-synced-google-drive-folder')
})
await visit('files new folder', '/files', {}, async page => {
  await page.locator('button:has(svg.lucide-folder-plus)').first().click()
  await page.waitForTimeout(800)
  await shot(page, S + 'files-new-folder-dialog-open', { mode: 'viewport' })
})
await visit('files empty', '/files', { store: (() => { const s = fullStore(); s.files = []; s.google_drive_folders = []; return s })(), mock: { external: { '/api/google-drive-folders': { folders: [] } } } }, async page => {
  await shot(page, S + 'files-empty-state-no-folders-yet', { mode: 'viewport' })
})

// ================================================================================ Converter / Stocks
await visit('converter alert', '/converter', {}, async page => {
  await page.locator('button:has(svg.lucide-bell)').first().click()
  await page.waitForTimeout(900)
  await shot(page, S + 'converter-rate-alert-drawer-open', { mode: 'viewport' })
})
await visit('converter add currency', '/converter', {}, async page => {
  await page.getByText('Add currency').click()
  await page.waitForTimeout(700)
  await shot(page, S + 'converter-add-currency-picker-open', { mode: 'viewport' })
})
await visit('converter pick currency', '/converter', {}, async page => {
  await page.getByText('EUR').first().click()
  await page.waitForTimeout(700)
  await shot(page, S + 'converter-currency-selector-dropdown-open', { mode: 'viewport' })
})
await visit('stocks error', '/stocks', { mock: { external: { '/api/stock-quote': { __status: 502, body: { error: 'UPSTREAM_ERROR' } } } } }, async page => {
  await page.waitForTimeout(500)
  await shot(page, S + 'stocks-quote-could-not-load-error-state', { mode: 'viewport' })
})

// ================================================================================ Settings (sections)
await visit('settings sections', '/settings', {}, async page => {
  const sections = [
    ['Notifications', 'settings-notifications-push-notification-toggle'],
    ['Accounts', 'settings-accounts-connected-google-accounts-and-sign-out'],
    ['Home page', 'settings-home-page-focus-section-toggle-and-default-tab'],
    ['Today widget layout', 'settings-today-widget-layout-reorder-next-up-events-tasks-habits'],
    ['Tomorrow preview', 'settings-tomorrow-preview-banner-start-and-cutoff-times'],
    ['Bottom navigation', 'settings-bottom-navigation-choose-the-three-tab-bar-pages'],
    ['More page layout', 'settings-more-page-layout-sections-and-page-placement'],
    ['Page lock', 'settings-page-lock-choose-locked-pages-and-change-code'],
    ['Focus summaries', 'settings-focus-summaries-auto-refresh-daily-and-on-change'],
    ['Voice shortcuts', 'settings-voice-shortcuts-api-token-for-siri-shortcuts'],
  ]
  const vp = page.viewportSize()
  const total = await page.evaluate(() => document.querySelector('main').scrollHeight)
  await page.setViewportSize({ width: vp.width, height: total + 160 })
  await page.waitForTimeout(500)
  const tops = []
  for (const [title] of sections) {
    const h = page.locator('h2', { hasText: new RegExp(`^${title}$`, 'i') }).first()
    tops.push((await h.boundingBox()).y)
  }
  const contentBottom = await page.evaluate(() => {
    const last = document.querySelector('main > div > div, main > div')
    return last.getBoundingClientRect().bottom
  })
  const fs = await import('node:fs')
  const path = await import('node:path')
  const { OUT } = await import('./lib.mjs')
  for (let i = 0; i < sections.length; i++) {
    const y0 = Math.max(0, tops[i] - 14)
    const y1 = i + 1 < sections.length ? tops[i + 1] - 14 : Math.min(contentBottom, total) + 8
    const file = path.join(OUT, S + sections[i][1] + '.png')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    await page.screenshot({ path: file, clip: { x: 0, y: y0, width: vp.width, height: Math.max(60, y1 - y0) } })
    console.log('  saved', path.relative(OUT, file))
  }
})

// ================================================================================ Friends
await visit('friends add', '/friends', {}, async page => {
  await plus(page).first().click()
  await page.waitForTimeout(900)
  await shot(page, S + 'friends-add-friend-drawer-open', { mode: 'viewport' })
})
await visit('friends history', '/friends', {}, async page => {
  await page.getByText('Yael Mizrahi').first().click()
  await page.waitForTimeout(900)
  await shot(page, S + 'friends-interaction-history-drawer-for-one-friend', { mode: 'viewport' })
})
await visit('friends edit', '/friends', {}, async page => {
  const card = page.getByText('Yael Mizrahi').first()
  const box = await card.boundingBox()
  await page.mouse.move(box.x + 20, box.y + 10)
  await page.mouse.down()
  await page.waitForTimeout(800)
  await page.mouse.up()
  await page.waitForTimeout(800)
  await shot(page, S + 'friends-long-press-actions-menu-edit-and-delete', { mode: 'viewport' })
  await page.getByRole('button', { name: 'Edit' }).click()
  await page.waitForTimeout(900)
  await shot(page, S + 'friends-edit-friend-drawer-with-goal-and-reminder-options', { mode: 'viewport' })
})
await visit('friends log interaction', '/friends', {}, async page => {
  await page.getByTitle('Log interaction').first().click()
  await page.waitForTimeout(900)
  await shot(page, S + 'friends-log-interaction-drawer-open', { mode: 'viewport' })
})
await visit('habits edit', '/habits', {}, async page => {
  await page.locator('button:has(svg.lucide-pencil)').first().click()
  await page.waitForTimeout(900)
  await shot(page, S + 'habits-edit-habit-form-drawer-open', { mode: 'viewport' })
})
await visit('friends empty', '/friends', { store: (() => { const s = fullStore(); s.friends = []; s.friend_interactions = []; return s })() }, async page => {
  await shot(page, S + 'friends-empty-state-no-friends-yet', { mode: 'viewport' })
})

// ================================================================================ Recipes
await visit('recipes collections', '/recipes', {}, async page => {
  await page.getByRole('button', { name: 'Toggle collections' }).click()
  await page.waitForTimeout(700)
  await shot(page, S + 'recipes-collections-rail-open-above-the-recipe-grid')
  await page.getByText('Weekend brunch').first().click()
  await page.waitForTimeout(600)
  await shot(page, S + 'recipes-filtered-to-one-collection-weekend-brunch')
})
await visit('recipes add sheet', '/recipes', {}, async page => {
  await page.getByRole('button', { name: 'Add recipe' }).click()
  await page.waitForTimeout(800)
  await shot(page, S + 'recipes-add-recipe-sheet-manual-import-or-prompt', { mode: 'viewport' })
})
await visit('recipes search', '/recipes', {}, async page => {
  await page.getByPlaceholder(/Search recipes/).fill('pas')
  await page.waitForTimeout(600)
  await shot(page, S + 'recipes-search-results-for-pas', { mode: 'viewport' })
})
await visit('recipe detail', st => `/recipes/${st.recipes[0].id}`, {}, async page => {
  await shot(page, S + 'recipe-detail-shakshuka-with-ingredients-and-steps')
})
await visit('recipe detail scaled', st => `/recipes/${st.recipes[0].id}`, {}, async page => {
  const plusBtn = page.getByRole('button', { name: '+', exact: true }).first()
  await plusBtn.click()
  await plusBtn.click()
  await page.waitForTimeout(500)
  await shot(page, S + 'recipe-detail-servings-scaler-increased-quantities-updated')
})
await visit('recipe editor edit', st => `/recipes/${st.recipes[0].id}/edit`, {}, async page => {
  await shot(page, S + 'recipe-editor-editing-an-existing-recipe')
})
await visit('recipe editor new', '/recipes/new', {}, async page => {
  await shot(page, S + 'recipe-editor-new-blank-recipe')
})
await visit('recipe detail no image', st => `/recipes/${st.recipes.find(r => r.title === 'Israeli Salad').id}`, {}, async page => {
  await shot(page, S + 'recipe-detail-recipe-without-photo-or-steps', { mode: 'viewport' })
})

// ================================================================================ Reading
await visit('reading folder', '/reading', {}, async page => {
  await page.getByText('Sci-fi & fantasy').first().click()
  await page.waitForTimeout(800)
  await shot(page, S + 'reading-inside-a-folder-sci-fi-and-fantasy')
})
await visit('reading nested', '/reading', {}, async page => {
  await page.getByText('Non-fiction').first().click()
  await page.waitForTimeout(700)
  await shot(page, S + 'reading-inside-non-fiction-folder-with-a-subfolder-and-books')
})
await visit('reading add', '/reading', {}, async page => {
  await plus(page).last().click()
  await page.waitForTimeout(800)
  await shot(page, S + 'reading-add-menu-search-book-new-folder', { mode: 'viewport' })
})
await visit('reading search', '/reading', {}, async page => {
  await page.getByPlaceholder(/Search title or author/).fill('dune')
  await page.waitForTimeout(600)
  await shot(page, S + 'reading-list-searched-for-dune', { mode: 'viewport' })
})
await visit('reading book menu', '/reading', {}, async page => {
  await page.locator('button:has(svg.lucide-ellipsis), button:has(svg.lucide-more-horizontal)').nth(2).click().catch(() => {})
  await page.waitForTimeout(700)
  await shot(page, S + 'reading-book-card-menu-open-set-current-mark-read-move', { mode: 'viewport' })
})
await visit('reading empty', '/reading', { store: (() => { const s = fullStore(); s.reading_books = []; s.reading_folders = []; return s })() }, async page => {
  await shot(page, S + 'reading-empty-state-no-books-yet', { mode: 'viewport' })
})

// ================================================================================ RuneScape
await visit('rs goals', '/runescape', {}, async page => {
  await click(page, btn(page, /^Goals/), 700)
  await shot(page, S + 'runescape-goals-tab-skill-quest-and-custom-goals')
})
await visit('rs quests', '/runescape', {}, async page => {
  await click(page, btn(page, /^Quests/), 1000)
  await shot(page, S + 'runescape-quests-tab-completed-started-and-not-started')
})
await visit('rs areas', '/runescape', {}, async page => {
  await click(page, btn(page, /^Areas/), 1000)
  await shot(page, S + 'runescape-areas-tab-diaries-and-exploration-progress')
  await page.locator('h2:has-text("Ardougne")').first().click().catch(async () => { await page.getByText('Ardougne').first().click() })
  await page.waitForTimeout(700)
  await shot(page, S + 'runescape-areas-tab-ardougne-expanded-with-tier-tasks')
})
await visit('rs add goal', '/runescape', {}, async page => {
  await click(page, btn(page, /^Goals/), 600)
  await plus(page).last().click()
  await page.waitForTimeout(900)
  await shot(page, S + 'runescape-add-goal-drawer-open', { mode: 'viewport' })
})
await visit('rs characters', '/runescape', {}, async page => {
  await page.getByRole('button', { name: /BowlSplit/ }).first().click()
  await page.waitForTimeout(800)
  await shot(page, S + 'runescape-character-switcher-menu-open', { mode: 'viewport' })
})
await visit('rs private profile', '/runescape', { mock: { external: { '/api/runescape?kind=profile': { __status: 403, body: { error: 'PROFILE_PRIVATE' } }, '/api/runescape?kind=hiscores': { __status: 404, body: { error: 'NOT_FOUND' } } } } }, async page => {
  await page.waitForTimeout(500)
  await shot(page, S + 'runescape-player-not-found-error-state', { mode: 'viewport' })
})
await visit('rs quest guide', '/runescape/quests/Dragon%20Slayer', {}, async page => {
  await shot(page, S + 'runescape-quest-guide-dragon-slayer-full-guide')
})
await visit('rs quest guide quick', '/runescape/quests/Dragon%20Slayer', {}, async page => {
  const quick = page.getByRole('button', { name: /Quick/i }).first()
  if (await quick.count()) { await quick.click(); await page.waitForTimeout(600) }
  await shot(page, S + 'runescape-quest-guide-dragon-slayer-quick-guide-tab')
})
await visit('rs archaeology', '/runescape/archaeology', {}, async page => {
  await shot(page, S + 'runescape-archaeology-artefacts-tab-hotspots-and-found-counts', { maxHeight: 5000 })
  await click(page, btn(page, 'Mysteries', { exact: true }), 700)
  await shot(page, S + 'runescape-archaeology-mysteries-tab', { maxHeight: 5000 })
  await click(page, btn(page, 'Collections', { exact: true }), 700)
  await shot(page, S + 'runescape-archaeology-collections-tab', { maxHeight: 5000 })
})
await visit('rs pvm', '/runescape/pvm', {}, async page => {
  await shot(page, S + 'runescape-pvm-bossing-path-progress-and-stages', { maxHeight: 5000 })
  await click(page, btn(page, /^Intermediate/), 700)
  await shot(page, S + 'runescape-pvm-intermediate-stage-bosses-and-goals', { maxHeight: 5000 })
  await click(page, btn(page, /^Advanced/), 700)
  await shot(page, S + 'runescape-pvm-advanced-stage-bosses-and-goals', { maxHeight: 5000 })
  await click(page, btn(page, /Notes\s*Guide|^Notes/), 700)
  await shot(page, S + 'runescape-pvm-notes-and-guide-tab', { maxHeight: 5000 })
})
await visit('rs bars', '/runescape/pvm/bars', {}, async page => {
  for (const style of ['Melee', 'Ranged', 'Magic', 'Necromancy']) {
    await click(page, btn(page, style, { exact: true }), 600)
    await shot(page, S + `runescape-ability-bars-${style.toLowerCase()}-single-and-multi-target`, { maxHeight: 4000 })
  }
})

// ---- extra states
await visit('recipes import', '/recipes', {}, async page => {
  await page.getByRole('button', { name: 'Add recipe' }).click()
  await page.waitForTimeout(700)
  for (const [label, file] of [['Prompt to recipe', 'prompt-to-recipe'], ['Paste recipe text', 'paste-recipe-text'], ['Paste a link', 'paste-a-link']]) {
    await run(`recipes import ${label}`, async () => {
      await page.getByText(label, { exact: true }).click()
      await page.waitForTimeout(800)
      await shot(page, S + `recipes-import-dialog-${file}`, { mode: 'viewport' })
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)
      if (!(await page.getByText(label, { exact: true }).count())) await page.getByRole('button', { name: 'Add recipe' }).click()
      await page.waitForTimeout(600)
    })
  }
})
await visit('wealth extra', '/wealth', {}, async page => {
  const key = n => page.getByRole('button', { name: String(n), exact: true })
  for (const n of [0, 0, 0, 0]) await key(n).click()
  await page.waitForTimeout(1500)
  await page.getByText('Leumi checking').first().click()
  await page.waitForTimeout(900)
  await shot(page, S + 'wealth-edit-account-drawer-balance-history-and-delete', { mode: 'viewport' })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'Goals', exact: true }).click()
  await page.waitForTimeout(500)
  await page.locator('button:has(svg.lucide-plus)').last().click()
  await page.waitForTimeout(900)
  await shot(page, S + 'wealth-add-goal-drawer-open', { mode: 'viewport' })
})
await visit('shopping drawer', '/shopping', {}, async page => {
  await plus(page).last().click()
  await page.waitForTimeout(800)
  await shot(page, S + 'shopping-new-item-drawer-open', { mode: 'viewport' })
})
await visit('shopping empty', '/shopping', { store: (() => { const s = fullStore(); s.shopping_items = []; return s })() }, async page => {
  await shot(page, S + 'shopping-empty-state-nothing-to-buy', { mode: 'viewport' })
})
await visit('tasks empty', '/todos', { store: (() => { const s = fullStore(); s.todos = []; return s })() }, async page => {
  await shot(page, S + 'tasks-empty-state-no-tasks', { mode: 'viewport' })
})
await visit('habits empty', '/habits', { store: (() => { const s = fullStore(); s.habits = []; s.habit_status = []; s.habit_logs = []; return s })() }, async page => {
  await shot(page, S + 'habits-empty-state-no-habits-yet', { mode: 'viewport' })
})
await visit('climbing empty history', '/climbing', { store: (() => { const s = fullStore(); s.climbing_sessions = []; s.climbing_attempts = []; return s })() }, async page => {
  await click(page, tab(page, 'History'), 600)
  await shot(page, S + 'climbing-history-tab-empty-no-sessions-yet', { mode: 'viewport' })
  await click(page, tab(page, 'Stats'), 800)
  await shot(page, S + 'climbing-stats-tab-empty-no-sessions-yet', { mode: 'viewport' })
})
await visit('calendar empty', '/calendar', { store: (() => { const s = fullStore(); s.events = []; return s })() }, async page => {
  await shot(page, S + 'calendar-list-tab-empty-no-upcoming-events', { mode: 'viewport' })
})
await visit('files menu', '/files', {}, async page => {
  await page.getByText('Documents', { exact: true }).first().click()
  await page.waitForTimeout(700)
  await page.locator('button:has(svg.lucide-ellipsis-vertical), button:has(svg.lucide-more-vertical)').first().click()
  await page.waitForTimeout(700)
  await shot(page, S + 'files-file-actions-menu-open-rename-star-delete', { mode: 'viewport' })
})
await visit('reading search drawer', '/reading', {}, async page => {
  await plus(page).last().click()
  await page.waitForTimeout(700)
  await page.getByText('Search for a book').click()
  await page.waitForTimeout(900)
  await shot(page, S + 'reading-search-for-a-book-drawer-open', { mode: 'viewport' })
})
await visit('games edit', '/games', {}, async page => {
  const card = page.getByText('Dice Roller').first()
  const box = await card.boundingBox()
  await page.mouse.move(box.x + 20, box.y + 10)
  await page.mouse.down()
  await page.waitForTimeout(800)
  await page.mouse.up()
  await page.waitForTimeout(900)
  await shot(page, S + 'games-long-press-edit-utility-drawer', { mode: 'viewport' })
})

// ================================================================================ Meals
await visit('meals all', '/meals', {}, async page => {
  await click(page, btn(page, 'All', { exact: true }), 600)
  await shot(page, S + 'meal-ideas-all-meals-filter')
})
await visit('meals breakfast', '/meals?tag=breakfast', {}, async page => {
  await shot(page, S + 'meal-ideas-breakfast-filter', { mode: 'viewport' })
})
await visit('meals random', '/meals', {}, async page => {
  await btn(page, /Random/).click()
  await page.waitForTimeout(1000)
  await shot(page, S + 'meal-ideas-random-meal-suggestion-drawer', { mode: 'viewport' })
})
await visit('meals share', '/meals', {}, async page => {
  await page.locator('button:has(svg.lucide-share-2)').first().click()
  await page.waitForTimeout(1000)
  await shot(page, S + 'meal-ideas-share-picker-link-drawer-with-active-links', { mode: 'viewport' })
})
await visit('meals add', '/meals', {}, async page => {
  await plus(page).last().click()
  await page.waitForTimeout(900)
  await shot(page, S + 'meal-ideas-add-meal-drawer-open', { mode: 'viewport' })
})
await visit('meals search', '/meals?tag=all', {}, async page => {
  await page.getByPlaceholder(/Search meals/).fill('xyz')
  await page.waitForTimeout(500)
  await shot(page, S + 'meal-ideas-search-with-no-results', { mode: 'viewport' })
})
await visit('meal detail', st => `/meals/${st.meals[0].id}`, {}, async page => {
  await shot(page, S + 'meal-detail-meal-linked-to-a-recipe')
})
await visit('meal detail plain', st => `/meals/${st.meals[4].id}`, {}, async page => {
  await shot(page, S + 'meal-detail-meal-with-photo-and-no-recipe')
})

// ================================================================================ Workout / Games / PDF
await visit('workout empty', '/workout', { store: (() => { const s = fullStore(); s.workout_logs = []; s.workout_log_exercises = []; return s })() }, async page => {
  await click(page, tab(page, 'History'), 600)
  await shot(page, S + 'workout-history-tab-empty-no-workouts-logged', { mode: 'viewport' })
})
await visit('workout preset editor', '/workout?tab=settings', {}, async page => {
  await btn(page, /New preset/).click()
  await page.waitForTimeout(900)
  await shot(page, S + 'workout-settings-new-preset-drawer-open', { mode: 'viewport' })
})
await visit('workout history edit', '/workout?tab=history', {}, async page => {
  await page.locator('button:has(svg.lucide-pencil)').first().click()
  await page.waitForTimeout(900)
  await shot(page, S + 'workout-history-edit-logged-workout-drawer', { mode: 'viewport' })
})
await visit('dice one', '/games/dice', {}, async page => {
  await click(page, btn(page, '1 die'), 500)
  await shot(page, S + 'games-dice-roller-single-die', { mode: 'viewport' })
})
await visit('pdf tools', '/pdf-tools', {}, async page => {
  for (const [name, file] of [['Split PDF', 'split'], ['Extract pages', 'extract-pages'], ['Remove pages', 'remove-pages'], ['Rotate PDF', 'rotate'], ['Images to PDF', 'images-to-pdf'], ['Watermark', 'watermark']]) {
    await click(page, btn(page, name, { exact: true }), 500)
    await shot(page, S + `pdf-tools-${file}-tool-selected`, { mode: 'viewport' })
  }
})

// ================================================================================ Shared meal picker (public)
const sharedList = (st, over = {}) => ({
  tag: 'dinner', expires_at: new Date(Date.parse('2026-10-29T10:30:00+02:00') + 20 * 3600e3).toISOString(), picked_meal_id: null,
  meals: st.meals.filter(m => m.tags.includes('dinner')).map(m => ({ id: m.id, name: m.name, description: m.description, tags: m.tags, image_url: m.image_url ?? m.recipe?.image_url ?? null })), ...over,
})
await visit('picker ready', '/pick/abc123', { signedIn: false, init: () => { Math.random = () => 0.1 }, mock: { rpc: { get_meal_share: (_, st) => sharedList(st) } } }, async page => {
  await shot(page, S + 'shared-meal-picker-public-link-choose-a-dinner', { mode: 'viewport' })
})
await visit('picker picked', '/pick/abc123', { signedIn: false, init: () => { Math.random = () => 0.1 }, mock: { rpc: { get_meal_share: (_, st) => sharedList(st), pick_meal_share: 'ok' } } }, async page => {
  await page.getByRole('button', { name: 'This one!' }).click()
  await page.waitForTimeout(900)
  await shot(page, S + 'shared-meal-picker-pick-sent-confirmation', { mode: 'viewport' })
})
await visit('picker already', '/pick/def456', { signedIn: false, mock: { rpc: { get_meal_share: (_, st) => sharedList(st, { picked_meal_id: st.meals[1].id }) } } }, async page => {
  await shot(page, S + 'shared-meal-picker-link-already-has-a-pick', { mode: 'viewport' })
})
await visit('picker invalid', '/pick/nope', { signedIn: false, mock: { rpc: { get_meal_share: null } } }, async page => {
  await shot(page, S + 'shared-meal-picker-invalid-or-expired-link', { mode: 'viewport' })
})
await visit('picker error', '/pick/boom', { signedIn: false, mock: { rpc: { get_meal_share: { bad: 'payload' } } } }, async page => {
  await shot(page, S + 'shared-meal-picker-could-not-load-retry', { mode: 'viewport' })
})

await closeBrowser()
