import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'
const ACCOUNT_COLOR_PALETTE = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4']
const STATE_TTL_MS = 10 * 60 * 1000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!supabaseUrl || !serviceRoleKey || !clientId || !clientSecret) {
    res.status(500).send('Missing server configuration.')
    return
  }

  const { code, state, error: oauthError } = req.query
  if (typeof oauthError === 'string') {
    res.redirect(302, '/settings?google_connect=denied')
    return
  }
  if (typeof code !== 'string' || typeof state !== 'string') {
    res.status(400).send('Missing code or state.')
    return
  }

  // Service role: this request is a plain redirect from Google, so there's
  // no Supabase session/JWT to scope an RLS client to.
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: stateRow } = await supabase
    .from('google_oauth_states')
    .delete()
    .eq('state', state)
    .select('user_id, created_at')
    .maybeSingle()

  const isExpired = !stateRow || Date.now() - new Date(stateRow.created_at).getTime() > STATE_TTL_MS
  if (!stateRow || isExpired) {
    res.redirect(302, '/settings?google_connect=expired')
    return
  }

  const proto = (req.headers['x-forwarded-proto'] as string) ?? 'https'
  const redirectUri = `${proto}://${req.headers.host}/api/google-connect-callback`

  let tokenRes: Response
  try {
    tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })
  } catch {
    res.redirect(302, '/settings?google_connect=error')
    return
  }
  if (!tokenRes.ok) {
    res.redirect(302, '/settings?google_connect=error')
    return
  }

  const tokens: { refresh_token?: string; access_token?: string; expires_in?: number } = await tokenRes.json()
  if (!tokens.refresh_token) {
    // Google only issues a refresh token on first consent for a given client.
    // Asking for prompt=consent on every connect attempt should prevent this,
    // but if it still happens, the user needs to revoke access in their
    // Google Account settings first, then reconnect.
    res.redirect(302, '/settings?google_connect=no_refresh_token')
    return
  }

  const userinfoRes = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${tokens.access_token}` } })
  if (!userinfoRes.ok) {
    res.redirect(302, '/settings?google_connect=error')
    return
  }
  const userinfo: { email?: string } = await userinfoRes.json()
  if (!userinfo.email) {
    res.redirect(302, '/settings?google_connect=error')
    return
  }

  const { data: existing } = await supabase
    .from('google_accounts')
    .select('color')
    .eq('user_id', stateRow.user_id)
    .eq('email', userinfo.email)
    .maybeSingle()

  let color = existing?.color
  if (!color) {
    const { count } = await supabase
      .from('google_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', stateRow.user_id)
    color = ACCOUNT_COLOR_PALETTE[(count ?? 0) % ACCOUNT_COLOR_PALETTE.length]
  }

  await supabase.from('google_accounts').upsert(
    {
      user_id: stateRow.user_id,
      email: userinfo.email,
      color,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token ?? null,
      access_token_expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,email' },
  )

  res.redirect(302, '/settings?google_connect=success')
}
