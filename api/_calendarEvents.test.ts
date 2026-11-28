import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./_googleAuth.js', () => ({ authenticateGoogleRequest: vi.fn() }))

const { authenticateGoogleRequest } = await import('./_googleAuth.js')
const { default: handler } = await import('./google-calendar-events')
const {
  addMinutesToWallClock, isInsufficientScope, isRateLimited, parseNewEvents, toGoogleEvent,
} = await import('./_calendarEvents')

const event = { title: 'Climbing', date: '2026-12-01', startTime: '19:00', durationMinutes: 90 }

describe('parseNewEvents', () => {
  it('accepts valid events, trimming titles and normalising + de-duplicating attendees', () => {
    const parsed = parseNewEvents({ events: [{ ...event, title: '  Climbing ', attendees: ['Alex@X.com', ' alex@x.com', 'b@x.com'] }] })
    expect(parsed).toEqual({
      ok: true,
      events: [{ ...event, attendees: ['alex@x.com', 'b@x.com'] }],
    })
  })

  it('treats attendees as optional', () => {
    const parsed = parseNewEvents({ events: [event] })
    expect(parsed).toEqual({ ok: true, events: [{ ...event, attendees: [] }] })
  })

  it.each([
    ['no body', undefined],
    ['no events', {}],
    ['an empty list', { events: [] }],
    ['a blank title', { events: [{ ...event, title: '   ' }] }],
    ['a title that is too long', { events: [{ ...event, title: 'x'.repeat(201) }] }],
    ['a malformed date', { events: [{ ...event, date: '2026-1-1' }] }],
    ['an impossible date', { events: [{ ...event, date: '2026-02-30' }] }],
    ['an invalid time', { events: [{ ...event, startTime: '24:00' }] }],
    ['a time with seconds', { events: [{ ...event, startTime: '19:00:00' }] }],
    ['a fractional duration', { events: [{ ...event, durationMinutes: 90.5 }] }],
    ['a zero duration', { events: [{ ...event, durationMinutes: 0 }] }],
    ['a duration over a day', { events: [{ ...event, durationMinutes: 1441 }] }],
    ['a duration given as text', { events: [{ ...event, durationMinutes: '90' }] }],
    ['an invalid attendee', { events: [{ ...event, attendees: ['nope'] }] }],
    ['attendees that are not a list', { events: [{ ...event, attendees: 'a@b.co' }] }],
    ['a non-object event', { events: ['x'] }],
  ])('rejects %s', (_label, body) => {
    expect(parseNewEvents(body).ok).toBe(false)
  })

  it('caps the number of events and attendees', () => {
    expect(parseNewEvents({ events: Array.from({ length: 51 }, () => event) }).ok).toBe(false)
    expect(parseNewEvents({ events: Array.from({ length: 50 }, () => event) }).ok).toBe(true)
    const many = Array.from({ length: 51 }, (_, i) => `p${i}@x.com`)
    expect(parseNewEvents({ events: [{ ...event, attendees: many }] }).ok).toBe(false)
  })
})

describe('toGoogleEvent', () => {
  it('sends wall-clock start/end with the app timezone, and an attendee list', () => {
    expect(toGoogleEvent({ ...event, attendees: ['a@b.co'] })).toEqual({
      summary: 'Climbing',
      start: { dateTime: '2026-12-01T19:00:00', timeZone: 'Asia/Jerusalem' },
      end: { dateTime: '2026-12-01T20:30:00', timeZone: 'Asia/Jerusalem' },
      attendees: [{ email: 'a@b.co' }],
    })
  })

  it('leaves the attendee list out when nobody is invited', () => {
    expect(toGoogleEvent({ ...event, attendees: [] })).not.toHaveProperty('attendees')
  })

  it('rolls the end over midnight and across a month', () => {
    expect(addMinutesToWallClock('2026-12-31', '23:00', 180)).toEqual({ date: '2027-01-01', time: '02:00' })
    expect(toGoogleEvent({ ...event, date: '2026-12-31', startTime: '22:30', durationMinutes: 120, attendees: [] }).end.dateTime)
      .toBe('2027-01-01T00:30:00')
  })
})

describe('classifying Google errors', () => {
  const scope = { error: { code: 403, message: 'Request had insufficient authentication scopes.', errors: [{ reason: 'insufficientPermissions' }], details: [{ reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' }] } }
  const rate = { error: { code: 403, message: 'Rate Limit Exceeded', errors: [{ reason: 'rateLimitExceeded' }] } }

  it('recognises a token without the write scope', () => {
    expect(isInsufficientScope(403, scope)).toBe(true)
    expect(isInsufficientScope(403, { error: { message: 'Request had insufficient authentication scopes.' } })).toBe(true)
    expect(isInsufficientScope(403, { error: { details: [{ reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' }] } })).toBe(true)
  })

  it('does not mistake other failures for it', () => {
    expect(isInsufficientScope(403, rate)).toBe(false)
    expect(isInsufficientScope(401, scope)).toBe(false)
    expect(isInsufficientScope(500, null)).toBe(false)
  })

  it('recognises rate limiting, which Google reports as 403 or 429', () => {
    expect(isRateLimited(403, rate)).toBe(true)
    expect(isRateLimited(403, { error: { errors: [{ reason: 'userRateLimitExceeded' }] } })).toBe(true)
    expect(isRateLimited(429, null)).toBe(true)
    expect(isRateLimited(403, scope)).toBe(false)
  })
})

describe('POST /api/google-calendar-events', () => {
  const fetchMock = vi.fn()

  function run(method: string, body: unknown) {
    const res = {
      statusCode: 0,
      body: undefined as unknown,
      status(code: number) { this.statusCode = code; return this },
      json(payload: unknown) { this.body = payload; return this },
    }
    return handler({ method, body, headers: {} } as never, res as never).then(() => res)
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    vi.mocked(authenticateGoogleRequest).mockResolvedValue({ ok: true, accessToken: 'tok', userId: 'u', supabase: {} as never })
  })
  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  const googleOk = (id: string) => new Response(JSON.stringify({ id, htmlLink: `https://calendar.google.com/${id}` }), { status: 200 })
  const googleErr = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })

  it('only accepts POST', async () => {
    const res = await run('GET', undefined)
    expect(res.statusCode).toBe(405)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stops at the auth failure', async () => {
    vi.mocked(authenticateGoogleRequest).mockResolvedValue({ ok: false, status: 401, error: 'UNAUTHORIZED' })
    const res = await run('POST', { events: [event] })
    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ error: 'UNAUTHORIZED' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects an invalid body without calling Google', async () => {
    const res = await run('POST', { events: [{ ...event, startTime: 'noon' }] })
    expect(res.statusCode).toBe(400)
    expect(res.body).toMatchObject({ error: 'INVALID_BODY' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('creates each event on the primary calendar and emails the invitations', async () => {
    fetchMock.mockImplementation(async () => googleOk('abc'))
    const res = await run('POST', { events: [{ ...event, attendees: ['a@b.co'] }] })

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ results: [{ index: 0, ok: true, id: 'abc', htmlLink: 'https://calendar.google.com/abc' }] })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer tok')
    expect(JSON.parse(init.body)).toEqual({
      summary: 'Climbing',
      start: { dateTime: '2026-12-01T19:00:00', timeZone: 'Asia/Jerusalem' },
      end: { dateTime: '2026-12-01T20:30:00', timeZone: 'Asia/Jerusalem' },
      attendees: [{ email: 'a@b.co' }],
    })
  })

  it('creates every event of a week, reporting each by its position', async () => {
    let n = 0
    fetchMock.mockImplementation(async () => googleOk(`id${n++}`))
    const events = Array.from({ length: 7 }, (_, i) => ({ ...event, date: `2026-12-0${i + 1}` }))
    const res = await run('POST', { events })

    expect(fetchMock).toHaveBeenCalledTimes(7)
    const results = (res.body as { results: { index: number; ok: boolean }[] }).results
    expect(results.map(r => r.index)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(results.every(r => r.ok)).toBe(true)
  })

  it('reports a failed event without losing the ones that worked', async () => {
    fetchMock.mockImplementation(async (_url: string, init: { body: string }) => {
      const { summary } = JSON.parse(init.body)
      if (summary === 'Bad') return googleErr(500, { error: { message: 'boom' } })
      if (summary === 'Slow') return googleErr(403, { error: { errors: [{ reason: 'userRateLimitExceeded' }] } })
      return googleOk('ok')
    })
    const res = await run('POST', { events: [event, { ...event, title: 'Bad' }, { ...event, title: 'Slow' }] })

    expect(res.statusCode).toBe(200)
    expect((res.body as { results: unknown[] }).results).toEqual([
      { index: 0, ok: true, id: 'ok', htmlLink: 'https://calendar.google.com/ok' },
      { index: 1, ok: false, error: 'UPSTREAM_ERROR' },
      { index: 2, ok: false, error: 'RATE_LIMITED' },
    ])
  })

  it('treats a network failure as a failed event, not a crash', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))
    const res = await run('POST', { events: [event] })
    expect(res.statusCode).toBe(200)
    expect((res.body as { results: unknown[] }).results).toEqual([{ index: 0, ok: false, error: 'UPSTREAM_ERROR' }])
  })

  it('answers 403 INSUFFICIENT_SCOPE and stops, so the UI can ask for consent', async () => {
    fetchMock.mockImplementation(async () => googleErr(403, {
      error: { code: 403, message: 'Request had insufficient authentication scopes.', errors: [{ reason: 'insufficientPermissions' }] },
    }))
    const events = Array.from({ length: 9 }, (_, i) => ({ ...event, date: `2026-12-0${i + 1}` }))
    const res = await run('POST', { events })

    expect(res.statusCode).toBe(403)
    expect(res.body).toMatchObject({ error: 'INSUFFICIENT_SCOPE' })
    // The first batch finds out; the remaining events are never attempted.
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
