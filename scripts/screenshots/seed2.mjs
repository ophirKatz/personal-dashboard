// Extra seed data for the non-Home pages. Mutates the store from buildSeed().
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { d, iso, mk, U, habitStatus } from './seed.mjs'

const row = mk.row
const id = mk.id

export const coverLabels = {
  101: 'Project Hail Mary', 102: 'The Pragmatic Programmer', 103: 'Dune', 104: 'Atomic Habits', 105: 'Sapiens',
  106: 'The Hobbit', 107: 'Educated', 108: 'Deep Work', 109: 'Thinking, Fast and Slow',
}
const cover = (n) => `https://covers.openlibrary.org/b/id/${n}-M.jpg`

export function seedFriends(s) {
  const mkF = (name, extra = {}) => row({ name, notes: null, details: null, avatar_url: null, goal_count: 2, goal_unit: 'week', goal_mode: 'interval', reminder_enabled: true, last_notified_date: null, reminder_notified_at: null, ...extra })
  const dana = mkF('Dana Cohen', { goal_count: 1, goal_unit: 'week', notes: 'Met at university. Loves climbing and bad puns.', details: 'Birthday: 14 Mar\nPartner: Yoni' })
  const yael = mkF('Yael Mizrahi', { goal_count: 3, goal_unit: 'month', goal_mode: 'frequency', notes: 'Board-game buddy.' })
  const amit = mkF('Amit Levy', { goal_count: 2, goal_unit: 'week' })
  const noa = mkF('Noa Barak', { goal_count: 1, goal_unit: 'month' })
  const omer = mkF('Omer Katz', { goal_mode: 'none', notes: 'Family — no schedule needed.' })
  const roni = mkF('Roni Shapira', { goal_count: 2, goal_unit: 'month' })
  s.friends = [dana, yael, amit, noa, omer, roni]
  const inter = (f, n, note = null) => row({ friend_id: f.id, interaction_date: d(n), note })
  s.friend_interactions = [
    inter(dana, -24, 'Coffee after work'), inter(dana, -31),
    inter(yael, -3, 'Board games night'), inter(yael, -9), inter(yael, -17),
    inter(amit, -4, 'Called about the trip'), inter(amit, -12),
    inter(noa, -26, 'Birthday dinner'),
    inter(omer, -1, 'Sunday lunch'),
    inter(roni, -10),
  ]
  s.todo_friends = [row({ todo_id: s.todos[2].id, friend_id: dana.id })]
  s.event_friends = [row({ event_id: s.events[3].id, friend_id: yael.id })]
}

export function seedHabitLogs(s) {
  const logs = []
  for (const h of s.habits) {
    const every = { Meditate: 1, 'Read 20 pages': 2, 'Drink water': 1, Stretch: 3, Journal: 4, Run: 3 }[h.name] ?? 2
    for (let i = 0; i < 40; i += every) {
      logs.push({ id: id(), habit_id: h.id, user_id: U, logged_date: d(-i), created_at: iso(-i, '08:00'), paid_debt: false })
    }
  }
  s.habit_logs = logs
}

export function seedClimbing(s) {
  const grades = ['v2-3', 'v3-4', 'v4-5', 'v5-6', 'v6-7', 'v7-8']
  const sessions = []
  const attempts = []
  let seed = 7
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280
  for (let w = 0; w < 6; w++) {
    for (const dayOff of [-w * 7 - 1, -w * 7 - 4]) {
      if (rnd() < 0.25) continue
      const sess = row({ session_date: d(dayOff), notes: null })
      sessions.push(sess)
      const count = 6 + Math.floor(rnd() * 8)
      for (let i = 0; i < count; i++) {
        const gi = Math.min(5, Math.floor(rnd() * (2 + w * -0.1 + 4)))
        const r = rnd()
        attempts.push(row({ session_id: sess.id, grade: grades[gi], result: r < 0.65 ? 'sent' : r < 0.85 ? 'project' : 'completed_project' }))
      }
    }
  }
  s.climbing_sessions = sessions
  s.climbing_attempts = attempts
}

export function seedWorkout(s, { days = [-1, -2, -3, -5, -6, -8, -9, -10, -12, -13, -14, -15, -16, -19, -20], today = 0 } = {}) {
  const ex = [['push_ups', 'Push ups'], ['sit_ups', 'Sit-ups'], ['calf_raises', 'Calf raises'], ['squats', 'Squats'], ['pull_ups', 'Pull ups']]
    .map(([key, name], i) => row({ name, icon: key, builtin_key: key, created_at: iso(-60, `10:0${i}`) }))
  ex.push(row({ name: 'Plank', icon: 'plank', builtin_key: null, created_at: iso(-40) }))
  s.workout_exercises = ex
  const home = row({ name: 'Home routine', is_default: true, created_at: iso(-60) })
  const quick = row({ name: 'Quick 10 minutes', is_default: false, created_at: iso(-50) })
  s.workout_presets = [home, quick]
  const pe = (preset, e, sets, reps, position) => ({ id: id(), user_id: U, preset_id: preset.id, exercise_id: e.id, sets, reps, position })
  s.workout_preset_exercises = [pe(home, ex[0], 3, 15, 0), pe(home, ex[1], 3, 20, 1), pe(home, ex[3], 3, 18, 2), pe(home, ex[4], 3, 6, 3), pe(quick, ex[0], 2, 12, 0), pe(quick, ex[3], 2, 15, 1)]
  const all = [...days, ...Array(today).fill(0)]
  s.workout_logs = all.map((n, i) => row({ preset_id: home.id, preset_name: 'Home routine', log_date: d(n), notes: i % 4 === 0 ? 'Felt strong today' : null, created_at: iso(n, '18:30') }))
  s.workout_log_exercises = s.workout_logs.flatMap(l => [
    { id: id(), user_id: U, log_id: l.id, exercise_id: ex[0].id, exercise_name: 'Push ups', icon: 'push_ups', sets: 3, reps: 15, position: 0 },
    { id: id(), user_id: U, log_id: l.id, exercise_id: ex[3].id, exercise_name: 'Squats', icon: 'squats', sets: 3, reps: 18, position: 1 },
    { id: id(), user_id: U, log_id: l.id, exercise_id: ex[1].id, exercise_name: 'Sit-ups', icon: 'sit_ups', sets: 3, reps: 20, position: 2 },
  ])
  s.workout_settings = [{ user_id: U, tracking_start_date: d(-8), reminder_enabled: true, reminder_times: ['19:00:00', '21:00:00'], last_reminder_slot: null, created_at: iso(-30) }]
}

export function seedReading(s) {
  const fiction = row({ parent_id: null, name: 'Sci-fi & fantasy' })
  const nonfic = row({ parent_id: null, name: 'Non-fiction' })
  const tech = row({ parent_id: nonfic.id, name: 'Tech & productivity' })
  s.reading_folders = [fiction, nonfic, tech]
  const book = (title, author, n, year, extra = {}) => row({ folder_id: null, ol_key: `/works/OL${n}`, title, author, cover_url: cover(n), first_publish_year: year, is_read: false, read_at: null, is_current: false, ...extra })
  s.reading_books = [
    book('Project Hail Mary', 'Andy Weir', 101, 2021, { is_current: true, folder_id: fiction.id }),
    book('Dune', 'Frank Herbert', 103, 1965, { folder_id: fiction.id }),
    book('The Hobbit', 'J.R.R. Tolkien', 106, 1937, { folder_id: fiction.id, is_read: true, read_at: iso(-40) }),
    book('The Pragmatic Programmer', 'Andrew Hunt, David Thomas', 102, 1999, { folder_id: tech.id }),
    book('Deep Work', 'Cal Newport', 108, 2016, { folder_id: tech.id, is_read: true, read_at: iso(-90) }),
    book('Atomic Habits', 'James Clear', 104, 2018, { folder_id: nonfic.id, is_read: true, read_at: iso(-20) }),
    book('Sapiens', 'Yuval Noah Harari', 105, 2011, { folder_id: nonfic.id }),
    book('Educated', 'Tara Westover', 107, 2018),
    book('Thinking, Fast and Slow', 'Daniel Kahneman', 109, 2011),
  ]
  s.reading_days = [0, -1, -2, -4, -5, -6, -7, -8, -9].map(n => row({ day: d(n) }))
}

export function seedRecipes(s) {
  const img = name => `https://placeholder.supabase.co/storage/v1/object/public/recipe-images/${U}/${name}.jpg`
  const rec = (title, description, servings, image, extra = {}) => row({ title, description, servings, image_url: image ? img(image) : null, source_url: null, import_method: 'manual', last_viewed_at: iso(-2), ...extra })
  const shak = rec('Shakshuka', 'Eggs poached in a spicy tomato and pepper sauce. Serve with crusty bread.', 4, 'Shakshuka', { last_viewed_at: iso(0, '09:00') })
  const pasta = rec('Creamy Mushroom Pasta', 'A weeknight classic with garlic, thyme and parmesan.', 2, 'Mushroom pasta', { source_url: 'https://example.com/recipe', import_method: 'link' })
  const hummus = rec('Silky Hummus', 'Smooth homemade hummus with tahini and lemon.', 6, 'Hummus')
  const pancakes = rec('Fluffy Pancakes', 'Weekend breakfast staple.', 4, 'Pancakes', { import_method: 'prompt' })
  const salad = rec('Israeli Salad', 'Chopped cucumber, tomato and herbs.', 4, null)
  const curry = rec('Chickpea Coconut Curry', 'One-pot vegan curry, ready in 30 minutes.', 4, 'Chickpea curry', { import_method: 'paste' })
  s.recipes = [shak, pasta, hummus, pancakes, salad, curry]
  const ing = (r, items) => items.map(([quantity, unit, name, note], position) => ({ id: id(), recipe_id: r.id, user_id: U, quantity, unit, name, note: note ?? null, position, created_at: iso(-20) }))
  const stp = (r, items) => items.map((instruction, i) => ({ id: id(), recipe_id: r.id, user_id: U, position: i, instruction, created_at: iso(-20) }))
  s.recipe_ingredients = [
    ...ing(shak, [[2, 'tbsp', 'olive oil'], [1, null, 'onion', 'diced'], [2, null, 'red bell peppers', 'sliced'], [3, 'cloves', 'garlic', 'minced'], [1, 'tbsp', 'paprika'], [1, 'tsp', 'cumin'], [800, 'g', 'crushed tomatoes'], [6, null, 'eggs'], [null, null, 'fresh parsley', 'to serve']]),
    ...ing(pasta, [[250, 'g', 'penne'], [300, 'g', 'mushrooms', 'sliced'], [2, 'cloves', 'garlic'], [200, 'ml', 'cream'], [50, 'g', 'parmesan', 'grated']]),
    ...ing(hummus, [[400, 'g', 'chickpeas', 'drained'], [3, 'tbsp', 'tahini'], [1, null, 'lemon', 'juiced']]),
  ]
  s.recipe_steps = [
    ...stp(shak, ['Heat the oil in a large deep skillet over medium heat. Cook the onion and peppers until soft, about 8 minutes.', 'Stir in garlic, paprika and cumin and cook for 1 minute until fragrant.', 'Pour in the tomatoes, season with salt, and simmer for 10 minutes until thickened.', 'Make small wells in the sauce and crack in the eggs. Cover and cook until the whites are set, 5–8 minutes.', 'Sprinkle with parsley and serve straight from the pan.']),
    ...stp(pasta, ['Boil the pasta until al dente.', 'Fry the mushrooms until golden, add garlic.', 'Add cream and parmesan, toss with pasta.']),
    ...stp(hummus, ['Blend everything until very smooth.', 'Serve drizzled with olive oil.']),
  ]
  const brunch = row({ name: 'Weekend brunch', emoji: '🥞' })
  const quick = row({ name: 'Quick dinners', emoji: '⚡' })
  const vegan = row({ name: 'Vegan', emoji: '🌱' })
  s.recipe_collections = [brunch, quick, vegan]
  const ci = (c, r) => row({ collection_id: c.id, recipe_id: r.id })
  s.recipe_collection_items = [ci(brunch, shak), ci(brunch, pancakes), ci(quick, pasta), ci(quick, salad), ci(vegan, hummus), ci(vegan, curry)]

  // meals
  const meal = (name, description, tags, extra = {}) => row({ name, description, image_url: null, recipe_id: null, tags, recipe: null, ...extra })
  const meals = [
    meal('Shakshuka', 'Our Friday brunch classic', ['breakfast', 'lunch'], { recipe_id: shak.id, recipe: { id: shak.id, title: shak.title, image_url: shak.image_url } }),
    meal('Mushroom pasta', null, ['dinner'], { recipe_id: pasta.id, recipe: { id: pasta.id, title: pasta.title, image_url: pasta.image_url } }),
    meal('Hummus plate', 'With warm pita and pickles', ['lunch'], { recipe_id: hummus.id, recipe: { id: hummus.id, title: hummus.title, image_url: hummus.image_url } }),
    meal('Pancakes with maple syrup', null, ['breakfast', 'dessert'], { image_url: img('Pancakes') }),
    meal('Sushi night', 'Order from the place on Dizengoff', ['dinner'], { image_url: img('Sushi') }),
    meal('Grilled cheese & tomato soup', null, ['lunch', 'dinner'], { image_url: img('Grilled cheese') }),
    meal('Chocolate lava cake', 'Special occasions only', ['dessert'], { image_url: img('Lava cake') }),
    meal('Avocado toast', null, ['breakfast']),
  ]
  s.meals = meals
  s.meal_shares = [
    row({ token: 'abc123', tag: 'dinner', picked_meal_id: null, picked_at: null, expires_at: new Date(Date.parse(iso(0, '10:30')) + 20 * 3600e3).toISOString(), picked: null }),
    row({ token: 'def456', tag: 'all', picked_meal_id: meals[4].id, picked_at: iso(-1, '19:00'), expires_at: new Date(Date.parse(iso(0, '10:30')) + 3 * 3600e3).toISOString(), picked: { id: meals[4].id, name: meals[4].name } }),
  ]
  return meals
}

export function seedWealth(s) {
  const item = (name, category, owner, extra = {}) => row({ name, category, owner, notes: null, ...extra })
  const it = {
    leumi: item('Leumi checking', 'bank', 'ophir'),
    hapoalim: item('Hapoalim joint', 'bank', 'shared'),
    deposit: item('12-month deposit', 'savings', 'shared'),
    ib: item('Interactive Brokers', 'investment', 'ophir'),
    pension: item('Pension (Migdal)', 'pension', 'ophir'),
    yaelPension: item('Pension (Menora)', 'pension', 'yael'),
    study: item('Study fund', 'study_fund', 'yael'),
    btc: item('Bitcoin', 'crypto', 'ophir'),
    cash: item('Emergency cash', 'cash', 'shared'),
  }
  s.wealth_items = Object.values(it)
  const snap = (i, monthsAgo, balance, currency = 'ils') => row({ item_id: i.id, recorded_on: d(-monthsAgo * 30), balance, currency })
  const wobble = [0, 0.012, -0.008, 0.02, -0.015, 0.01, 0.025, -0.01, 0.005]
  const series = (i, start, growth, currency = 'ils') => Array.from({ length: 9 }, (_, k) => snap(i, 8 - k, Math.round(start * (1 + growth * k + wobble[(k + i.name.length) % 9] * (growth > 0.01 ? 2 : 0.2))), currency))
  s.wealth_snapshots = [
    ...series(it.leumi, 21000, 0.02), ...series(it.hapoalim, 38000, 0.035), ...series(it.deposit, 120000, 0.012),
    ...series(it.ib, 9200, 0.06, 'usd'), ...series(it.pension, 210000, 0.02), ...series(it.yaelPension, 160000, 0.022),
    ...series(it.study, 85000, 0.015), ...series(it.btc, 3400, 0.05, 'usd'), ...series(it.cash, 6000, 0, 'ils'),
  ]
  s.wealth_goals = [
    row({ name: 'Apartment down payment', target_amount: 1200000, target_date: d(540), scope: ['ophir', 'yael', 'shared'], item_id: null, notes: null }),
    row({ name: 'Emergency fund', target_amount: 50000, target_date: null, scope: ['shared'], item_id: it.hapoalim.id, notes: null }),
  ]
}

export function seedFiles(s) {
  const f = (name, folder, mime, size, extra = {}) => row({ name, folder, storage_path: `${U}/${name}`, notes: null, size_bytes: size, mime_type: mime, source: 'local', root_folder_id: null, drive_file_id: null, relative_path: '', drive_modified_time: null, is_starred: false, ...extra })
  s.files = [
    f('Lease agreement 2026.pdf', 'Housing', 'application/pdf', 482_000, { is_starred: true }),
    f('Utility bills Oct.pdf', 'Housing', 'application/pdf', 220_000),
    f('Passport scan.jpg', 'Documents', 'image/jpeg', 1_450_000, { is_starred: true }),
    f('Insurance policy.pdf', 'Documents', 'application/pdf', 910_000),
    f('Tax return 2025.pdf', 'Documents', 'application/pdf', 1_220_000),
    f('Trip itinerary.docx', 'Travel', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 64_000),
    f('Eilat hotel booking.pdf', 'Travel', 'application/pdf', 130_000),
    f('Budget 2026.xlsx', 'Finance', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 88_000, { is_starred: true }),
    f('Notes.txt', 'Misc', 'text/plain', 2_100),
    f('Whiteboard photo.png', 'Misc', 'image/png', 2_900_000),
    f('Design spec.pdf', 'Drive: Work', 'application/pdf', 760_000, { source: 'google_drive', drive_file_id: 'd1', root_folder_id: 'r1', relative_path: 'Specs' }),
  ]
  s.google_accounts = [row({ email: 'ophir@example.com', color: '#3b82f6', deleted_at: null }), row({ email: 'ophir.work@example.com', color: '#22c55e', deleted_at: null })]
  s.google_drive_folders = [row({ folder_id: 'r1', folder_name: 'Work', sync_status: 'idle', sync_error: null, last_synced_at: iso(0, '07:00') })]
}

export function seedMonthEvents(s) {
  const e = (title, off, time, end, extra = {}) => mk.event(title, { event_date: d(off), event_time: time, event_end_time: end, ...extra })
  s.events.push(
    e('Parents dinner', 9, '19:30:00', '22:00:00', { location: "Mom & Dad's" }),
    e('Sprint planning', 8, '10:00:00', '11:00:00', { source: 'google', google_account_id: s.google_accounts[1].id }),
    e('אימון', 11, '18:00:00', '19:30:00', { source: 'google' }),
    e('Flight to Berlin', 13, '06:15:00', '09:50:00', { location: 'TLV' }),
    e('Conference: DevDays', 14, null, null, { event_end_date: d(16) }),
    e('Quarterly review', 17, '14:00:00', '15:30:00', { source: 'google', google_account_id: s.google_accounts[1].id }),
    e('Haircut', 5, '17:00:00', '17:45:00'),
    e('Anniversary dinner', 20, '20:00:00', '23:00:00', { location: 'Claro, Tel Aviv' }),
    e('Car service', 22, '08:00:00', '10:00:00'),
  )
}

export function seedMisc(s) {
  s.stock_alerts = [row({ symbol: 'TENB', target_price: 42.5, triggered_at: null })]
  s.currency_alerts = [
    row({ from_currency: 'usd', to_currency: 'ils', target_rate: 3.5, direction: 'below', triggered_at: null }),
    row({ from_currency: 'eur', to_currency: 'ils', target_rate: 4.2, direction: 'above', triggered_at: iso(-5) }),
  ]
  s.api_tokens = [row({ label: 'iPhone shortcut', token_hash: 'x', last_used_at: iso(-1) })]
  s.game_utilities = []
}

export function seedRuneScape(s) {
  const c = row({ name: 'BowlSplit' })
  const alt = row({ name: 'Iron Ophir', created_at: iso(-10) })
  s.rs_characters = [c, alt]
  const quests = [
    ['Cook\'s Assistant', 'Novice', false, 1], ['Dragon Slayer', 'Experienced', false, 2], ['Desert Treasure', 'Master', true, 3],
    ['Recipe for Disaster', 'Grandmaster', true, 10], ['Plague\'s End', 'Master', true, 2], ['Priest in Peril', 'Intermediate', false, 1],
    ['Heroes\' Quest', 'Experienced', false, 1], ['Monkey Madness', 'Experienced', true, 3], ['Ritual of the Mahjarrat', 'Grandmaster', true, 2],
    ['Nomad\'s Requiem', 'Master', true, 3], ['Fairytale I - Growing Pains', 'Intermediate', true, 2], ['Rune Mysteries', 'Novice', false, 1],
  ]
  s.rs_quests = quests.map(([name, difficulty, members, quest_points]) => ({ id: id(), name, difficulty, members, quest_points, updated_at: iso(-3) }))
  const q = name => s.rs_quests.find(x => x.name === name)
  s.rs_goals = [
    row({ character_id: c.id, type: 'skill', skill_id: 15, target_level: 99, quest_id: null, title: null, completed_at: null, sort_order: 0 }),
    row({ character_id: c.id, type: 'skill', skill_id: 27, target_level: 99, quest_id: null, title: null, completed_at: null, sort_order: 1 }),
    row({ character_id: c.id, type: 'quest', skill_id: null, target_level: null, quest_id: q('Plague\'s End').id, title: null, completed_at: null, sort_order: 2 }),
    row({ character_id: c.id, type: 'quest', skill_id: null, target_level: null, quest_id: q('Desert Treasure').id, title: null, completed_at: iso(-4), sort_order: 3 }),
    row({ character_id: c.id, type: 'arbitrary', skill_id: null, target_level: null, quest_id: null, title: 'Kill Araxxor 50 times', completed_at: null, sort_order: 4 }),
  ]
  const tasks = []
  const areas = [['Area Tasks', 'Ardougne'], ['Area Tasks', 'Falador'], ['Area Tasks', 'Varrock'], ['Exploration', 'Menaphos'], ['Exploration', 'Prifddinas']]
  for (const [category, area] of areas) {
    const tiers = category === 'Area Tasks' ? ['Easy', 'Medium', 'Hard', 'Elite'] : ['All']
    for (const tier of tiers) {
      for (let i = 0; i < 4; i++) {
        tasks.push({ id: id(), category, area, tier, name: `${area} ${tier.toLowerCase()} task ${i + 1}`, description: `Complete the ${tier.toLowerCase()} objective #${i + 1} in ${area}.`, position: i, updated_at: iso(-3) })
      }
    }
  }
  s.rs_diary_tasks = tasks
  s.rs_diary_progress = tasks.filter((t, i) => i % 3 === 0).map(t => ({ id: id(), user_id: U, character_id: c.id, task_id: t.id, completed_at: iso(-5) }))
  const src = f => fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/features/runescape', f), 'utf8')
  const arch = [...src('archaeology-data.ts').matchAll(/key: '([a-z0-9-]+)'[^}]*?needed: (\d+)/g)]
  const archKeys = arch.length ? arch : [...src('archaeology-data.ts').matchAll(/key: '([a-z0-9-]+)'/g)].map(m => [null, m[1], '1'])
  s.rs_archaeology_progress = archKeys.filter((_, i) => i % 3 !== 2).map(([, key, needed], i) => ({ id: id(), user_id: U, character_id: c.id, artefact_key: key, found: i % 4 === 0 ? Number(needed) : Math.max(0, Number(needed) - 1), updated_at: iso(-2) }))
  const pvmKeys = [...src('pvm-data.ts').matchAll(/key: '([a-z0-9-]+:[a-z0-9-]+)'/g)].map(m => m[1])
  s.rs_pvm_progress = pvmKeys.slice(0, 11).map(goal_key => ({ id: id(), user_id: U, character_id: c.id, goal_key, completed_at: iso(-6) }))
}

// RuneMetrics-style profile for the mocked /api/runescape?kind=profile
export function runescapeProfile() {
  const levels = [99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 80, 99, 120, 120, 119, 118, 120]
  const skillvalues = levels.map((level, id) => ({ id, level, xp: Math.round(13_034_431 * (level / 99) ** 3) * 10, rank: 12_000 + id * 3_100 }))
  return {
    name: 'BowlSplit', skillvalues, totalskill: 2898, totalxp: 1_210_450_000, combatlevel: 138, questscomplete: 289,
    activities: [
      { text: 'Levelled up Divination.', details: 'I levelled my Divination skill, I am now level 119.', date: '28-Oct-2026 16:42' },
      { text: 'Quest complete: Plague\'s End', details: 'I have completed the quest: Plague\'s End', date: '27-Oct-2026 19:10' },
      { text: 'Killed Araxxor', details: 'I killed Araxxor.', date: '26-Oct-2026 20:05' },
    ],
  }
}

export function runescapeQuests() {
  return {
    quests: [
      { title: 'Cook\'s Assistant', status: 'COMPLETED', difficulty: 0, members: false, questPoints: 1 },
      { title: 'Dragon Slayer', status: 'COMPLETED', difficulty: 2, members: false, questPoints: 2 },
      { title: 'Desert Treasure', status: 'COMPLETED', difficulty: 3, members: true, questPoints: 3 },
      { title: 'Recipe for Disaster', status: 'STARTED', difficulty: 4, members: true, questPoints: 10 },
      { title: 'Plague\'s End', status: 'NOT_STARTED', difficulty: 3, members: true, questPoints: 2 },
    ],
  }
}

export function questWikiPage(title) {
  const html = `<div class="mw-parser-output">
<table class="infobox questdetails"><tbody>
<tr><th class="questdetails-header">Start point</th><td>Talk to <a href="/w/Gypsy_Aris">Gypsy Aris</a> in Varrock.</td></tr>
<tr><th class="questdetails-header">Official difficulty</th><td>Novice</td></tr>
<tr><th class="questdetails-header">Length</th><td>Short (&lt; 30 minutes)</td></tr>
<tr><th class="questdetails-header">Requirements</th><td><ul><li>None</li><li>Able to defeat a level 25 enemy</li></ul></td></tr>
<tr><th class="questdetails-header">Items required</th><td><ul><li>Silverlight (obtained during the quest)</li><li>Coins x100</li><li>Bones x25</li></ul></td></tr>
<tr><th class="questdetails-header">Rewards</th><td><ul><li>2 Quest points</li><li>5,000 Strength XP</li><li>Access to the Champions' Guild</li></ul></td></tr>
</tbody></table>
<p>${title} is a quest that takes you through the first steps of the adventure.</p>
<h2><span class="mw-headline" id="Walkthrough">Walkthrough</span></h2>
<p>Begin by speaking to the quest giver, then follow the instructions below.</p>
<ol><li>Speak to the guide and accept the quest.</li><li>Collect the required items from the bank.</li><li>Head to the dungeon entrance and defeat the guardian.</li><li>Return to the quest giver to claim your reward.</li></ol>
<h2><span class="mw-headline" id="Tips">Tips</span></h2>
<p>Bring food and a few teleports. The guardian hits hard but is slow.</p>
</div>`
  return { parse: { title, text: html } }
}

export function applyAll(s) {
  seedFriends(s)
  seedHabitLogs(s)
  seedClimbing(s)
  seedWorkout(s)
  seedReading(s)
  const meals = seedRecipes(s)
  seedWealth(s)
  seedFiles(s)
  seedMonthEvents(s)
  seedMisc(s)
  seedRuneScape(s)
  return { meals }
}

export const mockExternal = {
  coverLabels,
  'currency-api': () => ({ date: '2026-10-29', ils: { usd: 0.2705, eur: 0.2487, gbp: 0.2093, jpy: 41.2, chf: 0.2352, cad: 0.3733, aud: 0.4121, try: 11.2, all: 25.4, ils: 1 }, usd: { ils: 3.697, eur: 0.919, gbp: 0.774, jpy: 152.3, chf: 0.869, cad: 1.38, aud: 1.52, try: 41.4, all: 93.9, usd: 1 }, eur: { ils: 4.02, usd: 1.088, gbp: 0.842, jpy: 165.7, chf: 0.945, cad: 1.5, aud: 1.66, try: 45.1, all: 102.1, eur: 1 } }),
  '/api/stock-quote': url => {
    const sym = url.searchParams.get('symbol')
    const base = { TENB: 38.74 }[sym] ?? 100
    return { current: base, change: +(base * 0.012).toFixed(2), percentChange: 1.2, high: +(base * 1.01).toFixed(2), low: +(base * 0.985).toFixed(2), open: +(base * 0.995).toFixed(2), previousClose: +(base / 1.012).toFixed(2) }
  },
  '/api/runescape?kind=profile': () => runescapeProfile(),
  '/api/runescape?kind=quests': () => runescapeQuests(),
  '/api/runescape?kind=wiki-page': url => questWikiPage(url.searchParams.get('title') ?? 'Quest'),
  '/api/runescape?kind=wiki-quests': () => ({ query: { categorymembers: [] } }),
  '/api/book-search': () => ({ docs: [] }),
  '/api/google-drive-folders': () => ({ folders: [{ id: 'df1', folder_id: 'r1', folder_name: 'Work', created_at: '2026-09-01T10:00:00Z', sync_status: 'idle', sync_error: null, last_synced_at: '2026-10-29T05:00:00Z' }] }),
}
