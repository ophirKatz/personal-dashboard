import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Same scopes as the login flow (api/google-connect-callback exchanges them
// the same way), so a secondary account can later be promoted to primary.
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/drive.readonly'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
    return
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!supabaseUrl || !supabaseAnonKey || !clientId) {
    res.status(500).json({ error: 'MISSING_CONFIG' })
    return
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'UNAUTHORIZED' })
    return
  }
  const userJwt = authHeader.slice('Bearer '.length)

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
  })
  const { data: userData, error: userError } = await supabase.auth.getUser(userJwt)
  if (userError || !userData.user) {
    res.status(401).json({ error: 'UNAUTHORIZED' })
    return
  }

  // Short-lived nonce so the callback (a plain Google redirect with no
  // Supabase session) can recover which user initiated this connection.
  const { data: stateRow, error: stateError } = await supabase
    .from('google_oauth_states')
    .insert({ user_id: userData.user.id })
    .select('state')
    .single()
  if (stateError || !stateRow) {
    res.status(500).json({ error: 'STATE_ERROR' })
    return
  }

  const proto = (req.headers['x-forwarded-proto'] as string) ?? 'https'
  const redirectUri = `${proto}://${req.headers.host}/api/google-connect-callback`

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state: stateRow.state,
  })

  res.status(200).json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` })
}
