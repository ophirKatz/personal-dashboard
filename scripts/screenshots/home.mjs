import { openPage, goto, shot, shotEl, settle, run, closeBrowser, BASE, DESKTOP, MOBILE } from './lib.mjs'
import { buildSeed, d, iso, mk, focusSummary, WEATHER, U, FOCUS_WEEK, FOCUS_TOMORROW, habitStatus } from './seed.mjs'

const only = process.argv[2] // optional name filter
const H = 'home/'

const todayCard = page => page.locator('div.rounded-xl', { has: page.locator('h2', { hasText: /^(Today|Tomorrow)$/ }) }).first()
const workoutCard = page => page.locator('div.rounded-xl', { has: page.locator('h2', { hasText: /^Workout$/ }) }).first()
const readingCard = page => page.locator('div.rounded-xl', { has: page.locator('h2', { hasText: /^Currently reading$/ }) }).first()
const focusBlock = page => page.locator('div.space-y-3', { has: page.locator('h2', { hasText: /^Focus$/ }) }).first()
const quickLinks = page => page.locator('div.grid.grid-cols-2').first()

// ---- seed helpers ---------------------------------------------------------------------------
function withWorkout(store, { days = [], extraToday = 0, start = d(-9) }) {
  const ex = ['push_ups', 'sit_ups', 'squats'].map((key, i) => mk.row({ name: key.replace('_', ' '), icon: key, builtin_key: key, created_at: iso(-20, `10:0${i}`) }))
  store.workout_exercises = ex
  const preset = mk.row({ name: 'Home routine', is_default: true })
  store.workout_presets = [preset]
  store.workout_preset_exercises = ex.map((e, i) => ({ id: mk.id(), user_id: U, preset_id: preset.id, exercise_id: e.id, sets: 3, reps: 12 + i * 3, position: i }))
  store.workout_settings[0].tracking_start_date = start
  const all = [...days, ...Array(extraToday).fill(0)]
  store.workout_logs = all.map(n => mk.row({ preset_id: preset.id, preset_name: 'Home routine', log_date: d(n), notes: null }))
}

function withReading(store, { readDays = [], finished = false, noCurrent = false }) {
  const cover = (idn, title) => `https://covers.openlibrary.org/b/id/${idn}-M.jpg#${encodeURIComponent(title)}`
  store.reading_books = [
    mk.row({ folder_id: null, ol_key: '/works/OL1', title: 'Project Hail Mary', author: 'Andy Weir', cover_url: cover(101, 'Project Hail Mary'), first_publish_year: 2021, is_read: finished, read_at: finished ? iso(0, '09:50') : null, is_current: !noCurrent }),
    mk.row({ folder_id: null, ol_key: '/works/OL2', title: 'The Pragmatic Programmer', author: 'Andrew Hunt, David Thomas', cover_url: cover(102, 'The Pragmatic Programmer'), first_publish_year: 1999, is_read: false, read_at: null, is_current: false }),
    mk.row({ folder_id: null, ol_key: '/works/OL3', title: 'Dune', author: 'Frank Herbert', cover_url: cover(103, 'Dune'), first_publish_year: 1965, is_read: false, read_at: null, is_current: false }),
  ]
  store.reading_days = readDays.map(n => mk.row({ day: d(n) }))
}

const coverLabels = { 101: 'Project Hail Mary', 102: 'The Pragmatic Programmer', 103: 'Dune' }
const mockBase = { external: { coverLabels } }

async function scenario(name, { store = buildSeed(), now, viewport, mock = {}, wait = 1000, route = '/', settleNetwork = true }, fn) {
  if (only && !name.includes(only)) return
  await run(name, async () => {
    const ctx = await openPage(store, { now, viewport, mock: { ...mockBase, ...mock, external: { ...mockBase.external, ...(mock.external ?? {}) } } })
    try {
      await goto(ctx.page, route, { wait, settleNetwork })
      await fn(ctx.page, ctx)
    } finally {
      await ctx.context.close()
    }
  })
}

// =================================================================================================
// Whole-page states
// =================================================================================================

await scenario('page: loading', {
  mock: { delayMs: { todos: 20000, events: 20000, shopping_items: 20000, habit_status: 20000, habits: 20000, notifications: 20000, friends: 20000 } },
  wait: 1200, settleNetwork: false,
}, async page => {
  await shot(page, H + 'home-page-loading-spinner-and-skeleton-quick-links', { mode: 'viewport' })
})

await scenario('page: empty', {
  store: (() => { const s = buildSeed(); for (const k of ['habit_status', 'habits', 'todos', 'events', 'shopping_items', 'focus_summaries', 'weather_cache']) s[k] = []; return s })(),
}, async page => {
  await shot(page, H + 'home-page-empty-state-welcome-no-habits-tasks-or-events')
})

await scenario('page: populated', { store: (() => {
  const s = buildSeed()
  withWorkout(s, { days: [-1, -2, -3, -4], start: d(-4) })
  withReading(s, { readDays: [-1, -2, 0] })
  return s
})() }, async page => {
  await shot(page, H + 'home-page-populated-full-length-morning')
  await shot(page, H + 'home-page-populated-above-the-fold-phone-screen', { mode: 'viewport' })
})

await scenario('page: desktop', { viewport: DESKTOP, store: (() => {
  const s = buildSeed(); withWorkout(s, { days: [-1, -2, -3, -4], start: d(-4) }); withReading(s, { readDays: [-1, -2] }); return s
})() }, async page => {
  await shot(page, H + 'home-page-desktop-width-with-left-sidebar-navigation', { mode: 'viewport' })
})

// Greeting + time of day --------------------------------------------------------------------------
await scenario('greeting: afternoon', { now: '2026-10-29T14:20:00+02:00' }, async page => {
  await shotEl(page, page.locator('h1').first().locator('..'), H + 'home-greeting-good-afternoon-after-noon')
})
await scenario('greeting: evening + tomorrow banner', { now: '2026-10-29T21:30:00+02:00' }, async page => {
  await shotEl(page, page.locator('h1').first().locator('..'), H + 'home-greeting-good-evening-after-5pm')
  await shotEl(page, todayCard(page), H + 'home-today-card-evening-with-tomorrow-summary-banner')
})

// =================================================================================================
// Quick links
// =================================================================================================
await scenario('quick links: normal', {}, async page => {
  await shotEl(page, quickLinks(page), H + 'home-quick-links-shopping-items-count-and-next-climbing-session')
})
await scenario('quick links: nothing', {
  store: (() => { const s = buildSeed(); s.shopping_items.forEach(i => (i.checked = true)); s.events = s.events.filter(e => !e.title.includes('טיפוס')); return s })(),
}, async page => {
  await shotEl(page, quickLinks(page), H + 'home-quick-links-nothing-to-buy-and-no-climbing-session-scheduled')
})
await scenario('quick links: climbing today', {
  store: (() => { const s = buildSeed(); s.shopping_items = s.shopping_items.slice(0, 1); s.events.push(mk.event('אימון טיפוס', { event_time: '18:00:00', event_end_time: '20:00:00' })); return s })(),
}, async page => {
  await shotEl(page, quickLinks(page), H + 'home-quick-links-one-item-to-buy-and-climbing-today-at-6pm')
})
await scenario('quick links: errors', { mock: { failTables: ['shopping_items'] }, store: (() => { const s = buildSeed(); s.events = []; return s })() }, async page => {
  await shotEl(page, quickLinks(page), H + 'home-quick-links-query-failed-dash-placeholders')
})
await scenario('quick links: shopping drawer', {}, async page => {
  await page.getByRole('button', { name: 'Add shopping item' }).click()
  await page.waitForTimeout(700)
  await shot(page, H + 'home-quick-add-shopping-item-drawer-open', { mode: 'viewport' })
})
await scenario('quick links: climbing drawer', {}, async page => {
  await page.getByRole('button', { name: 'Log climbing session' }).click()
  await page.waitForTimeout(700)
  await shot(page, H + 'home-quick-log-climbing-session-drawer-open', { mode: 'viewport' })
})
await scenario('header: add task drawer', {}, async page => {
  await page.getByRole('button', { name: 'Add task' }).click()
  await page.waitForTimeout(800)
  await shot(page, H + 'home-add-task-drawer-open-from-plus-button', { mode: 'viewport' })
})

// =================================================================================================
// Notifications
// =================================================================================================
await scenario('notifications', {
  store: (() => {
    const s = buildSeed()
    s.notifications = [
      mk.row({ type: 'friend_reminder', title: 'Time to catch up with Dana', message: "It's been 3 weeks since you last talked.", read: false, created_at: iso(0, '08:00') }),
      mk.row({ type: 'stock_alert', title: 'AAPL hit your target', message: 'AAPL is now $230.12 (target: above $230).', read: false, created_at: iso(0, '07:30') }),
    ]
    return s
  })(),
}, async page => {
  await shot(page, H + 'home-notifications-banners-friend-reminder-and-stock-alert', { mode: 'viewport' })
})

// =================================================================================================
// Today card
// =================================================================================================
await scenario('today: next up low', { now: '2026-10-29T08:00:00+02:00' }, async page => {
  await shotEl(page, todayCard(page), H + 'home-today-next-up-banner-low-urgency-over-1-hour-away-blue')
})
await scenario('today: next up medium', { now: '2026-10-29T10:30:00+02:00' }, async page => {
  await shotEl(page, todayCard(page), H + 'home-today-next-up-banner-medium-urgency-within-1-hour-amber')
})
await scenario('today: next up high', { now: '2026-10-29T10:50:00+02:00' }, async page => {
  await shotEl(page, todayCard(page), H + 'home-today-next-up-banner-high-urgency-within-15-min-red')
})
await scenario('today: next up task', {
  now: '2026-10-29T13:45:00+02:00',
  store: (() => { const s = buildSeed(); s.events = s.events.filter(e => !['Dentist check-up', 'Yoga class'].includes(e.title)); return s })(),
}, async page => {
  await shotEl(page, todayCard(page), H + 'home-today-next-up-banner-for-a-timed-task-reply-to-landlord')
})
await scenario('today: no next up + past events hidden', { now: '2026-10-29T19:45:00+02:00' }, async page => {
  await shotEl(page, todayCard(page), H + 'home-today-evening-finished-events-hidden-no-next-up-banner')
})
await scenario('today: events expanded', {}, async page => {
  const card = todayCard(page)
  await card.getByRole('button', { name: /Design review/ }).first().click()
  await page.waitForTimeout(500)
  await shotEl(page, card, H + 'home-today-event-tapped-to-expand-shows-location')
})
await scenario('today: event video link shows room', { now: '2026-10-29T09:00:00+02:00' }, async page => {
  const card = todayCard(page)
  await card.getByRole('button', { name: /Stand-up/ }).first().click()
  await page.waitForTimeout(500)
  await shotEl(page, card, H + 'home-today-event-with-video-call-link-shows-booked-room-instead')
})
await scenario('today: show more events and tasks', {}, async page => {
  const card = todayCard(page)
  await card.getByRole('button', { name: /\+2 more/ }).first().click()
  await card.getByRole('button', { name: /\+2 more/ }).first().click()
  await page.waitForTimeout(600)
  await shotEl(page, card, H + 'home-today-plus-more-expanded-all-events-and-tasks-visible')
})
await scenario('today: postpone menu', {}, async page => {
  await todayCard(page).getByTitle('Postpone').first().click()
  await page.waitForTimeout(800)
  await shot(page, H + 'home-today-overdue-task-postpone-menu-open', { mode: 'viewport' })
})
await scenario('today: complete task', {}, async page => {
  const card = todayCard(page)
  await card.getByTitle('Mark complete').nth(1).click()
  await page.waitForTimeout(160)
  await shotEl(page, card, H + 'home-today-task-just-completed-checkmark-and-strikethrough')
})
await scenario('today: habits row', {}, async page => {
  await shotEl(page, todayCard(page).locator('div.space-y-2', { has: page.locator('span', { hasText: /^Habits$/ }) }).last(), H + 'home-today-habits-row-done-partially-done-and-owed-badges')
})
await scenario('today: habit tapped', {}, async page => {
  await todayCard(page).getByRole('button', { name: /Stretch/ }).click()
  await page.waitForTimeout(250)
  await shot(page, H + 'home-today-habit-tapped-confetti-celebration', { mode: 'viewport' })
})
await scenario('today: tomorrow page', {}, async page => {
  await todayCard(page).getByRole('button', { name: /^Tomorrow/ }).click()
  await page.waitForTimeout(800)
  await shotEl(page, todayCard(page), H + 'home-today-card-switched-to-tomorrow-page-events-and-tasks')
})
await scenario('today: tomorrow empty', {
  store: (() => { const s = buildSeed(); s.events = s.events.filter(e => e.event_date === d(0)); s.todos = s.todos.filter(t => t.due_date !== d(1)); return s })(),
}, async page => {
  await todayCard(page).getByRole('button', { name: /^Tomorrow/ }).click()
  await page.waitForTimeout(800)
  await shotEl(page, todayCard(page), H + 'home-today-card-tomorrow-page-empty-no-events-nothing-due')
})
await scenario('today: empty', {
  store: (() => { const s = buildSeed(); s.events = []; s.todos = []; s.habit_status = s.habit_status.slice(0, 2); return s })(),
}, async page => {
  await shotEl(page, todayCard(page), H + 'home-today-card-empty-no-events-nothing-due-habits-only')
})
await scenario('today: custom order', {
  store: (() => { const s = buildSeed(); s.user_settings = [mk.row({ today_sections_order: ['habits', 'tasks', 'events', 'next_up'] })]; return s })(),
}, async page => {
  await shotEl(page, todayCard(page), H + 'home-today-card-custom-section-order-habits-tasks-events')
})

// Weather ------------------------------------------------------------------------------------------
const weatherRow = x => ({ ...WEATHER, ...x })
const headerCrop = page => todayCard(page).locator('> div').first()
await scenario('weather: min max', {}, async page => {
  await page.getByTitle('Low/High temperature').click()
  await page.waitForTimeout(300)
  await shotEl(page, headerCrop(page), H + 'home-today-weather-tapped-shows-low-high-range')
})
await scenario('weather: hot', { store: (() => { const s = buildSeed(); s.weather_cache = [weatherRow({ temperature: 36.4 })]; return s })() }, async page => {
  await shotEl(page, headerCrop(page), H + 'home-today-weather-hot-36c-red')
})
await scenario('weather: cold', { store: (() => { const s = buildSeed(); s.weather_cache = [weatherRow({ temperature: 4.1 })]; return s })() }, async page => {
  await shotEl(page, headerCrop(page), H + 'home-today-weather-cold-4c-blue')
})
await scenario('weather: stale', { store: (() => { const s = buildSeed(); s.weather_cache = [weatherRow({ status: 'error', error: 'upstream timeout', fetched_at: iso(0, '03:10') })]; return s })() }, async page => {
  await shotEl(page, headerCrop(page), H + 'home-today-weather-stale-refresh-failed-last-known-reading-warning')
})
await scenario('weather: unavailable', { store: (() => { const s = buildSeed(); s.weather_cache = []; return s })() }, async page => {
  await shotEl(page, headerCrop(page), H + 'home-today-weather-unavailable-no-reading-yet')
})
await scenario('weather: loading', { mock: { delayMs: { weather_cache: 20000 } }, wait: 1500, settleNetwork: false }, async page => {
  await shotEl(page, headerCrop(page), H + 'home-today-weather-loading-skeleton-pulse')
})

// Tomorrow summary banner --------------------------------------------------------------------------
await scenario('banner: items', { now: '2026-10-29T21:30:00+02:00' }, async page => {
  await shotEl(page, todayCard(page), H + 'home-today-tomorrow-summary-banner-after-9pm-lists-items-before-noon')
})
await scenario('banner: many', {
  now: '2026-10-29T22:10:00+02:00',
  store: (() => { const s = buildSeed(); for (const [i, t] of ['Gym', 'Pack suitcase', 'Charge devices', 'Print boarding pass'].entries()) s.todos.push(mk.todo(t, { due_date: d(1), due_time: `0${6 + i}:00:00` })); return s })(),
}, async page => {
  await shotEl(page, todayCard(page), H + 'home-today-tomorrow-summary-banner-more-than-4-items-plus-n-more')
})
await scenario('banner: nothing', {
  now: '2026-10-29T21:30:00+02:00',
  store: (() => { const s = buildSeed(); s.events = s.events.filter(e => e.event_date === d(0)); s.todos = s.todos.filter(t => t.due_date !== d(1)); return s })(),
}, async page => {
  await shotEl(page, todayCard(page), H + 'home-today-tomorrow-summary-banner-nothing-scheduled')
})
await scenario('banner: dismissed', { now: '2026-10-29T21:30:00+02:00' }, async page => {
  await page.getByRole('button', { name: 'Dismiss tomorrow summary' }).click()
  await page.waitForTimeout(500)
  await shotEl(page, todayCard(page), H + 'home-today-tomorrow-summary-banner-dismissed-for-the-night')
})
await scenario('banner: custom window', {
  now: '2026-10-29T19:30:00+02:00',
  store: (() => { const s = buildSeed(); s.user_settings = [mk.row({ tomorrow_banner_start: '19:00:00', tomorrow_banner_end: '18:00:00' })]; return s })(),
}, async page => {
  await shotEl(page, todayCard(page), H + 'home-today-tomorrow-summary-banner-custom-window-7pm-until-6pm')
})

// =================================================================================================
// Workout widget
// =================================================================================================
await scenario('workout: nudge no streak', { store: (() => { const s = buildSeed(); withWorkout(s, { days: [], start: d(0) }); return s })() }, async page => {
  await shotEl(page, workoutCard(page), H + 'home-workout-widget-nudge-no-workout-today-no-streak-yet')
})
await scenario('workout: nudge streak', { store: (() => { const s = buildSeed(); withWorkout(s, { days: [-1, -2, -3, -4, -6], start: d(-6) }); return s })() }, async page => {
  await shotEl(page, workoutCard(page), H + 'home-workout-widget-nudge-with-4-day-streak-and-week-dots')
})
await scenario('workout: owed', { store: (() => { const s = buildSeed(); withWorkout(s, { days: [-1, -4], start: d(-6) }); return s })() }, async page => {
  await shotEl(page, workoutCard(page), H + 'home-workout-widget-missed-workouts-owed-shown-in-red')
})
await scenario('workout: evening', { now: '2026-10-29T21:15:00+02:00', store: (() => { const s = buildSeed(); withWorkout(s, { days: [-1, -2, -3], start: d(-3) }); return s })() }, async page => {
  await shotEl(page, workoutCard(page), H + 'home-workout-widget-evening-streak-ends-at-midnight-warning')
})
await scenario('workout: compact done', { store: (() => { const s = buildSeed(); withWorkout(s, { days: [0, -1, -2, -3], start: d(-3) }); return s })() }, async page => {
  const c = page.locator('div.rounded-xl', { has: page.getByRole('button', { name: 'Log extra' }) }).first()
  await shotEl(page, c, H + 'home-workout-widget-compact-done-today-with-streak-and-log-extra')
})
await scenario('workout: compact multiple + owed', { store: (() => { const s = buildSeed(); withWorkout(s, { days: [0, -1, -4, -5], extraToday: 1, start: d(-5) }); return s })() }, async page => {
  const c = page.locator('div.rounded-xl', { has: page.getByRole('button', { name: 'Log extra' }) }).first()
  await shotEl(page, c, H + 'home-workout-widget-compact-two-workouts-today-and-owed-count')
})
await scenario('workout: log drawer', { store: (() => { const s = buildSeed(); withWorkout(s, { days: [-1, -2], start: d(-2) }); return s })() }, async page => {
  await workoutCard(page).getByRole('button', { name: /Time for|Get your|A quick|Your future|Ten minutes|Keep your|streak ends/ }).first().click()
  await page.waitForTimeout(900)
  await shot(page, H + 'home-workout-widget-log-workout-drawer-open-with-preset-exercises', { mode: 'viewport' })
})
await scenario('workout: pick past day', { store: (() => { const s = buildSeed(); withWorkout(s, { days: [-1, -2, -4], start: d(-4) }); return s })() }, async page => {
  await workoutCard(page).getByRole('button', { name: /no workout/ }).first().click()
  await page.waitForTimeout(900)
  await shot(page, H + 'home-workout-widget-tapping-a-past-day-dot-opens-log-drawer-for-that-day', { mode: 'viewport' })
})

// =================================================================================================
// Currently reading widget
// =================================================================================================
await scenario('reading: nudge', { store: (() => { const s = buildSeed(); withReading(s, { readDays: [-1, -2, -3] }); return s })() }, async page => {
  await shotEl(page, readingCard(page), H + 'home-reading-widget-current-book-not-read-yet-today-nudge-and-streak')
})
await scenario('reading: no streak', { store: (() => { const s = buildSeed(); withReading(s, { readDays: [] }); return s })() }, async page => {
  await shotEl(page, readingCard(page), H + 'home-reading-widget-current-book-no-streak-start-today')
})
await scenario('reading: read today', { store: (() => { const s = buildSeed(); withReading(s, { readDays: [0, -1, -2, -3, -5] }); return s })() }, async page => {
  await shotEl(page, readingCard(page), H + 'home-reading-widget-read-today-green-banner-with-streak')
})
await scenario('reading: evening', { now: '2026-10-29T21:00:00+02:00', store: (() => { const s = buildSeed(); withReading(s, { readDays: [-1, -2, -3] }); return s })() }, async page => {
  await shotEl(page, readingCard(page), H + 'home-reading-widget-evening-streak-ends-at-midnight-warning')
})
await scenario('reading: finished', { store: (() => { const s = buildSeed(); withReading(s, { finished: true }); return s })() }, async page => {
  await shotEl(page, readingCard(page), H + 'home-reading-widget-book-finished-choose-next-book-or-dismiss')
})
await scenario('reading: pick next', { store: (() => { const s = buildSeed(); withReading(s, { finished: true }); return s })() }, async page => {
  await page.getByRole('button', { name: 'Choose next book' }).click()
  await page.waitForTimeout(900)
  await shot(page, H + 'home-reading-widget-choose-next-book-drawer-open', { mode: 'viewport' })
})
await scenario('reading: hidden', { store: (() => { const s = buildSeed(); withReading(s, { noCurrent: true }); return s })() }, async page => {
  await shot(page, H + 'home-page-without-reading-widget-when-no-current-book')
})

// =================================================================================================
// Focus section
// =================================================================================================
await scenario('focus: week', {}, async page => {
  await shotEl(page, focusBlock(page), H + 'home-focus-this-week-tab-ai-summary-cards')
})
await scenario('focus: tomorrow', {}, async page => {
  await focusBlock(page).getByRole('tab', { name: 'Tomorrow' }).click()
  await page.waitForTimeout(500)
  await shotEl(page, focusBlock(page), H + 'home-focus-tomorrow-tab-ai-summary-cards')
})
await scenario('focus: generating', {
  store: (() => { const s = buildSeed(); s.focus_summaries = []; return s })(),
  mock: { functions: { 'generate-focus-summary': async () => { await new Promise(r => setTimeout(r, 15000)); return {} } } },
}, async page => {
  await page.waitForTimeout(800)
  await shotEl(page, focusBlock(page), H + 'home-focus-generating-summary-spinner')
})
await scenario('focus: no summary', {
  store: (() => { const s = buildSeed(); s.focus_summaries = []; s.user_settings = [mk.row({ auto_generate_focus_summaries_on_change_week: false, auto_generate_focus_summaries_on_change_today: false })]; return s })(),
}, async page => {
  await shotEl(page, focusBlock(page), H + 'home-focus-no-summary-yet-auto-generate-turned-off')
})
await scenario('focus: error', {
  store: (() => { const s = buildSeed(); s.focus_summaries = [focusSummary('week', null, { summary: null, status: 'error', error: 'boom' })]; s.user_settings = [mk.row({ auto_generate_focus_summaries_on_change_week: false })]; return s })(),
}, async page => {
  await shotEl(page, focusBlock(page), H + 'home-focus-error-could-not-generate-summary')
})
await scenario('focus: text', {
  store: (() => { const s = buildSeed(); s.focus_summaries = [focusSummary('week', { type: 'text', text: 'You have 5 tasks and 8 events this week.\nPrioritise the passport renewal and the expense report; the rest can slide.' })]; return s })(),
}, async page => {
  await shotEl(page, focusBlock(page), H + 'home-focus-plain-text-summary-legacy-format')
})
await scenario('focus: nothing', {
  store: (() => { const s = buildSeed(); s.focus_summaries = [focusSummary('week', { type: 'cards', cards: [], note: 'Clear week ahead — enjoy the downtime.' })]; return s })(),
}, async page => {
  await shotEl(page, focusBlock(page), H + 'home-focus-nothing-to-focus-on-clear-week-note')
})
await scenario('focus: hidden', {
  store: (() => { const s = buildSeed(); s.user_settings = [mk.row({ show_focus_section: false })]; return s })(),
}, async page => {
  await shot(page, H + 'home-page-with-focus-section-hidden-in-settings')
})

// =================================================================================================
// Navigation
// =================================================================================================
await scenario('nav: more panel', {}, async page => {
  await page.locator('nav').getByRole('button', { name: 'More' }).click()
  await page.waitForTimeout(600)
  await shot(page, H + 'home-more-menu-open-default-sections-leisure-money-everything-else', { mode: 'viewport' })
})
await scenario('nav: custom bar', {
  store: (() => {
    const s = buildSeed()
    s.user_settings = [mk.row({
      bottom_nav_items: ['habits', 'shopping', 'friends'],
      more_sections: [{ id: 'a', title: 'Daily', items: ['todos', 'calendar', 'workout'] }, { id: 'b', title: 'Everything else', items: ['files', 'climbing', 'reading', 'runescape', 'games', 'wealth', 'converter', 'stocks', 'recipes', 'meals', 'pdf'] }],
    })]
    return s
  })(),
}, async page => {
  await shot(page, H + 'home-custom-bottom-bar-habits-shopping-friends', { mode: 'viewport' })
  await page.locator('nav').getByRole('button', { name: 'More' }).click()
  await page.waitForTimeout(600)
  await shot(page, H + 'home-more-menu-open-custom-sections-daily-and-everything-else', { mode: 'viewport' })
})

await closeBrowser()
