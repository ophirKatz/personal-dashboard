import { describe, expect, it } from 'vitest'
import { addDays, format, startOfDay, subDays } from 'date-fns'
import {
  ageLabel,
  dayLabel,
  daySummary,
  describeEvent,
  durationMs,
  formatDuration,
  formatSince,
  fromLocalInput,
  groupByDay,
  latestOf,
  minutesAgo,
  newEventId,
  newestFirst,
  runningTimer,
  toLocalInput,
  upsertEvent,
  validateDraft,
  wetDiaperGuide,
  type BabyEvent,
  type EventDraft,
} from './babyEvents'

// Local times throughout: the app groups entries by the local calendar day.
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).toISOString()
const NOW = new Date(2026, 10, 28, 14, 0).getTime()

let seq = 0
function ev(partial: Partial<BabyEvent> & Pick<BabyEvent, 'type'>): BabyEvent {
  seq++
  return {
    id: `00000000-0000-0000-0000-${String(seq).padStart(12, '0')}`,
    baby_id: 'baby',
    started_at: at(28, 10),
    ended_at: null,
    in_progress: false,
    details: {},
    note: null,
    logged_by: 'mom',
    updated_by: null,
    created_at: at(28, 10),
    updated_at: at(28, 10),
    deleted_at: null,
    ...partial,
  }
}

const bottle = (ml: number, h = 10, extra: Partial<BabyEvent> = {}) =>
  ev({ type: 'feed', started_at: at(28, h), details: { method: 'bottle', ml, content: 'formula' }, ...extra })
const diaper = (kind: string, h = 10, extra: Partial<BabyEvent> = {}) =>
  ev({ type: 'diaper', started_at: at(28, h), details: { kind }, ...extra })
const sleep = (from: string, to: string | null, extra: Partial<BabyEvent> = {}) =>
  ev({ type: 'sleep', started_at: from, ended_at: to, ...extra })

describe('formatDuration / formatSince', () => {
  it('shows minutes, hours and days', () => {
    expect(formatDuration(0)).toBe('<1m')
    expect(formatDuration(59_999)).toBe('<1m')
    expect(formatDuration(60_000)).toBe('1m')
    expect(formatDuration(45 * 60_000)).toBe('45m')
    expect(formatDuration(60 * 60_000)).toBe('1h')
    expect(formatDuration(80 * 60_000)).toBe('1h 20m')
    expect(formatDuration(25 * 3600_000)).toBe('1d 1h')
    expect(formatDuration(48 * 3600_000)).toBe('2d')
  })

  it('says "just now" under a minute and "ago" after', () => {
    expect(formatSince(30_000)).toBe('just now')
    expect(formatSince(80 * 60_000)).toBe('1h 20m ago')
  })
})

describe('durationMs', () => {
  it('counts a running timer up to now', () => {
    const e = sleep(at(28, 13), null, { in_progress: true })
    expect(durationMs(e, NOW)).toBe(60 * 60_000)
  })

  it('uses the end of a finished entry, and is zero for a point in time', () => {
    expect(durationMs(sleep(at(28, 10), at(28, 11, 30)), NOW)).toBe(90 * 60_000)
    expect(durationMs(diaper('wet'), NOW)).toBe(0)
  })

  it('never goes negative (a phone clock a little behind)', () => {
    expect(durationMs(sleep(at(28, 15), null, { in_progress: true }), NOW)).toBe(0)
  })
})

describe('latestOf / runningTimer', () => {
  it('finds the most recent match, ignoring removed entries', () => {
    const events = [bottle(60, 8), bottle(90, 12), bottle(70, 13, { deleted_at: at(28, 13) }), diaper('wet', 13)]
    expect(latestOf(events, e => e.type === 'feed')?.details.ml).toBe(90)
    expect(latestOf(events, e => e.type === 'sleep')).toBeNull()
  })

  it('finds a running timer of a kind, but not a stopped, removed or different one', () => {
    const running = sleep(at(28, 13), null, { in_progress: true })
    expect(runningTimer([diaper('wet'), running], 'sleep')).toBe(running)
    expect(runningTimer([running], 'feed')).toBeNull()
    expect(runningTimer([sleep(at(28, 9), at(28, 10))], 'sleep')).toBeNull()
    expect(runningTimer([{ ...running, deleted_at: at(28, 13, 5) }], 'sleep')).toBeNull()
  })
})

describe('groupByDay / dayLabel', () => {
  it('groups by local day, newest first', () => {
    const groups = groupByDay([diaper('wet', 9), diaper('dirty', 22, { started_at: at(27, 22) }), diaper('wet', 12)])
    expect(groups.map(g => g.key)).toEqual(['2026-11-28', '2026-11-27'])
    expect(groups[0].events.map(e => format(new Date(e.started_at), 'HH:mm'))).toEqual(['12:00', '09:00'])
  })

  it('puts a late-night and an after-midnight entry on different days', () => {
    const groups = groupByDay([
      diaper('wet', 0, { started_at: new Date(2026, 10, 28, 23, 59).toISOString() }),
      diaper('wet', 0, { started_at: new Date(2026, 10, 29, 0, 1).toISOString() }),
    ])
    expect(groups.map(g => g.key)).toEqual(['2026-11-29', '2026-11-28'])
  })

  it('labels today and yesterday', () => {
    const today = startOfDay(new Date())
    expect(dayLabel(today)).toBe('Today')
    expect(dayLabel(subDays(today, 1))).toBe('Yesterday')
    expect(dayLabel(new Date(2020, 0, 5))).toBe('Sun, Jan 5')
  })
})

describe('daySummary', () => {
  const day = new Date(2026, 10, 28)

  it('counts feeds and adds up bottle milk, but not breast or solids', () => {
    const s = daySummary(
      [
        bottle(60, 6), bottle(90, 9),
        ev({ type: 'feed', started_at: at(28, 11), details: { method: 'breast', side: 'left' } }),
        ev({ type: 'feed', started_at: at(28, 12), details: { method: 'solids', food: 'pear' } }),
      ],
      day, NOW,
    )
    expect(s).toMatchObject({ feeds: 4, bottleMl: 150 })
  })

  it('counts a wet-and-dirty diaper as both, and a dry one as neither', () => {
    const s = daySummary([diaper('wet'), diaper('wet', 11), diaper('dirty', 12), diaper('both', 13), diaper('dry', 14)], day, NOW)
    expect(s).toMatchObject({ wet: 3, dirty: 2 })
  })

  it('ignores removed entries and other days', () => {
    const s = daySummary(
      [bottle(60, 9, { deleted_at: at(28, 10) }), bottle(60, 9, { started_at: at(27, 23) }), bottle(60, 9, { started_at: at(29, 0) })],
      day, NOW,
    )
    expect(s).toMatchObject({ feeds: 0, bottleMl: 0 })
  })

  it('adds up sleep, counting only the part of a sleep inside the day', () => {
    const s = daySummary(
      [
        sleep(at(27, 22), at(28, 2)),
        sleep(at(28, 9), at(28, 10, 30)),
        sleep(at(28, 23), at(29, 3)),
        sleep(at(28, 13), null, { in_progress: true }),
      ],
      day, NOW,
    )
    // 2h (to 02:00) + 1.5h + 1h (23:00 to midnight) + 1h (running since 13:00, now 14:00)
    expect(s.sleepMs).toBe((2 + 1.5 + 1 + 1) * 3600_000)
  })

  it('is all zeros for an empty day', () => {
    expect(daySummary([], day, NOW)).toEqual({ feeds: 0, bottleMl: 0, wet: 0, dirty: 0, sleepMs: 0 })
  })
})

describe('ageLabel / wetDiaperGuide', () => {
  const now = new Date(2026, 10, 28, 14, 0)

  it('describes the baby as days, weeks, then months old', () => {
    expect(ageLabel('2026-11-28', now)).toBe('Born today')
    expect(ageLabel('2026-11-27', now)).toBe('1 day old')
    expect(ageLabel('2026-11-15', now)).toBe('13 days old')
    expect(ageLabel('2026-11-14', now)).toBe('2 weeks old')
    expect(ageLabel('2026-10-05', now)).toBe('7 weeks old')
    expect(ageLabel('2026-09-28', now)).toBe('2 months old')
  })

  it('reads a date still ahead as expected, and says nothing without one', () => {
    expect(ageLabel('2026-12-04', now)).toBe('Expected in 6 days')
    expect(ageLabel('2026-11-29', now)).toBe('Expected in 1 day')
    expect(ageLabel(null, now)).toBeNull()
  })

  it('expects as many wet diapers as days old for the first week, then six', () => {
    const guide = (born: string) => wetDiaperGuide(born, now)
    expect(guide('2026-11-28')).toEqual({ dayOfLife: 1, expectedWet: 1 })
    expect(guide('2026-11-26')).toEqual({ dayOfLife: 3, expectedWet: 3 })
    expect(guide('2026-11-23')).toEqual({ dayOfLife: 6, expectedWet: 6 })
    expect(guide('2026-11-10')).toEqual({ dayOfLife: 19, expectedWet: 6 })
  })

  it('gives no guide before the birth, after the first month, or without a date', () => {
    expect(wetDiaperGuide('2026-11-29', now)).toBeNull()
    expect(wetDiaperGuide('2026-10-28', now)).toBeNull()
    expect(wetDiaperGuide(null, now)).toBeNull()
  })
})

describe('describeEvent', () => {
  const d = (e: BabyEvent) => describeEvent(e, NOW)

  it('describes feeds', () => {
    expect(d(bottle(90))).toEqual({ title: 'Bottle', detail: '90 ml · formula', flag: null })
    expect(d(ev({ type: 'feed', details: { method: 'bottle' } })).detail).toBeNull()
    expect(d(ev({ type: 'feed', details: { method: 'solids', food: 'pear' } }))).toMatchObject({ title: 'Solids', detail: 'pear' })
    expect(d(ev({ type: 'feed', started_at: at(28, 10), ended_at: at(28, 10, 12), details: { method: 'breast', side: 'left' } })))
      .toMatchObject({ title: 'Breastfeed', detail: 'Left · 12m' })
    expect(d(ev({ type: 'feed', started_at: at(28, 13, 40), in_progress: true, details: { method: 'breast', side: 'right' } })).detail)
      .toBe('Right · feeding 20m')
  })

  it('describes diapers, and flags a pale stool', () => {
    expect(d(diaper('wet'))).toEqual({ title: 'Wet diaper', detail: null, flag: null })
    expect(d(diaper('both')).title).toBe('Wet + dirty diaper')
    expect(d(ev({ type: 'diaper', details: { kind: 'dirty', stool_color: 'yellow' } }))).toMatchObject({ detail: 'Yellow', flag: null })
    expect(d(ev({ type: 'diaper', details: { kind: 'dirty', stool_color: 'grey_white' } }))).toMatchObject({ detail: 'Grey / white', flag: 'pale_stool' })
  })

  it('describes sleep, finished or running', () => {
    expect(d(sleep(at(28, 9), at(28, 10, 30))).detail).toBe('1h 30m')
    expect(d(sleep(at(28, 13), null, { in_progress: true })).detail).toBe('sleeping 1h')
  })

  it('flags a fever and appends the note', () => {
    expect(d(ev({ type: 'temperature', details: { c: 37.4 } }))).toMatchObject({ detail: '37.4 °C', flag: null })
    expect(d(ev({ type: 'temperature', details: { c: 38 } }))).toMatchObject({ detail: '38 °C', flag: 'fever' })
    expect(d(ev({ type: 'note', note: 'Fussy after the bath' }))).toEqual({ title: 'Note', detail: 'Fussy after the bath', flag: null })
    expect(d(bottle(60, 10, { note: 'spat up' })).detail).toBe('60 ml · formula · spat up')
  })

  it('copes with details it does not understand', () => {
    expect(() => d(ev({ type: 'feed', details: { method: 5 } }))).not.toThrow()
    expect(d(ev({ type: 'diaper', details: {} })).title).toBe('Diaper')
  })
})

describe('validateDraft', () => {
  const base: EventDraft = {
    type: 'feed',
    started_at: at(28, 13),
    ended_at: null,
    in_progress: false,
    details: { method: 'bottle', ml: 90 },
    note: null,
  }
  const check = (patch: Partial<EventDraft>) => validateDraft({ ...base, ...patch }, NOW)

  it('accepts a sensible entry', () => {
    expect(check({})).toBeNull()
    expect(check({ type: 'diaper', details: { kind: 'wet' } })).toBeNull()
    expect(check({ type: 'sleep', details: {}, started_at: at(28, 11), ended_at: at(28, 12) })).toBeNull()
    expect(check({ type: 'sleep', details: {}, in_progress: true })).toBeNull()
    expect(check({ details: { method: 'breast' } })).toBeNull()
  })

  it('rejects times that make no sense', () => {
    expect(check({ started_at: 'nonsense' })).toMatch(/start time/)
    expect(check({ started_at: at(28, 16) })).toMatch(/hasn't happened/)
    expect(check({ started_at: at(28, 14, 1) })).toBeNull() // a minute ahead is just clock drift
    expect(check({ ended_at: at(28, 12) })).toMatch(/before the start/)
    expect(check({ ended_at: at(28, 18) })).toMatch(/hasn't happened/)
    expect(check({ ended_at: 'x' })).toMatch(/end time/)
    expect(check({ in_progress: true, ended_at: at(28, 13, 30) })).toMatch(/running timer/)
  })

  it('rejects incomplete or out-of-range details', () => {
    expect(check({ details: {} })).toMatch(/breast, bottle or solids/)
    expect(check({ details: { method: 'bottle', ml: 0 } })).toMatch(/amount/)
    expect(check({ details: { method: 'bottle', ml: 601 } })).toMatch(/amount/)
    expect(check({ details: { method: 'bottle', ml: '90' } })).toMatch(/amount/)
    expect(check({ type: 'diaper', details: {} })).toMatch(/diaper/)
    expect(check({ note: 'x'.repeat(501) })).toMatch(/Notes/)
    expect(check({ type: 'note', details: {}, note: null })).toMatch(/Write something/)
    expect(check({ type: 'note', details: {}, note: 'Fussy' })).toBeNull()
    expect(check({ type: 'sleep', details: {}, ended_at: null })).toMatch(/sleep ended/)
  })
})

describe('upsertEvent', () => {
  it('adds a new entry in time order', () => {
    const a = bottle(60, 8)
    const c = bottle(60, 12)
    const b = bottle(60, 10)
    expect(upsertEvent([c, a], b).map(e => e.id)).toEqual([c.id, b.id, a.id])
  })

  it('replaces an entry with the same id, wherever its new time puts it', () => {
    const a = bottle(60, 8)
    const b = bottle(60, 10)
    const moved = { ...a, started_at: at(28, 12), details: { method: 'bottle', ml: 100 } }
    const next = upsertEvent([b, a], moved)
    expect(next.map(e => e.id)).toEqual([a.id, b.id])
    expect(next[0].details.ml).toBe(100)
  })

  it('drops an entry that arrives marked as removed', () => {
    const a = bottle(60, 8)
    const b = bottle(60, 10)
    expect(upsertEvent([b, a], { ...a, deleted_at: at(28, 11) }).map(e => e.id)).toEqual([b.id])
    expect(upsertEvent([b], { ...a, deleted_at: at(28, 11) }).map(e => e.id)).toEqual([b.id])
  })

  it('does not change the list it was given', () => {
    const list = [bottle(60, 8)]
    upsertEvent(list, bottle(60, 9))
    expect(list).toHaveLength(1)
  })
})

describe('time helpers', () => {
  it('round-trips a time through the datetime-local format', () => {
    const iso = at(28, 9, 5)
    expect(toLocalInput(iso)).toBe('2026-11-28T09:05')
    expect(fromLocalInput('2026-11-28T09:05')).toBe(iso)
    expect(fromLocalInput('')).toBeNull()
    expect(fromLocalInput('not a date')).toBeNull()
  })

  it('goes back by minutes', () => {
    expect(minutesAgo(30, NOW)).toBe(new Date(NOW - 30 * 60_000).toISOString())
    expect(minutesAgo(0, NOW)).toBe(new Date(NOW).toISOString())
  })

  it('makes a fresh uuid for every entry', () => {
    const ids = new Set(Array.from({ length: 50 }, newEventId))
    expect(ids.size).toBe(50)
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('sorts newest first, with a stable order for equal times', () => {
    const a = bottle(60, 8)
    const b = bottle(60, 8)
    const c = bottle(60, 9)
    const sorted = newestFirst([a, b, c])
    expect(sorted[0]).toBe(c)
    expect(newestFirst([b, a, c]).map(e => e.id)).toEqual(sorted.map(e => e.id))
  })

  it('has day arithmetic that survives a daylight saving change', () => {
    // 2026-03-27 is when Israel moves its clocks forward: that local day has 23 hours.
    const start = new Date(2026, 2, 27)
    const next = addDays(start, 1)
    expect(format(next, 'yyyy-MM-dd HH:mm')).toBe('2026-03-28 00:00')
  })
})
