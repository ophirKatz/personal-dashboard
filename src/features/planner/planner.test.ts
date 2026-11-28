import { describe, expect, it } from 'vitest'
import type { WeekPreset } from '../../supabase'
import {
  addMinutes, buildInviteePool, buildPlan, cellState, countInvited, defaultWeekStart, findConflicts, formatDuration,
  interpretResponse, planKey, presetRow, scheduledKeys, slotFor, suggestInvitees, toRequestBody, weekDays, weekLabel,
  emptyDraft, durationOptions, weekRelativeLabel,
  type ExistingEvent, type PlanInput, type PlannedEvent,
} from './planner'

function preset(over: Partial<WeekPreset> = {}): WeekPreset {
  return {
    id: 'p1', user_id: 'u', emoji: '🧗', title: 'Climbing', default_time: '18:00:00', default_duration_minutes: 90,
    days: [], day_overrides: {}, invitees: [], position: 0, created_at: '2026-11-28T00:00:00Z', ...over,
  }
}

// Sunday 2026-11-29 .. Saturday 2026-12-05
const WEEK = weekDays(new Date('2026-11-29T12:00:00'))

function input(over: Partial<PlanInput> = {}): PlanInput {
  return { presets: [preset()], days: WEEK, picks: {}, tweaks: {}, scheduled: new Set(), today: '2026-11-29', ...over }
}

describe('weeks', () => {
  it('opens on the current week Sunday to Thursday', () => {
    expect(defaultWeekStart(new Date('2026-11-29T09:00:00'))).toEqual(new Date('2026-11-29T00:00:00')) // Sunday
    expect(defaultWeekStart(new Date('2026-12-03T09:00:00'))).toEqual(new Date('2026-11-29T00:00:00')) // Thursday
  })

  it('opens on the coming week from Friday on', () => {
    expect(defaultWeekStart(new Date('2026-12-04T09:00:00'))).toEqual(new Date('2026-12-06T00:00:00')) // Friday
    expect(defaultWeekStart(new Date('2026-11-28T09:00:00'))).toEqual(new Date('2026-11-29T00:00:00')) // Saturday
  })

  it('lists seven days Sunday to Saturday, across a month boundary', () => {
    expect(WEEK.map(d => d.date)).toEqual([
      '2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05',
    ])
    expect(WEEK.map(d => d.dow)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(WEEK.map(d => d.dayOfMonth)).toEqual([29, 30, 1, 2, 3, 4, 5])
  })

  it('labels the week, repeating the month only when it changes', () => {
    expect(weekLabel(new Date('2026-11-29T00:00:00'))).toBe('Nov 29 – Dec 5')
    expect(weekLabel(new Date('2026-12-06T00:00:00'))).toBe('Dec 6 – 12')
  })
})

describe('weekRelativeLabel', () => {
  const now = new Date('2026-12-02T10:00:00') // a Wednesday

  it('names this week, the one either side, and nothing further out', () => {
    expect(weekRelativeLabel(new Date('2026-11-29T00:00:00'), now)).toBe('This week')
    expect(weekRelativeLabel(new Date('2026-12-06T00:00:00'), now)).toBe('Next week')
    expect(weekRelativeLabel(new Date('2026-11-22T00:00:00'), now)).toBe('Last week')
    expect(weekRelativeLabel(new Date('2026-12-13T00:00:00'), now)).toBe('')
  })
})

describe('times', () => {
  it('formats durations', () => {
    expect(formatDuration(45)).toBe('45m')
    expect(formatDuration(60)).toBe('1h')
    expect(formatDuration(90)).toBe('1h 30m')
  })

  it('adds minutes across midnight', () => {
    expect(addMinutes('2026-12-01', '19:00', 90)).toEqual({ date: '2026-12-01', time: '20:30' })
    expect(addMinutes('2026-12-01', '23:30:00', 60)).toEqual({ date: '2026-12-02', time: '00:30' })
  })

  it('uses the default slot unless the weekday has an override', () => {
    const p = preset({ day_overrides: { '2': { time: '19:30' }, '6': { time: '10:00', duration: 120 }, '4': { duration: 60 } } })
    expect(slotFor(p, 1)).toEqual({ time: '18:00', duration: 90 })
    expect(slotFor(p, 2)).toEqual({ time: '19:30', duration: 90 })
    expect(slotFor(p, 4)).toEqual({ time: '18:00', duration: 60 })
    expect(slotFor(p, 6)).toEqual({ time: '10:00', duration: 120 })
  })
})

describe('the plan', () => {
  const climbing = preset({ days: [2, 4], day_overrides: { '4': { time: '17:30' } } })

  it('pre-selects the preset’s usual days with their own times', () => {
    const plan = buildPlan(input({ presets: [climbing] }))
    expect(plan.map(e => [e.date, e.time, e.duration])).toEqual([
      ['2026-12-01', '18:00', 90],
      ['2026-12-03', '17:30', 90],
    ])
  })

  it('lets a manual pick add a day or remove a usual one', () => {
    const picks = { [planKey('p1', '2026-12-01')]: false, [planKey('p1', '2026-12-05')]: true }
    const plan = buildPlan(input({ presets: [climbing], picks }))
    expect(plan.map(e => e.date)).toEqual(['2026-12-03', '2026-12-05'])
  })

  it('skips past days and days already on the calendar', () => {
    const everyDay = preset({ days: [0, 1, 2, 3, 4, 5, 6] })
    const scheduled = new Set([planKey('p1', '2026-12-02')])
    const plan = buildPlan(input({ presets: [everyDay], today: '2026-11-30', scheduled }))
    expect(plan.map(e => e.date)).toEqual(['2026-11-30', '2026-12-01', '2026-12-03', '2026-12-04', '2026-12-05'])
    expect(cellState(everyDay, WEEK[0], input({ today: '2026-11-30' }))).toBe('past')
    expect(cellState(everyDay, WEEK[3], input({ scheduled }))).toBe('scheduled')
  })

  it('applies one-off tweaks to a single event only', () => {
    const tweaks = { [planKey('p1', '2026-12-01')]: { time: '20:00', duration: 60 } }
    const plan = buildPlan(input({ presets: [climbing], tweaks }))
    expect(plan.map(e => [e.date, e.time, e.duration])).toEqual([
      ['2026-12-01', '20:00', 60],
      ['2026-12-03', '17:30', 90],
    ])
  })

  it('orders events by day, then time, across presets, and carries the invitees', () => {
    const date = preset({ id: 'p2', title: 'Date night', emoji: '🍷', default_time: '20:00:00', days: [2], invitees: [{ email: 'a@b.co', name: 'Alex' }] })
    const plan = buildPlan(input({ presets: [date, climbing] }))
    expect(plan.map(e => [e.title, e.date, e.time])).toEqual([
      ['Climbing', '2026-12-01', '18:00'],
      ['Date night', '2026-12-01', '20:00'],
      ['Climbing', '2026-12-03', '17:30'],
    ])
    expect(plan[1].invitees).toEqual([{ email: 'a@b.co', name: 'Alex' }])
  })
})

describe('scheduledKeys', () => {
  it('matches an existing event by title and day, ignoring case and spacing', () => {
    const presets = [preset(), preset({ id: 'p2', title: 'Date night' })]
    const keys = scheduledKeys(presets, [
      { title: ' climbing ', event_date: '2026-12-01' },
      { title: 'Dentist', event_date: '2026-12-01' },
    ])
    expect([...keys]).toEqual([planKey('p1', '2026-12-01')])
  })
})

describe('findConflicts', () => {
  const planned = (key: string, date: string, time: string, duration: number, title = 'Climbing') =>
    ({ key, presetId: 'p', emoji: '🧗', title, date, dow: 2, time, duration, invitees: [] })
  const ev = (title: string, date: string, time: string | null, end: string | null): ExistingEvent =>
    ({ title, event_date: date, event_time: time, event_end_date: end ? date : null, event_end_time: end })

  it('flags an overlap with an existing event', () => {
    const result = findConflicts([planned('a', '2026-12-01', '18:00', 90)], [ev('Dentist', '2026-12-01', '19:00:00', '20:00:00')])
    expect(result).toEqual({ a: ['Dentist'] })
  })

  it('does not flag events that merely touch, are on another day, or are all-day', () => {
    const result = findConflicts([planned('a', '2026-12-01', '18:00', 60)], [
      ev('Before', '2026-12-01', '17:00:00', '18:00:00'),
      ev('After', '2026-12-01', '19:00:00', '20:00:00'),
      ev('Other day', '2026-12-02', '18:00:00', '19:00:00'),
      ev('All day', '2026-12-01', null, null),
    ])
    expect(result).toEqual({})
  })

  it('assumes an hour for a timed event with no end', () => {
    expect(findConflicts([planned('a', '2026-12-01', '18:30', 30)], [ev('Call', '2026-12-01', '18:00:00', null)])).toEqual({ a: ['Call'] })
  })

  it('flags two planned events at the same time against each other', () => {
    const result = findConflicts([
      planned('a', '2026-12-01', '19:00', 90, 'Climbing'),
      planned('b', '2026-12-01', '20:00', 120, 'Date night'),
    ], [])
    expect(result).toEqual({ a: ['Date night'], b: ['Climbing'] })
  })
})

describe('invitees', () => {
  it('pools friends, attendees and preset invitees by email, without you', () => {
    const pool = buildInviteePool({
      selfEmail: 'Me@x.com',
      friends: [{ name: 'Sam', email: 'SAM@x.com' }, { name: 'No email', email: null }],
      events: [{
        attendees: [
          { name: null, email: 'sam@x.com', status: 'accepted', self: false, organizer: false },
          { name: 'Dana Levi', email: 'dana@x.com', status: 'accepted', self: false, organizer: false },
          { name: 'Me', email: 'me@x.com', status: 'accepted', self: true, organizer: true },
          { name: 'Broken', email: 'not-an-email', status: 'accepted', self: false, organizer: false },
        ],
      }, { attendees: null }],
      presets: [{ invitees: [{ email: 'dana@x.com', name: 'ignored' }, { email: 'zed@x.com' }] }],
    })
    expect(pool).toEqual([
      { email: 'dana@x.com', name: 'Dana Levi' },
      { email: 'sam@x.com', name: 'Sam' },
      { email: 'zed@x.com', name: null },
    ])
  })

  it('fills in a missing name from a later source', () => {
    const pool = buildInviteePool({
      friends: [{ name: '', email: 'sam@x.com' }],
      events: [{ attendees: [{ name: 'Sam Cohen', email: 'sam@x.com', status: 'accepted', self: false, organizer: false }] }],
      presets: [],
    })
    expect(pool).toEqual([{ email: 'sam@x.com', name: 'Sam Cohen' }])
  })

  const pool = [
    { email: 'alex@x.com', name: 'Alex Cohen' },
    { email: 'dana@x.com', name: 'Dana Levi' },
    { email: 'sam.alexander@x.com', name: 'Sam' },
    { email: 'cohen.t@y.com', name: null },
  ]

  it('suggests everyone for a bare @, alphabetical as given', () => {
    expect(suggestInvitees(pool, '').map(i => i.email)).toEqual(pool.map(i => i.email))
  })

  it('ranks matches at the start of a name, word or email above matches inside one', () => {
    expect(suggestInvitees(pool, 'al').map(i => i.email)).toEqual(['alex@x.com', 'sam.alexander@x.com'])
    expect(suggestInvitees(pool, 'cohen').map(i => i.email)).toEqual(['alex@x.com', 'cohen.t@y.com'])
    expect(suggestInvitees(pool, 'lex').map(i => i.email)).toEqual(['alex@x.com', 'sam.alexander@x.com'])
  })

  it('leaves out people already added, and honours the limit', () => {
    expect(suggestInvitees(pool, 'al', ['ALEX@x.com']).map(i => i.email)).toEqual(['sam.alexander@x.com'])
    expect(suggestInvitees(pool, '', [], 2)).toHaveLength(2)
  })
})

describe('preset rows', () => {
  it('keeps only the overrides that differ from the default, and normalises the rest', () => {
    const draft = {
      ...emptyDraft(), title: '  Climbing ', time: '18:00', duration: 90, days: [4, 2, 4],
      overrides: { '2': { time: '18:00', duration: 90 }, '4': { time: '17:30', duration: 90 }, '6': { duration: 120 } },
      invitees: [{ email: ' Alex@X.com ', name: ' Alex ' }, { email: 'b@x.com' }],
    }
    expect(presetRow(draft)).toEqual({
      emoji: '📅', title: 'Climbing', default_time: '18:00', default_duration_minutes: 90, days: [2, 4],
      day_overrides: { '4': { time: '17:30' }, '6': { duration: 120 } },
      invitees: [{ email: 'alex@x.com', name: 'Alex' }, { email: 'b@x.com', name: null }],
    })
  })

  it('offers an unusual stored duration alongside the standard choices', () => {
    expect(durationOptions()).toContain(90)
    expect(durationOptions([100])).toContain(100)
    expect(durationOptions([100]).indexOf(100)).toBe(durationOptions([100]).indexOf(90) + 1)
  })
})

describe('creating events', () => {
  const planned = (key: string, date: string, invitees: { email: string }[] = []): PlannedEvent =>
    ({ key, presetId: 'p', emoji: '🧗', title: 'Climbing', date, dow: 2, time: '19:00', duration: 90, invitees })
  const plan = [planned('a', '2026-12-01', [{ email: 'sam@x.com' }]), planned('b', '2026-12-03'), planned('c', '2026-12-05', [{ email: 'SAM@x.com' }, { email: 'dana@x.com' }])]

  it('builds the request from the plan, invitees as bare emails', () => {
    expect(toRequestBody(plan.slice(0, 2))).toEqual({
      events: [
        { title: 'Climbing', date: '2026-12-01', startTime: '19:00', durationMinutes: 90, attendees: ['sam@x.com'] },
        { title: 'Climbing', date: '2026-12-03', startTime: '19:00', durationMinutes: 90, attendees: [] },
      ],
    })
  })

  it('counts each invited person once', () => {
    expect(countInvited(plan)).toBe(2)
    expect(countInvited([])).toBe(0)
  })

  it('reports everything created when every result is ok', () => {
    const outcome = interpretResponse(plan, 200, { results: plan.map((_, index) => ({ index, ok: true, id: `e${index}` })) })
    expect(outcome).toEqual({ kind: 'done', created: plan, failed: [] })
  })

  it('splits created from failed by position, with a reason for each failure', () => {
    const outcome = interpretResponse(plan, 200, { results: [
      { index: 2, ok: false, error: 'RATE_LIMITED' },
      { index: 0, ok: true, id: 'e0' },
      { index: 1, ok: false, error: 'UPSTREAM_ERROR' },
    ] })
    expect(outcome).toEqual({
      kind: 'done',
      created: [plan[0]],
      failed: [
        { event: plan[1], reason: 'Google could not create it' },
        { event: plan[2], reason: 'Google is limiting requests, try again in a minute' },
      ],
    })
  })

  it('counts an event the answer says nothing about as failed rather than created', () => {
    const outcome = interpretResponse(plan, 200, { results: [{ index: 0, ok: true, id: 'e0' }] })
    expect(outcome).toMatchObject({ kind: 'done', created: [plan[0]] })
    expect(outcome.kind === 'done' && outcome.failed.map(f => f.event.key)).toEqual(['b', 'c'])
  })

  it('asks for the calendar permission when Google says the token lacks it', () => {
    expect(interpretResponse(plan, 403, { error: 'INSUFFICIENT_SCOPE', results: [] })).toEqual({ kind: 'needs-scope' })
  })

  it.each([
    [401, { error: 'UNAUTHORIZED' }, /session expired/],
    [404, { error: 'NOT_CONNECTED' }, /not connected/],
    [502, { error: 'REFRESH_FAILED' }, /Reconnect Google/],
    [400, { error: 'INVALID_BODY' }, /INVALID_BODY/],
    [500, null, /500/],
    [200, { nothing: true }, /200/],
  ])('explains a %s answer', (status, body, message) => {
    const outcome = interpretResponse(plan, status, body)
    expect(outcome.kind).toBe('error')
    expect(outcome.kind === 'error' && outcome.message).toMatch(message)
  })
})
