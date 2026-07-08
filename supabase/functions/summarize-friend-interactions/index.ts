import { createClient } from 'npm:@supabase/supabase-js@2'

type Period = 'month' | 'year' | 'all'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function upsertSummary(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  friendId: string,
  patch: { summary?: string; status: 'ready' | 'error'; error?: string | null },
) {
  const payload: Record<string, unknown> = {
    user_id: userId,
    friend_id: friendId,
    status: patch.status,
    updated_at: new Date().toISOString(),
  }
  if (patch.status === 'ready') {
    payload.summary = patch.summary
    payload.error = null
    payload.generated_at = new Date().toISOString()
  } else {
    payload.error = patch.error ?? 'Unknown error'
  }
  await supabase.from('friend_interaction_summaries').upsert(payload, { onConflict: 'user_id,friend_id' })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('MISSING_CONFIG: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set')
    return new Response(JSON.stringify({ error: 'MISSING_CONFIG' }), { status: 500, headers: corsHeaders })
  }

  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    console.error('UNAUTHORIZED: missing or malformed Authorization header')
    return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401, headers: corsHeaders })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const jwt = authHeader.slice('Bearer '.length)
  const { data: userData, error: userError } = await supabase.auth.getUser(jwt)
  if (userError || !userData.user) {
    console.error('UNAUTHORIZED: getUser failed:', userError?.message)
    return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401, headers: corsHeaders })
  }

  const userId = userData.user.id
  let body: { friend_id?: string; period?: Period; forceRefresh?: boolean } = {}
  try { body = await req.json() } catch { /* empty body */ }

  const { friend_id, period = 'month', forceRefresh = false } = body
  if (!friend_id) {
    console.error('MISSING_FRIEND_ID: request body had no friend_id')
    return new Response(JSON.stringify({ error: 'MISSING_FRIEND_ID' }), { status: 400, headers: corsHeaders })
  }

  // Check cache first unless forceRefresh is true
  if (!forceRefresh) {
    const { data: cached } = await supabase
      .from('friend_interaction_summaries')
      .select('summary, status, generated_at')
      .eq('user_id', userId)
      .eq('friend_id', friend_id)
      .single()

    if (cached && cached.status === 'ready' && cached.summary) {
      const generatedAt = cached.generated_at ? new Date(cached.generated_at) : null
      const now = new Date()
      const hoursSinceGenerated = generatedAt ? (now.getTime() - generatedAt.getTime()) / (1000 * 60 * 60) : null

      // Return cached summary if it's less than 24 hours old
      if (hoursSinceGenerated !== null && hoursSinceGenerated < 24) {
        console.log(`Returning cached summary for friend ${friend_id}, age=${hoursSinceGenerated.toFixed(1)}h`)
        return new Response(
          JSON.stringify({ summary: cached.summary, fromCache: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
    }
  }

  const { data: friend, error: friendError } = await supabase
    .from('friends')
    .select('name, notes, details')
    .eq('id', friend_id)
    .eq('user_id', userId)
    .single()

  if (friendError || !friend) {
    console.error('NOT_FOUND: friend lookup failed:', friendError?.message, `friend_id=${friend_id}`)
    return new Response(JSON.stringify({ error: 'NOT_FOUND' }), { status: 404, headers: corsHeaders })
  }

  let query = supabase
    .from('friend_interactions')
    .select('interaction_date, note')
    .eq('friend_id', friend_id)
    .eq('user_id', userId)
    .order('interaction_date', { ascending: false })

  const now = new Date()
  if (period === 'month') {
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    query = query.gte('interaction_date', start)
  } else if (period === 'year') {
    query = query.gte('interaction_date', `${now.getFullYear()}-01-01`)
  }

  const { data: interactions, error: interactionsError } = await query

  if (interactionsError) {
    console.error('DB_ERROR: interactions query failed:', interactionsError.message)
    return new Response(JSON.stringify({ error: 'DB_ERROR' }), { status: 500, headers: corsHeaders })
  }

  // Fetch upcoming todos and events linked to this friend (next 30 days)
  const todayStr = now.toISOString().slice(0, 10)
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [{ data: upcomingTodos }, { data: upcomingEvents }] = await Promise.all([
    supabase
      .from('todo_friends')
      .select('todos(title, due_date)')
      .eq('friend_id', friend_id)
      .eq('user_id', userId)
      .then(res => {
        if (res.error) return { data: [] }
        const todos = (res.data ?? []).map((tf: { todos: { title: string; due_date: string | null } }) => tf.todos)
        return {
          data: todos.filter(
            (t: { title: string; due_date: string | null }) => t.due_date && t.due_date >= todayStr && t.due_date <= thirtyDaysFromNow,
          ),
        }
      }),
    supabase
      .from('event_friends')
      .select('events(title, event_date)')
      .eq('friend_id', friend_id)
      .eq('user_id', userId)
      .then(res => {
        if (res.error) return { data: [] }
        const events = (res.data ?? []).map((ef: { events: { title: string; event_date: string } }) => ef.events)
        return {
          data: events.filter(
            (e: { title: string; event_date: string }) => e.event_date && e.event_date >= todayStr && e.event_date <= thirtyDaysFromNow,
          ),
        }
      }),
  ])

  if (!interactions || interactions.length === 0) {
    return new Response(
      JSON.stringify({ summary: 'No interactions recorded for this period.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  if (!anthropicApiKey) {
    console.error('MISSING_ANTHROPIC_API_KEY: ANTHROPIC_API_KEY secret not set')
    return new Response(JSON.stringify({ error: 'MISSING_ANTHROPIC_API_KEY' }), { status: 500, headers: corsHeaders })
  }

  const interactionLines = interactions
    .map(i => `- ${i.interaction_date}${i.note ? `: ${i.note}` : ''}`)
    .join('\n')

  const typedFriend = friend as { name: string; details?: string | null; notes?: string | null }

  const contextParts = [`Friend: ${typedFriend.name}`]
  if (typedFriend.details) {
    contextParts.push(`About this friendship: ${typedFriend.details}`)
  }
  if (typedFriend.notes) {
    contextParts.push(`Reminder note (things to talk about): ${typedFriend.notes}`)
  }
  contextParts.push(`\nInteractions (${period}):\n${interactionLines}`)

  // Add upcoming events and todos if any exist
  if ((upcomingTodos && upcomingTodos.length > 0) || (upcomingEvents && upcomingEvents.length > 0)) {
    contextParts.push('\nUpcoming (next 30 days):')
    if (upcomingTodos && upcomingTodos.length > 0) {
      const todoLines = (upcomingTodos as { title: string; due_date: string }[])
        .map(t => `- Todo: ${t.title} (${t.due_date})`)
        .join('\n')
      contextParts.push(todoLines)
    }
    if (upcomingEvents && upcomingEvents.length > 0) {
      const eventLines = (upcomingEvents as { title: string; event_date: string }[])
        .map(e => `- Event: ${e.title} (${e.event_date})`)
        .join('\n')
      contextParts.push(eventLines)
    }
  }

  const system =
    'You are a personal assistant helping a user reflect on their friendships. ' +
    'You will receive context about a friend — who they are and what makes the friendship meaningful — ' +
    'followed by a list of logged interactions (dates and optional notes) and any upcoming events or todos linked to them. ' +
    'Write a brief 2-4 sentence summary of the relationship activity in the period, and mention any upcoming plans. ' +
    'Use the friendship context to make the summary personal and specific — not generic. ' +
    'Focus on patterns, topics discussed, how the interactions connect to what matters in this friendship, and what\'s coming up. ' +
    'Do not use bullet points.'

  let aiRes: Response
  try {
    aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system,
        messages: [{ role: 'user', content: contextParts.join('\n') }],
      }),
    })
  } catch (err) {
    console.error('Anthropic fetch error:', err)
    await upsertSummary(supabase, userId, friend_id, { status: 'error', error: 'AI_ERROR' })
    return new Response(JSON.stringify({ error: 'AI_ERROR' }), { status: 502, headers: corsHeaders })
  }

  if (!aiRes.ok) {
    const errBody = await aiRes.text().catch(() => '')
    console.error(`Anthropic API ${aiRes.status}:`, errBody.slice(0, 200))
    await upsertSummary(supabase, userId, friend_id, { status: 'error', error: `Anthropic API ${aiRes.status}` })
    return new Response(JSON.stringify({ error: 'AI_ERROR' }), { status: 502, headers: corsHeaders })
  }

  let summary: string
  try {
    const data = await aiRes.json() as { content?: Array<{ text?: string }> }
    summary = data.content?.[0]?.text?.trim() || ''
    console.log(`summary length=${summary.length}, stop_reason ok`)
  } catch (err) {
    console.error('Failed to parse Anthropic response:', err)
    await upsertSummary(supabase, userId, friend_id, { status: 'error', error: 'Failed to parse AI response' })
    return new Response(JSON.stringify({ error: 'AI_ERROR' }), { status: 502, headers: corsHeaders })
  }

  if (!summary) {
    summary = 'No summary available for this period.'
  }

  // Cache the summary
  await upsertSummary(supabase, userId, friend_id, { summary, status: 'ready' })

  return new Response(
    JSON.stringify({ summary, fromCache: false }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
