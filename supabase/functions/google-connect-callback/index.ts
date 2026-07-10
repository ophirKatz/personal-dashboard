import { createClient } from 'npm:@supabase/supabase-js@2'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'
const ACCOUNT_COLOR_PALETTE = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4']
const STATE_TTL_MS = 10 * 60 * 1000

function redirectTo(appUrl: string, status: string): Response {
  return new Response(null, { status: 302, headers: { Location: `${appUrl}/settings?google_connect=${status}` } })
}

Deno.serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim()
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')?.trim()
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')?.trim()
  const appUrl = Deno.env.get('APP_URL')?.trim()
  if (!supabaseUrl || !serviceRoleKey || !clientId || !clientSecret || !appUrl) {
    return new Response('Missing server configuration.', { status: 500 })
  }

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')

  if (oauthError) {
    console.log(`google-connect-callback: denied, oauth error=${oauthError}`)
    return redirectTo(appUrl, 'denied')
  }
  if (!code || !state) return new Response('Missing code or state.', { status: 400 })

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
    const ageMs = stateRow ? Date.now() - new Date(stateRow.created_at).getTime() : null
    console.log(`google-connect-callback: expired, stateFound=${!!stateRow}, ageMs=${ageMs}`)
    return redirectTo(appUrl, 'expired')
  }

  // Must exactly match the redirect_uri used in google-connect-start and the
  // one registered in Google Cloud Console.
  const redirectUri = `${supabaseUrl}/functions/v1/google-connect-callback`

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
  } catch (err) {
    console.error(`google-connect-callback: token exchange request failed: ${err}`)
    return redirectTo(appUrl, 'error')
  }
  if (!tokenRes.ok) {
    console.error(`google-connect-callback: token exchange returned ${tokenRes.status}: ${await tokenRes.text()}`)
    return redirectTo(appUrl, 'error')
  }

  const tokens: { refresh_token?: string; access_token?: string; expires_in?: number } = await tokenRes.json()
  if (!tokens.refresh_token) {
    // Google only issues a refresh token on first consent for a given client.
    // Asking for prompt=consent on every connect attempt should prevent this,
    // but if it still happens, the user needs to revoke access in their
    // Google Account settings first, then reconnect.
    console.log(`google-connect-callback: no_refresh_token for user_id=${stateRow.user_id}`)
    return redirectTo(appUrl, 'no_refresh_token')
  }

  const userinfoRes = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${tokens.access_token}` } })
  if (!userinfoRes.ok) {
    console.error(`google-connect-callback: userinfo fetch returned ${userinfoRes.status}: ${await userinfoRes.text()}`)
    return redirectTo(appUrl, 'error')
  }
  const userinfo: { email?: string } = await userinfoRes.json()
  if (!userinfo.email) {
    console.error('google-connect-callback: userinfo response had no email')
    return redirectTo(appUrl, 'error')
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
      .is('deleted_at', null)
    color = ACCOUNT_COLOR_PALETTE[(count ?? 0) % ACCOUNT_COLOR_PALETTE.length]
  }

  const { error: upsertError } = await supabase.from('google_accounts').upsert(
    {
      user_id: stateRow.user_id,
      email: userinfo.email,
      color,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token ?? null,
      access_token_expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    },
    { onConflict: 'user_id,email' },
  )

  if (upsertError) {
    console.error(`google-connect-callback: upsert failed for user_id=${stateRow.user_id}, email=${userinfo.email}: ${upsertError.message}`)
    return redirectTo(appUrl, 'error')
  }

  console.log(`google-connect-callback: success for user_id=${stateRow.user_id}, email=${userinfo.email}`)
  return redirectTo(appUrl, 'success')
})
