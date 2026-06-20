import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

type GoogleTokenRow = {
  refresh_token: string
  access_token: string | null
  access_token_expires_at: string | null
}

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
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!supabaseUrl || !supabaseAnonKey || !clientId || !clientSecret) {
    res.status(500).json({ error: 'MISSING_CONFIG' })
    return
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'UNAUTHORIZED' })
    return
  }
  const userJwt = authHeader.slice('Bearer '.length)

  // Scoped client: RLS enforces that this user can only ever see their own row.
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
  })

  const { data: userData, error: userError } = await supabase.auth.getUser(userJwt)
  if (userError || !userData.user) {
    res.status(401).json({ error: 'UNAUTHORIZED' })
    return
  }

  const { data: tokenRow } = await supabase
    .from('google_calendar_tokens')
    .select('refresh_token, access_token, access_token_expires_at')
    .eq('user_id', userData.user.id)
    .maybeSingle<GoogleTokenRow>()

  if (!tokenRow) {
    res.status(404).json({ error: 'NOT_CONNECTED' })
    return
  }

  let accessToken = tokenRow.access_token
  const expiresAt = tokenRow.access_token_expires_at ? new Date(tokenRow.access_token_expires_at).getTime() : 0
  const needsRefresh = !accessToken || expiresAt - Date.now() < 60_000

  if (needsRefresh) {
    let refreshRes: Response
    try {
      refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: tokenRow.refresh_token,
          grant_type: 'refresh_token',
        }),
      })
    } catch {
      res.status(502).json({ error: 'UPSTREAM_ERROR' })
      return
    }

    if (!refreshRes.ok) {
      res.status(502).json({ error: 'REFRESH_FAILED' })
      return
    }

    const refreshed = await refreshRes.json()
    accessToken = refreshed.access_token
    const newExpiresAt = new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000).toISOString()

    await supabase
      .from('google_calendar_tokens')
      .update({ access_token: accessToken, access_token_expires_at: newExpiresAt, updated_at: new Date().toISOString() })
      .eq('user_id', userData.user.id)
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
      headers: { Authorization: `Bearer ${accessToken}` },
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
