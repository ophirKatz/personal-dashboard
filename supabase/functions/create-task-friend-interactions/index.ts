import { createClient } from 'npm:@supabase/supabase-js@2'

type LinkedFriend = { id: string; name: string; notes: string | null; details: string | null }

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return (fenced ? fenced[1] : text).trim()
}

async function generateNotes(
  apiKey: string,
  task: { title: string; notes: string | null },
  friends: LinkedFriend[],
): Promise<Record<string, string>> {
  const friendLines = friends
    .map(f => {
      const parts = [`id: ${f.id}`, `name: ${f.name}`]
      if (f.details) parts.push(`about: ${f.details}`)
      if (f.notes) parts.push(`reminder notes: ${f.notes}`)
      return `- ${parts.join(', ')}`
    })
    .join('\n')

  const taskContext = `Task: ${task.title}${task.notes ? `\nTask notes: ${task.notes}` : ''}`

  const system =
    'You are a personal assistant logging social interactions in a friends CRM. ' +
    'A user just completed a task that is linked to one or more friends. ' +
    'For each friend, write a short 1-2 sentence interaction note describing what happened, ' +
    'written as a log entry in past tense (e.g. "Caught up over coffee and talked about..."). ' +
    'Base the note on the task details, and use each friend\'s context to make their note feel ' +
    'personal and specific where relevant — but do not invent facts the context does not support. ' +
    'Respond with ONLY a JSON object (no markdown fences, no commentary) mapping each friend id to ' +
    'their note, e.g. {"friend-id-1": "note text", "friend-id-2": "note text"}. Include every friend id given.'

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: `${taskContext}\n\nFriends:\n${friendLines}` }],
    }),
  })

  if (!res.ok) {
    throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`)
  }

  const data: { content?: Array<{ text?: string }> } = await res.json()
  const raw = data.content?.[0]?.text?.trim() ?? ''
  return JSON.parse(extractJson(raw)) as Record<string, string>
}

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

  let body: { todo_id?: string } = {}
  try { body = await req.json() } catch { /* empty body */ }
  const { todo_id } = body
  if (!todo_id) {
    return new Response(JSON.stringify({ error: 'MISSING_TODO_ID' }), { status: 400 })
  }

  const { data: todo, error: todoError } = await supabase
    .from('todos')
    .select('id, title, notes')
    .eq('id', todo_id)
    .eq('user_id', userId)
    .single()

  if (todoError || !todo) {
    return new Response(JSON.stringify({ error: 'NOT_FOUND' }), { status: 404 })
  }

  const { data: links, error: linksError } = await supabase
    .from('todo_friends')
    .select('friend_id, friends(id, name, notes, details)')
    .eq('todo_id', todo_id)
    .eq('user_id', userId)

  if (linksError) {
    return new Response(JSON.stringify({ error: 'DB_ERROR' }), { status: 500 })
  }

  const friends: LinkedFriend[] = (links ?? [])
    .map(l => l.friends as unknown as LinkedFriend | null)
    .filter((f): f is LinkedFriend => f !== null)

  if (friends.length === 0) {
    return new Response(JSON.stringify({ created: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  if (!anthropicApiKey) {
    return new Response(JSON.stringify({ error: 'MISSING_ANTHROPIC_API_KEY' }), { status: 500 })
  }

  let notesByFriendId: Record<string, string> = {}
  try {
    notesByFriendId = await generateNotes(anthropicApiKey, { title: todo.title, notes: todo.notes }, friends)
  } catch (err) {
    console.error('Anthropic error:', err)
    // Fall back to a plain note per friend rather than failing the whole request —
    // the task is genuinely done and the interaction is still worth logging.
  }

  const today = new Date().toISOString().slice(0, 10)
  const rows = friends.map(f => ({
    friend_id: f.id,
    user_id: userId,
    interaction_date: today,
    note: notesByFriendId[f.id]?.trim() || `Completed task: ${todo.title}`,
    source_todo_id: todo_id,
  }))

  const { data: inserted, error: insertError } = await supabase
    .from('friend_interactions')
    .upsert(rows, { onConflict: 'friend_id,source_todo_id', ignoreDuplicates: true })
    .select('id')

  if (insertError) {
    console.error('Insert error:', insertError)
    return new Response(JSON.stringify({ error: 'DB_ERROR' }), { status: 500 })
  }

  return new Response(
    JSON.stringify({ created: inserted?.length ?? 0 }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
