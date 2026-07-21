import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'

const TASKS_BASE = 'https://tasks.googleapis.com/tasks/v1/lists/@default/tasks'

type TokenRow = { refresh_token: string; access_token: string | null; access_token_expires_at: string | null }

type GoogleTaskItem = {
  id: string
  title?: string
  notes?: string
  due?: string
  status?: string
  completed?: string
  hidden?: boolean
  deleted?: boolean
}

async function getAllUserIds(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase.from('google_accounts').select('user_id').is('deleted_at', null)
  return [...new Set((data ?? []).map(row => row.user_id as string))]
}

// Tasks sync is scoped to one account per user — the first one ever connected
// (i.e. the account used to sign into the dashboard), since "My Tasks" only
// makes sense for a single Google identity today.
async function getAccessToken(
  supabase: SupabaseClient,
  userId: string,
  clientId: string,
  clientSecret: string,
): Promise<string | null> {
  const { data: account } = await supabase
    .from('google_accounts')
    .select('id, refresh_token, access_token, access_token_expires_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<TokenRow & { id: string }>()
  if (!account) return null

  let accessToken = account.access_token
  const expiresAt = account.access_token_expires_at ? new Date(account.access_token_expires_at).getTime() : 0
  if (accessToken && expiresAt - Date.now() >= 60_000) return accessToken

  const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: account.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  if (!refreshRes.ok) return null

  const refreshed = await refreshRes.json()
  accessToken = refreshed.access_token
  const newExpiresAt = new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000).toISOString()
  await supabase
    .from('google_accounts')
    .update({ access_token: accessToken, access_token_expires_at: newExpiresAt, updated_at: new Date().toISOString() })
    .eq('id', account.id)
  return accessToken
}

async function syncTasksForUser(supabase: SupabaseClient, userId: string, clientId: string, clientSecret: string) {
  const accessToken = await getAccessToken(supabase, userId, clientId, clientSecret)
  if (!accessToken) return

  const params = new URLSearchParams({ showCompleted: 'true', showHidden: 'true', maxResults: '100' })
  const res = await fetch(`${TASKS_BASE}?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) return // insufficient scope / upstream error — best-effort, leave cache as-is

  const data: { items?: GoogleTaskItem[] } = await res.json()
  const tasks = (data.items ?? [])
    .filter(t => !t.deleted && !t.hidden)
    .map(t => ({
      id: t.id,
      title: t.title ?? '(No title)',
      notes: t.notes ?? null,
      due: t.due ? t.due.slice(0, 10) : null,
      completed: t.status === 'completed',
      completedAt: t.completed ?? null,
    }))

  const { data: existingRows } = await supabase
    .from('todos')
    .select('google_task_id, due_date, notified_at')
    .eq('user_id', userId)
    .eq('source', 'google')
  const existingByGoogleId = new Map((existingRows ?? []).map(r => [r.google_task_id as string, r]))

  const rows = tasks.map(task => {
    const existing = existingByGoogleId.get(task.id)
    const notifiedAt = existing && existing.due_date === task.due ? existing.notified_at : null
    return {
      user_id: userId,
      title: task.title,
      notes: task.notes,
      due_date: task.due,
      completed: task.completed,
      completed_at: task.completedAt,
      source: 'google',
      google_task_id: task.id,
      notified_at: notifiedAt,
    }
  })

  if (rows.length > 0) {
    await supabase.from('todos').upsert(rows, { onConflict: 'user_id,google_task_id' })
  }

  const currentIds = new Set(tasks.map(t => t.id))
  const staleIds = [...existingByGoogleId.keys()].filter(id => !currentIds.has(id))
  if (staleIds.length > 0) {
    await supabase.from('todos').delete().eq('user_id', userId).eq('source', 'google').in('google_task_id', staleIds)
  }
}

Deno.serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const cronSecret = Deno.env.get('CRON_SECRET')
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')

  if (!supabaseUrl || !serviceRoleKey || !clientId || !clientSecret) {
    return new Response(JSON.stringify({ error: 'MISSING_CONFIG' }), { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const authHeader = req.headers.get('authorization') ?? ''
  const isCron = Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`

  if (isCron) {
    const userIds = await getAllUserIds(supabase)
    const results = await Promise.allSettled(userIds.map(userId => syncTasksForUser(supabase, userId, clientId, clientSecret)))
    const errors = results.filter(r => r.status === 'rejected').length
    return new Response(JSON.stringify({ processed: results.length, errors }), { status: 200 })
  }

  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401 })
  }
  const jwt = authHeader.slice('Bearer '.length)
  const { data: userData, error: userError } = await supabase.auth.getUser(jwt)
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401 })
  }

  try {
    await syncTasksForUser(supabase, userData.user.id, clientId, clientSecret)
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), { status: 502 })
  }
})
