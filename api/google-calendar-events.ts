import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateGoogleRequest } from './_googleAuth.js'
import { isInsufficientScope, isRateLimited, parseNewEvents, toGoogleEvent, type NewEvent } from './_calendarEvents.js'

// Creates events on the user's primary Google Calendar (the personal account that the
// dashboard login uses — authenticateGoogleRequest picks it, same as Tasks and Drive).
// sendUpdates=all makes Google email the invitations to the attendees.
const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all'

// Small batches keep a whole week's worth of events inside the function's time limit
// without tripping Google's per-user rate limit.
const BATCH_SIZE = 3

type EventResult =
  | { index: number; ok: true; id: string; htmlLink: string | null }
  | { index: number; ok: false; error: 'INSUFFICIENT_SCOPE' | 'RATE_LIMITED' | 'UPSTREAM_ERROR' }

async function insertEvent(index: number, event: NewEvent, accessToken: string): Promise<EventResult> {
  let res: Response
  try {
    res = await fetch(EVENTS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(toGoogleEvent(event)),
    })
  } catch {
    return { index, ok: false, error: 'UPSTREAM_ERROR' }
  }

  if (res.ok) {
    const created: { id?: string; htmlLink?: string } = await res.json().catch(() => ({}))
    return { index, ok: true, id: created.id ?? '', htmlLink: created.htmlLink ?? null }
  }

  const body = await res.json().catch(() => null)
  if (isInsufficientScope(res.status, body)) return { index, ok: false, error: 'INSUFFICIENT_SCOPE' }
  if (isRateLimited(res.status, body)) return { index, ok: false, error: 'RATE_LIMITED' }
  return { index, ok: false, error: 'UPSTREAM_ERROR' }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
    return
  }

  const auth = await authenticateGoogleRequest(req)
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error })
    return
  }

  const parsed = parseNewEvents(req.body)
  if (!parsed.ok) {
    res.status(400).json({ error: 'INVALID_BODY', detail: parsed.detail })
    return
  }

  const results: EventResult[] = []
  for (let start = 0; start < parsed.events.length; start += BATCH_SIZE) {
    const batch = parsed.events.slice(start, start + BATCH_SIZE)
    results.push(...await Promise.all(batch.map((event, i) => insertEvent(start + i, event, auth.accessToken))))

    // The stored token predates the write scope: every remaining insert would fail the same way.
    if (results.some(r => !r.ok && r.error === 'INSUFFICIENT_SCOPE')) {
      res.status(403).json({ error: 'INSUFFICIENT_SCOPE', results })
      return
    }
  }

  res.status(200).json({ results })
}
