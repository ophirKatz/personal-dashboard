import { USER } from './mock.mjs'

// Dates are relative to the fixed "today" (Thu 2026-10-29) so the data always lines up with the clock.
export const TODAY = '2026-10-29'
const DAY = 86_400_000
const base = new Date(`${TODAY}T12:00:00Z`).getTime()
export const d = n => new Date(base + n * DAY).toISOString().slice(0, 10) // d(0) today, d(1) tomorrow, d(-1) yesterday
export const iso = (n, hhmm = '09:00') => `${d(n)}T${hhmm}:00+02:00`

let n = 0
const id = (prefix = 'a') => `${prefix}0000000-0000-4000-8000-${String(++n).padStart(12, '0')}`
const U = USER.id
const row = (extra = {}) => ({ id: id(), user_id: U, created_at: iso(-30), ...extra })

export const WEATHER = {
  id: id(), user_id: U, latitude: 32.08, longitude: 34.78, temperature: 24.6, temperature_min: 18.2, temperature_max: 27.9,
  feels_like: 25, weather_code: 1, condition: 'Mainly clear', is_day: true, humidity: 55, wind_speed: 11,
  status: 'ready', error: null, fetched_at: iso(0, '10:15'), updated_at: iso(0, '10:15'),
}

export function todo(title, extra = {}) {
  return row({
    title, notes: null, due_date: d(0), due_time: null, priority: 'medium', completed: false, completed_at: null,
    reminder_enabled: false, remind_at: null, notified_at: null, source: 'local', google_task_id: null, source_event_id: null,
    recurrence_interval: null, recurrence_unit: null, ...extra,
  })
}

export function event(title, extra = {}) {
  return row({
    title, event_date: d(0), event_time: null, event_end_date: null, event_end_time: null, notes: null, location: null, room: null,
    source: 'local', google_event_id: null, google_account_id: null, html_link: null, attendees: null, ...extra,
  })
}

export function habitStatus(name, emoji, color, extra = {}) {
  return row({
    name, emoji, color, frequency: 'daily', times_per_week: null, interval_days: null, reminder_enabled: false, reminder_time: null,
    last_notified_date: null, debt: 0, debt_checked_date: null, owed_count: 1, is_due_today: true, streak: 0,
    logged_today: false, logged_today_count: 0, ...extra,
  })
}

export function focusSummary(period, payload, extra = {}) {
  return row({
    period, summary: typeof payload === 'string' ? payload : JSON.stringify(payload), status: 'ready', error: null,
    generated_at: iso(0, '08:00'), updated_at: iso(0, '08:00'), ...extra,
  })
}

export const FOCUS_WEEK = {
  type: 'cards',
  note: 'A packed Thursday, then a lighter weekend — good time to get ahead on the Passport renewal.',
  cards: [
    {
      label: 'Time-sensitive', insight: 'Two things need attention before the weekend.',
      items: [
        { type: 'todo', id: 'x1', title: 'Renew passport appointment', date: d(1), time: '09:30:00', priority: 'high', source: 'local' },
        { type: 'event', id: 'x2', title: 'Dentist check-up', date: d(0), time: '15:00:00', source: 'google' },
      ],
    },
    {
      label: 'Keep momentum', insight: 'Your workout streak is at 4 days; Saturday is a good slot for a long climb.',
      items: [
        { type: 'event', id: 'x3', title: 'אימון טיפוס', date: d(2), time: '18:00:00', source: 'google' },
        { type: 'todo', id: 'x4', title: 'Order new climbing shoes', date: d(3), time: null, priority: 'low', source: 'local' },
      ],
    },
  ],
}
export const FOCUS_TOMORROW = {
  type: 'cards',
  note: 'Tomorrow starts early with a passport appointment — pack your documents tonight.',
  cards: [
    {
      label: 'Tomorrow', insight: 'Light day after the appointment.',
      items: [
        { type: 'todo', id: 'y1', title: 'Renew passport appointment', date: d(1), time: '09:30:00', priority: 'high', source: 'local' },
        { type: 'event', id: 'y2', title: 'Team lunch', date: d(1), time: '13:00:00', source: 'google' },
      ],
    },
  ],
}

export function buildSeed() {
  n = 0
  const habitsList = [
    habitStatus('Meditate', '🧘', '#8b5cf6', { logged_today: true, logged_today_count: 1, owed_count: 0, streak: 12 }),
    habitStatus('Read 20 pages', '📚', '#f59e0b', { owed_count: 1, streak: 5 }),
    habitStatus('Drink water', '💧', '#0ea5e9', { logged_today: true, logged_today_count: 1, owed_count: 2, debt: 2, streak: 3 }),
    habitStatus('Stretch', '🤸', '#10b981', { owed_count: 1, streak: 0 }),
    habitStatus('Journal', '✍️', '#ec4899', { owed_count: 3, debt: 2, streak: 0 }),
    habitStatus('Run', '🏃', '#ef4444', { frequency: 'weekly', times_per_week: 3, owed_count: 1, streak: 2 }),
  ]

  const store = {
    app_settings: [{ id: true, habits_v2_enabled: true }],
    habit_status: habitsList,
    habits: habitsList.map(({ owed_count, is_due_today, streak, logged_today, logged_today_count, ...h }) => h),
    habit_logs: [],
    user_settings: [],
    weather_cache: [WEATHER],
    notifications: [],
    todos: [
      todo('Pay electricity bill', { priority: 'high', due_date: d(-1), due_time: '09:00:00' }),
      todo('Submit expense report', { priority: 'high', due_time: '09:15:00' }),
      todo('Reply to landlord about lease', { priority: 'medium', due_time: '14:00:00' }),
      todo('Book flights for November trip', { priority: 'medium' }),
      todo('Water the plants', { priority: 'low', recurrence_interval: 1, recurrence_unit: 'week' }),
      todo('Renew passport appointment', { priority: 'high', due_date: d(1), due_time: '09:30:00' }),
      todo('Pick up dry cleaning', { priority: 'low', due_date: d(1) }),
      todo('Order new climbing shoes', { priority: 'low', due_date: d(3) }),
      todo('Call mom', { priority: 'medium', due_date: d(2), due_time: '19:00:00' }),
      todo('Read quarterly report', { priority: 'medium', due_date: d(6) }),
      todo('Plan weekend hike', { priority: 'low', due_date: null }),
      todo('Fix bike tire', { priority: 'low', due_date: d(-3), completed: true, completed_at: iso(-2) }),
      todo('Google task: Send invoice', { priority: 'medium', due_date: d(4), source: 'google', google_task_id: 'g1' }),
    ],
    events: [
      event('Stand-up', { event_time: '09:30:00', event_end_time: '09:45:00', source: 'google', location: 'https://meet.google.com/abc-defg-hij', room: 'Phone booth 2' }),
      event('Design review', { event_time: '11:00:00', event_end_time: '12:00:00', source: 'google', location: 'Room 4B, Tel Aviv office' }),
      event('Lunch with Dana', { event_time: '12:30:00', event_end_time: '13:30:00', location: 'Cafe Xoho, Tel Aviv' }),
      event('Dentist check-up', { event_time: '15:00:00', event_end_time: '15:45:00', source: 'google', location: 'Dr. Levi Clinic' }),
      event('Yoga class', { event_time: '18:30:00', event_end_time: '19:30:00' }),
      event('Rent due', {}),
      event('Team lunch', { event_date: d(1), event_time: '13:00:00', event_end_time: '14:00:00', source: 'google' }),
      event('Morning flight to Eilat', { event_date: d(1), event_time: '08:00:00', event_end_time: '09:10:00', location: 'Ben Gurion Airport' }),
      event('אימון טיפוס', { event_date: d(2), event_time: '18:00:00', event_end_time: '20:00:00', source: 'google', location: 'Climbing gym' }),
      event('Birthday: Noa', { event_date: d(3) }),
      event('Board games night', { event_date: d(4), event_time: '20:00:00', event_end_time: '23:00:00', location: "Yael's place" }),
      event('Hike: Ein Gedi', { event_date: d(6), event_time: '07:00:00', event_end_time: '14:00:00', notes: 'Bring 3L water' }),
    ],
    shopping_items: [
      ['Milk', false], ['Eggs', false], ['Tomatoes', false], ['Olive oil', false], ['Pasta', false], ['Coffee beans', false],
      ['Bananas', true], ['Bread', true], ['Greek yogurt', true],
    ].map(([name, checked], i) => row({ name, checked, created_at: iso(-3, `1${i}:00`) })),
    focus_summaries: [focusSummary('week', FOCUS_WEEK), focusSummary('today', FOCUS_TOMORROW)],
    friends: [],
    friend_interactions: [],
    todo_friends: [],
    event_friends: [],
    climbing_sessions: [],
    climbing_attempts: [],
    workout_settings: [{ user_id: U, tracking_start_date: d(-9), reminder_enabled: true, reminder_times: ['19:00:00', '21:00:00'], last_reminder_slot: null, created_at: iso(-9) }],
    workout_logs: [],
    workout_log_exercises: [],
    workout_exercises: [],
    workout_presets: [],
    workout_preset_exercises: [],
    reading_books: [],
    reading_folders: [],
    reading_days: [],
    google_accounts: [],
    google_drive_folders: [],
    files: [],
    api_tokens: [],
    push_subscriptions: [],
    stock_alerts: [],
    currency_alerts: [],
    event_reminders: [],
  }
  return store
}

export { U }
export const mk = { row, id, todo, event }
