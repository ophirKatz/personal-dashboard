import { createClient } from 'npm:@supabase/supabase-js@2'

type Period = 'month' | 'year' | 'all'

Deno.serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'MISSING_CONFIG' }), { status: 500 })
  }

  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const jwt = authHeader.slice('Bearer '.length)
  const { data: userData, error: userError } = await supabase.auth.getUser(jwt)
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401 })
  }

  const userId = userData.user.id
  let body: { friend_id?: string; period?: Period } = {}
  try { body = await req.json() } catch { /* empty body */ }

  const { friend_id, period = 'month' } = body
  if (!friend_id) {
    return new Response(JSON.stringify({ error: 'MISSING_FRIEND_ID' }), { status: 400 })
  }

  const { data: friend, error: friendError } = await supabase
    .from('friends')
    .select('name, notes, details')
    .eq('id', friend_id)
    .eq('user_id', userId)
    .single()

  if (friendError || !friend) {
    return new Response(JSON.stringify({ error: 'NOT_FOUND' }), { status: 404 })
  }

  let query = supabase
    .from('friend_interactions')
    .select('interaction_date, note')
    .eq('friend_id', friend_id)
    .eq('user_id', userId)
    .order('interaction_date', { ascending: false })

  const now = new Date()
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    query = query.gte('interaction_date', start)
  } else if (period === 'year') {
    query = query.gte('interaction_date', `${now.getFullYear()}-01-01`)
  }

  const { data: interactions } = await query

  if (!interactions || interactions.length === 0) {
    return new Response(
      JSON.stringify({ summary: 'No interactions recorded for this period.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (!anthropicApiKey) {
    return new Response(JSON.stringify({ error: 'MISSING_ANTHROPIC_API_KEY' }), { status: 500 })
  }

  const interactionLines = interactions
    .map(i => `- ${i.interaction_date}${i.note ? `: ${i.note}` : ''}`)
    .join('\n')

  const contextParts = [`Friend: ${(friend as { name: string }).name}`]
  if ((friend as { details?: string | null }).details) {
    contextParts.push(`Background: ${(friend as { details: string }).details}`)
  }
  if ((friend as { notes?: string | null }).notes) {
    contextParts.push(`Reminder note: ${(friend as { notes: string }).notes}`)
  }
  contextParts.push(`\nInteractions (${period}):\n${interactionLines}`)

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system:
        'You are a personal assistant helping a user reflect on their friendships. ' +
        'Given a list of logged interactions with a friend (dates and optional notes), write a brief 2-4 sentence summary ' +
        'of the relationship activity in the period. Focus on patterns, topics discussed, and frequency. ' +
        'Be warm and personal. Do not use bullet points.',
      messages: [{ role: 'user', content: contextParts.join('\n') }],
    }),
  })

  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'AI_ERROR' }), { status: 502 })
  }

  const data = await res.json() as { content?: Array<{ text?: string }> }
  const summary = data.content?.[0]?.text?.trim() ?? 'Could not generate summary.'

  return new Response(
    JSON.stringify({ summary }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
