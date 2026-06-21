import type { VercelRequest } from '@vercel/node'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

type AuthResult =
  | { ok: true; supabase: SupabaseClient; userId: string }
  | { ok: false; status: number; error: string }

export async function authenticateRequest(req: VercelRequest): Promise<AuthResult> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, status: 500, error: 'MISSING_CONFIG' }
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'UNAUTHORIZED' }
  }
  const userJwt = authHeader.slice('Bearer '.length)

  // Scoped client: RLS enforces that this user can only ever touch their own rows.
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
  })

  const { data: userData, error: userError } = await supabase.auth.getUser(userJwt)
  if (userError || !userData.user) {
    return { ok: false, status: 401, error: 'UNAUTHORIZED' }
  }

  return { ok: true, supabase, userId: userData.user.id }
}
