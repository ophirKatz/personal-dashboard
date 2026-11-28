import { describe, expect, it } from 'vitest'
import { validateDraft, type BabyEvent } from './babyEvents'
import { buildDraft, clampMl, clampPumpMl, feedDefaults, initialForm, nextSide, type FeedDefaults, type FormTarget } from './eventForm'

const local = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m)
const NOW = local(28, 14).getTime()

let seq = 0
function ev(partial: Partial<BabyEvent> & Pick<BabyEvent, 'type'>): BabyEvent {
  seq++
  return {
    id: `10000000-0000-0000-0000-${String(seq).padStart(12, '0')}`,
    baby_id: 'baby',
    started_at: local(28, 10).toISOString(),
    ended_at: null,
    in_progress: false,
    details: {},
    note: null,
    logged_by: 'mom',
    updated_by: null,
    created_at: local(28, 10).toISOString(),
    updated_at: local(28, 10).toISOString(),
    deleted_at: null,
    ...partial,
  }
}

const NO_DEFAULTS: FeedDefaults = { method: null, side: null, ml: null, content: null }
const create = (type: 'feed' | 'diaper' | 'sleep' | 'pump' | 'note'): FormTarget => ({ mode: 'create', type })
const form = (target: FormTarget, defaults = NO_DEFAULTS) => initialForm(target, defaults, NOW)

describe('feedDefaults', () => {
  it('starts empty with no history', () => {
    expect(feedDefaults([])).toEqual(NO_DEFAULTS)
  })

  it('remembers the last method, the last bottle and the last breast side', () => {
    const events = [
      ev({ type: 'feed', started_at: local(28, 6).toISOString(), details: { method: 'bottle', ml: 80, content: 'breast_milk' } }),
      ev({ type: 'feed', started_at: local(28, 8).toISOString(), details: { method: 'breast', side: 'left' } }),
      ev({ type: 'feed', started_at: local(28, 9).toISOString(), details: { method: 'bottle', ml: 110, content: 'formula' } }),
      ev({ type: 'feed', started_at: local(28, 11).toISOString(), details: { method: 'breast', side: 'right' } }),
      ev({ type: 'diaper', started_at: local(28, 12).toISOString(), details: { kind: 'wet' } }),
    ]
    expect(feedDefaults(events)).toEqual({ method: 'breast', side: 'right', ml: 110, content: 'formula' })
  })

  it('ignores removed feeds', () => {
    const events = [
      ev({ type: 'feed', details: { method: 'bottle', ml: 90 }, started_at: local(28, 9).toISOString() }),
      ev({ type: 'feed', details: { method: 'bottle', ml: 200 }, started_at: local(28, 12).toISOString(), deleted_at: local(28, 13).toISOString() }),
    ]
    expect(feedDefaults(events).ml).toBe(90)
  })
})

describe('initialForm', () => {
  it('starts a new feed now, on the opposite side from last time and with the last bottle', () => {
    const f = form(create('feed'), { method: 'bottle', side: 'left', ml: 110, content: 'breast_milk' })
    expect(f).toMatchObject({ startedAt: '2026-11-28T14:00', method: 'bottle', side: 'right', ml: 110, content: 'breast_milk' })
  })

  it('has sensible first-time defaults', () => {
    expect(form(create('feed'))).toMatchObject({ method: 'breast', side: 'left', ml: 60, content: 'formula' })
    expect(form(create('diaper'))).toMatchObject({ kind: 'wet', stoolColor: null, note: '' })
  })

  it('offers the last hour for a sleep logged afterwards', () => {
    expect(form(create('sleep'))).toMatchObject({ startedAt: '2026-11-28T13:00', endedAt: '2026-11-28T14:00' })
  })

  it('fills the form from an existing entry', () => {
    const e = ev({
      type: 'feed',
      started_at: local(28, 9, 30).toISOString(),
      ended_at: local(28, 9, 45).toISOString(),
      details: { method: 'breast', side: 'right' },
      note: 'sleepy',
    })
    expect(form({ mode: 'edit', event: e })).toMatchObject({
      startedAt: '2026-11-28T09:30', endedAt: '2026-11-28T09:45', method: 'breast', side: 'right', note: 'sleepy',
    })
    const d = ev({ type: 'diaper', details: { kind: 'dirty', stool_color: 'green' } })
    expect(form({ mode: 'edit', event: d })).toMatchObject({ kind: 'dirty', stoolColor: 'green' })
  })

  it('cycles breast sides', () => {
    expect(nextSide(null)).toBe('left')
    expect(nextSide('left')).toBe('right')
    expect(nextSide('right')).toBe('left')
    expect(nextSide('both')).toBe('left')
  })
})

describe('buildDraft: new entries', () => {
  const save = (target: FormTarget, change: Partial<ReturnType<typeof form>> = {}, startTimer = false) => {
    const draft = buildDraft({ ...form(target), ...change }, target, NOW, startTimer)
    return { draft, error: validateDraft(draft, NOW) }
  }

  it('saves a bottle with its amount and what was in it', () => {
    const { draft, error } = save(create('feed'), { method: 'bottle', ml: 95, content: 'breast_milk', note: ' burped ' })
    expect(error).toBeNull()
    expect(draft).toMatchObject({
      type: 'feed', in_progress: false, ended_at: null, note: 'burped',
      details: { method: 'bottle', ml: 95, content: 'breast_milk' },
    })
    expect(draft.started_at).toBe(local(28, 14).toISOString())
  })

  it('starts a breast feed timer from now, whatever the time fields say', () => {
    const { draft, error } = save(create('feed'), { method: 'breast', side: 'right', startedAt: '2026-11-28T09:00' }, true)
    expect(error).toBeNull()
    expect(draft).toMatchObject({ in_progress: true, ended_at: null, details: { method: 'breast', side: 'right' } })
    expect(draft.started_at).toBe(new Date(NOW).toISOString())
  })

  it('saves a finished breast feed with its length', () => {
    const { draft, error } = save(create('feed'), { method: 'breast', side: 'left', startedAt: '2026-11-28T13:30', durationMin: '12' })
    expect(error).toBeNull()
    expect(draft.ended_at).toBe(local(28, 13, 42).toISOString())
    expect(draft.in_progress).toBe(false)
  })

  it('saves a breast feed with no length as a point in time', () => {
    expect(save(create('feed'), { method: 'breast', durationMin: '' }).draft.ended_at).toBeNull()
    expect(save(create('feed'), { method: 'breast', durationMin: '-5' }).draft.ended_at).toBeNull()
    expect(save(create('feed'), { method: 'breast', durationMin: 'abc' }).draft.ended_at).toBeNull()
  })

  it('keeps only the details that belong to the chosen method', () => {
    const { draft } = save(create('feed'), { method: 'solids', food: ' banana ', ml: 120, side: 'right' })
    expect(draft.details).toEqual({ method: 'solids', food: 'banana' })
    expect(save(create('feed'), { method: 'solids', food: '  ' }).draft.details).toEqual({ method: 'solids' })
    expect(save(create('feed'), { method: 'breast', side: 'left', ml: 120 }).draft.details).toEqual({ method: 'breast', side: 'left' })
  })

  it('saves a diaper, with a stool color only when there is stool', () => {
    expect(save(create('diaper'), { kind: 'dirty', stoolColor: 'yellow' }).draft.details).toEqual({ kind: 'dirty', stool_color: 'yellow' })
    expect(save(create('diaper'), { kind: 'both', stoolColor: 'green' }).draft.details).toEqual({ kind: 'both', stool_color: 'green' })
    expect(save(create('diaper'), { kind: 'wet', stoolColor: 'green' }).draft.details).toEqual({ kind: 'wet' })
    expect(save(create('diaper'), { kind: 'dry' }).error).toBeNull()
  })

  it('saves a past sleep with both ends, and refuses one with no end', () => {
    const ok = save(create('sleep'))
    expect(ok.error).toBeNull()
    expect(ok.draft).toMatchObject({ type: 'sleep', in_progress: false, details: {} })
    expect(ok.draft.ended_at).toBe(local(28, 14).toISOString())
    expect(save(create('sleep'), { endedAt: '' }).error).toMatch(/sleep ended/)
    expect(save(create('sleep'), { startedAt: '2026-11-28T13:30', endedAt: '2026-11-28T13:00' }).error).toMatch(/before the start/)
  })

  it('needs words for a note', () => {
    expect(save(create('note'), { note: '  ' }).error).toMatch(/Write something/)
    expect(save(create('note'), { note: 'Rash on the left cheek' }).error).toBeNull()
  })

  it('reports a bad time instead of saving it', () => {
    expect(save(create('diaper'), { startedAt: '' }).error).toMatch(/start time/)
    expect(save(create('diaper'), { startedAt: '2026-11-28T18:00' }).error).toMatch(/hasn't happened/)
  })
})

describe('buildDraft: pumping', () => {
  const save = (target: FormTarget, change: Partial<ReturnType<typeof form>> = {}) => {
    const draft = buildDraft({ ...form(target), ...change }, target, NOW)
    return { draft, error: validateDraft(draft, NOW) }
  }

  it('starts at nothing from either side, not at the bottle amount', () => {
    expect(form(create('pump'), { method: 'bottle', side: null, ml: 110, content: 'formula' })).toMatchObject({ mlLeft: 0, mlRight: 0 })
  })

  it('saves what came from each side', () => {
    const { draft, error } = save(create('pump'), { mlLeft: 80, mlRight: 60 })
    expect(error).toBeNull()
    expect(draft).toMatchObject({ type: 'pump', in_progress: false, ended_at: null, details: { ml_left: 80, ml_right: 60 } })
    expect(draft.started_at).toBe(local(28, 14).toISOString())
  })

  it('leaves out a side that gave nothing', () => {
    expect(save(create('pump'), { mlLeft: 45, mlRight: 0 }).draft.details).toEqual({ ml_left: 45 })
    expect(save(create('pump'), { mlLeft: 0, mlRight: 30 }).draft.details).toEqual({ ml_right: 30 })
  })

  it('reads "now" plus a length as a session that has just finished', () => {
    const { draft, error } = save(create('pump'), { mlLeft: 70, mlRight: 50, durationMin: '18' })
    expect(error).toBeNull()
    expect(draft.started_at).toBe(local(28, 13, 42).toISOString())
    expect(draft.ended_at).toBe(local(28, 14).toISOString())
  })

  it('does the same for a breast feed, but not when the start was set to some other time', () => {
    const f = save(create('feed'), { method: 'breast', durationMin: '12' })
    expect(f.error).toBeNull()
    expect(f.draft.started_at).toBe(local(28, 13, 48).toISOString())
    // Started 5 minutes ago and lasted 20 would end in the future: that stays an error.
    const bad = save(create('pump'), { mlLeft: 70, startedAt: '2026-11-28T13:55', durationMin: '20' })
    expect(bad.error).toMatch(/hasn't happened/)
  })

  it('refuses a session with nothing in it', () => {
    expect(save(create('pump')).error).toMatch(/how much you pumped/)
  })

  it('records how long it took, when told', () => {
    const { draft, error } = save(create('pump'), { mlLeft: 70, mlRight: 50, startedAt: '2026-11-28T13:30', durationMin: '20' })
    expect(error).toBeNull()
    expect(draft.ended_at).toBe(local(28, 13, 50).toISOString())
    expect(save(create('pump'), { mlLeft: 70, durationMin: '' }).draft.ended_at).toBeNull()
  })

  it('fills the form from a saved session, and keeps what it does not know about', () => {
    const e = ev({ type: 'pump', details: { ml_left: 80, ml_right: 60, bag: 'A' } })
    const target: FormTarget = { mode: 'edit', event: e }
    expect(form(target)).toMatchObject({ mlLeft: 80, mlRight: 60 })
    expect(buildDraft({ ...form(target), mlRight: 0 }, target, NOW).details).toEqual({ ml_left: 80, bag: 'A' })
  })
})

describe('buildDraft: editing', () => {
  it('keeps details the form does not know about', () => {
    const e = ev({ type: 'feed', details: { method: 'bottle', ml: 60, content: 'formula', brand: 'X' } })
    const target: FormTarget = { mode: 'edit', event: e }
    const draft = buildDraft({ ...form(target), ml: 80 }, target, NOW)
    expect(draft.details).toEqual({ method: 'bottle', ml: 80, content: 'formula', brand: 'X' })
  })

  it('drops the color when a dirty diaper becomes wet', () => {
    const e = ev({ type: 'diaper', details: { kind: 'dirty', stool_color: 'green' } })
    const target: FormTarget = { mode: 'edit', event: e }
    expect(buildDraft({ ...form(target), kind: 'wet' }, target, NOW).details).toEqual({ kind: 'wet' })
    expect(buildDraft(form(target), target, NOW).details).toEqual({ kind: 'dirty', stool_color: 'green' })
  })

  it('leaves a running timer running, with only its start time editable', () => {
    const e = ev({ type: 'sleep', started_at: local(28, 13).toISOString(), in_progress: true })
    const target: FormTarget = { mode: 'edit', event: e }
    const draft = buildDraft({ ...form(target), startedAt: '2026-11-28T12:30' }, target, NOW)
    expect(draft).toMatchObject({ in_progress: true, ended_at: null })
    expect(draft.started_at).toBe(local(28, 12, 30).toISOString())
    expect(validateDraft(draft, NOW)).toBeNull()
  })

  it('changes the end of a finished entry', () => {
    const e = ev({
      type: 'feed',
      started_at: local(28, 9).toISOString(),
      ended_at: local(28, 9, 10).toISOString(),
      details: { method: 'breast', side: 'left' },
    })
    const target: FormTarget = { mode: 'edit', event: e }
    const draft = buildDraft({ ...form(target), endedAt: '2026-11-28T09:20' }, target, NOW)
    expect(draft.ended_at).toBe(local(28, 9, 20).toISOString())
  })

  it('does not invent an end for a point-in-time entry', () => {
    const e = ev({ type: 'diaper', details: { kind: 'wet' } })
    const target: FormTarget = { mode: 'edit', event: e }
    expect(buildDraft(form(target), target, NOW)).toMatchObject({ ended_at: null, in_progress: false })
  })
})

describe('clampPumpMl', () => {
  it('allows the larger range of a pumping session, and treats junk as nothing', () => {
    expect(clampPumpMl(250.6)).toBe(251)
    expect(clampPumpMl(-3)).toBe(0)
    expect(clampPumpMl(5000)).toBe(1000)
    expect(clampPumpMl(NaN)).toBe(0)
  })
})

describe('clampMl', () => {
  it('keeps an amount inside what the database accepts', () => {
    expect(clampMl(95.4)).toBe(95)
    expect(clampMl(-10)).toBe(0)
    expect(clampMl(5000)).toBe(600)
    expect(clampMl(NaN)).toBe(60)
  })
})
