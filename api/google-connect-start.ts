import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Scopes for secondary accounts (calendar only).
const SECONDARY_SCOPES = 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/calendar.readonly'

// Scopes for primary account (used for dashboard login). Includes calendar,
// tasks, and drive since only the primary account syncs these.
const PRIMARY_SCOPES = 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/drive.readonly'

// The callback itself runs as a Supabase Edge Function
// (supabase/functions/google-connect-callback), not a Vercel function — it
// needs to bypass RLS to write tokens for a user with no session/JWT
// (Google's redirect carries none), and Supabase auto-injects the
// service-role key into every Edge Function, so it never needs to be pasted
// into Vercel.
//
// userinfo.email is required so the callback can call Google's userinfo
// endpoint to learn which Google account email this token belongs to —
// without it, that call returns 401 UNAUTHENTICATED even with a valid token.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
    return
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim()
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim()
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
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

  // Check if user has any active (not soft-deleted) accounts. If they have no
  // active accounts, this is their first connection (primary) and should get
  // full scopes. Any subsequent connections are secondary and only get calendar.
  const { count } = await supabase
    .from('google_accounts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userData.user.id)
    .is('deleted_at', null)
  const isPrimaryAccount = !count || count === 0

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

  // Must exactly match the redirect_uri the Edge Function callback uses when
  // exchanging the code, and the URI registered in Google Cloud Console.
  const redirectUri = `${supabaseUrl}/functions/v1/google-connect-callback`

  // Use full scopes (calendar + tasks + drive) for the first account (primary),
  // and calendar-only for subsequent secondary accounts.
  const scopes = isPrimaryAccount ? PRIMARY_SCOPES : SECONDARY_SCOPES

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    prompt: 'consent',
    state: stateRow.state,
  })

  res.status(200).json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` })
}
