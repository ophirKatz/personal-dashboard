import { supabase } from '../supabase'

export const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/drive.readonly'

export async function connectGoogle() {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      scopes: GOOGLE_SCOPES,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  })
}

export async function isGoogleConnected(): Promise<boolean> {
  const { data, error } = await supabase.from('google_accounts').select('id').limit(1).maybeSingle()
  return !error && !!data
}
