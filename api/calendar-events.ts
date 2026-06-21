import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateGoogleRequest } from './_googleAuth'

type GoogleEventTime = { date?: string; dateTime?: string }
type GoogleEvent = {
  id: string
  summary?: string
  htmlLink: string
  location?: string
  status?: string
  start: GoogleEventTime
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await authenticateGoogleRequest(req)
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error })
    return
  }

  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 90)
  const timeMin = new Date(new Date().toISOString().slice(0, 10)).toISOString()
  const timeMax = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  })

  let eventsRes: Response
  try {
    eventsRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })
  } catch {
    res.status(502).json({ error: 'UPSTREAM_ERROR' })
    return
  }

  if (!eventsRes.ok) {
    res.status(502).json({ error: 'UPSTREAM_ERROR' })
    return
  }

  const data: { items?: GoogleEvent[] } = await eventsRes.json()

  const events = (data.items ?? [])
    .filter(ev => ev.status !== 'cancelled' && (ev.start.date || ev.start.dateTime))
    .map(ev => ({
      id: ev.id,
      title: ev.summary ?? '(No title)',
      event_date: ev.start.date ?? ev.start.dateTime!.slice(0, 10),
      event_time: ev.start.dateTime ? ev.start.dateTime.slice(11, 19) : null,
      notes: ev.location ?? null,
      htmlLink: ev.htmlLink,
    }))

  res.status(200).json({ events })
}
