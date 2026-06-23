import { supabase } from '../supabase'

export type GoogleAccount = {
  id: string
  email: string
  color: string
  created_at: string
}

export const ACCOUNT_COLOR_PALETTE = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4']

export function nextAccountColor(existingCount: number): string {
  return ACCOUNT_COLOR_PALETTE[existingCount % ACCOUNT_COLOR_PALETTE.length]
}

export async function listGoogleAccounts(): Promise<GoogleAccount[]> {
  const { data } = await supabase.from('google_accounts').select('id, email, color, created_at').order('created_at', { ascending: true })
  return data ?? []
}

const DEFAULT_GOOGLE_BADGE = { email: 'Google', color: '#3b82f6' }

// Looks up the connected account a synced calendar event came from, for
// rendering its color-coded badge. Falls back to a generic "Google" badge
// for events synced before accounts had per-row colors.
export function accountBadge(accountId: string | null, accounts: Map<string, GoogleAccount>): { email: string; color: string } {
  if (!accountId) return DEFAULT_GOOGLE_BADGE
  const account = accounts.get(accountId)
  return account ? { email: account.email, color: account.color } : DEFAULT_GOOGLE_BADGE
}

// Used by the login flow (App.tsx) to register/refresh the primary account —
// the one whose Google sign-in is also used to log into the dashboard.
export async function upsertPrimaryGoogleAccount(params: {
  userId: string
  email: string
  refreshToken: string
  accessToken: string | null
}): Promise<void> {
  const { data: existing } = await supabase
    .from('google_accounts')
    .select('color')
    .eq('user_id', params.userId)
    .eq('email', params.email)
    .maybeSingle()

  let color = existing?.color
  if (!color) {
    const { count } = await supabase.from('google_accounts').select('id', { count: 'exact', head: true }).eq('user_id', params.userId)
    color = nextAccountColor(count ?? 0)
  }

  await supabase.from('google_accounts').upsert(
    {
      user_id: params.userId,
      email: params.email,
      color,
      refresh_token: params.refreshToken,
      access_token: params.accessToken,
      access_token_expires_at: new Date(Date.now() + 3500 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,email' },
  )
}

// Kicks off a standalone OAuth flow (separate from app login) so a second
// Google account can be connected for Calendar without changing who's
// signed into the dashboard.
// Returns whether the browser is being redirected to Google. Callers should
// reset any "connecting" UI state when this resolves false, since no
// navigation will happen in that case.
export async function connectGoogleAccount(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return false

  const res = await fetch('/api/google-connect-start', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (!res.ok) return false

  const { url } = await res.json()
  window.location.href = url
  return true
}

export async function disconnectGoogleAccount(id: string): Promise<void> {
  await supabase.from('google_accounts').delete().eq('id', id)
}
