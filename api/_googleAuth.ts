import type { VercelRequest } from '@vercel/node'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

type GoogleTokenRow = {
  refresh_token: string
  access_token: string | null
  access_token_expires_at: string | null
}

type AuthResult =
  | { ok: true; supabase: SupabaseClient; userId: string; accessToken: string }
  | { ok: false; status: number; error: string }

export async function authenticateGoogleRequest(req: VercelRequest): Promise<AuthResult> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!supabaseUrl || !supabaseAnonKey || !clientId || !clientSecret) {
    return { ok: false, status: 500, error: 'MISSING_CONFIG' }
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'UNAUTHORIZED' }
  }
  const userJwt = authHeader.slice('Bearer '.length)

  // Scoped client: RLS enforces that this user can only ever see their own row.
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
  })

  const { data: userData, error: userError } = await supabase.auth.getUser(userJwt)
  if (userError || !userData.user) {
    return { ok: false, status: 401, error: 'UNAUTHORIZED' }
  }

  const { data: tokenRow } = await supabase
    .from('google_oauth_tokens')
    .select('refresh_token, access_token, access_token_expires_at')
    .eq('user_id', userData.user.id)
    .maybeSingle<GoogleTokenRow>()

  if (!tokenRow) {
    return { ok: false, status: 404, error: 'NOT_CONNECTED' }
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
      return { ok: false, status: 502, error: 'UPSTREAM_ERROR' }
    }

    if (!refreshRes.ok) {
      return { ok: false, status: 502, error: 'REFRESH_FAILED' }
    }

    const refreshed = await refreshRes.json()
    accessToken = refreshed.access_token
    const newExpiresAt = new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000).toISOString()

    await supabase
      .from('google_oauth_tokens')
      .update({ access_token: accessToken, access_token_expires_at: newExpiresAt, updated_at: new Date().toISOString() })
      .eq('user_id', userData.user.id)
  }

  return { ok: true, supabase, userId: userData.user.id, accessToken: accessToken! }
}
