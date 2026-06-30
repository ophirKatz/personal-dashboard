import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

type PendingNotification = {
  userId: string
  title: string
  body: string
  url: string
}

Deno.serve(async (req: Request) => {
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const vapidSubject = Deno.env.get('VAPID_SUBJECT')
  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return new Response(JSON.stringify({ error: 'MISSING_CONFIG' }), { status: 500 })
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const now = new Date()
  const nowDate = now.toISOString().slice(0, 10)
  const nowTime = now.toISOString().slice(11, 16)

  const pending: PendingNotification[] = []

  const { data: dueTodos } = await supabase
    .from('todos')
    .select('id, user_id, title')
    .eq('reminder_enabled', true)
    .eq('completed', false)
    .lte('remind_at', now.toISOString())
    .is('notified_at', null)

  for (const todo of dueTodos ?? []) {
    pending.push({ userId: todo.user_id, title: 'Task due', body: todo.title, url: '/todos' })
    await supabase.from('todos').update({ notified_at: now.toISOString() }).eq('id', todo.id)
  }

  const { data: dueGoogleTodos } = await supabase
    .from('todos')
    .select('id, user_id, title')
    .eq('source', 'google')
    .eq('completed', false)
    .lte('due_date', nowDate)
    .is('notified_at', null)

  for (const todo of dueGoogleTodos ?? []) {
    pending.push({ userId: todo.user_id, title: 'Task due', body: todo.title, url: '/todos' })
    await supabase.from('todos').update({ notified_at: now.toISOString() }).eq('id', todo.id)
  }

  const { data: dueHabits } = await supabase
    .from('habits')
    .select('id, user_id, name, emoji, reminder_time, last_notified_date')
    .eq('reminder_enabled', true)
    .not('reminder_time', 'is', null)

  for (const habit of dueHabits ?? []) {
    if ((habit.reminder_time as string).slice(0, 5) !== nowTime) continue
    if (habit.last_notified_date === nowDate) continue

    const { data: log } = await supabase
      .from('habit_logs')
      .select('id')
      .eq('habit_id', habit.id)
      .eq('logged_date', nowDate)
      .maybeSingle()
    if (log) continue

    pending.push({
      userId: habit.user_id,
      title: `${habit.emoji} ${habit.name}`,
      body: "Don't forget your habit today.",
      url: '/habits',
    })
    await supabase.from('habits').update({ last_notified_date: nowDate }).eq('id', habit.id)
  }

  const { data: dueFriends } = await supabase
    .from('friends')
    .select('id, user_id, name, goal_count, goal_unit, reminder_enabled, last_notified_date, created_at')
    .eq('reminder_enabled', true)

  const friendIds = (dueFriends ?? []).map((f: { id: string }) => f.id)
  const { data: friendInteractions } = friendIds.length
    ? await supabase
        .from('friend_interactions')
        .select('friend_id, interaction_date')
        .in('friend_id', friendIds)
    : { data: [] }

  const unitDays: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 }
  for (const friend of dueFriends ?? []) {
    if (friend.last_notified_date === nowDate) continue
    const targetInterval = friend.goal_count * unitDays[friend.goal_unit]
    const dates = (friendInteractions ?? [])
      .filter((i: { friend_id: string }) => i.friend_id === friend.id)
      .map((i: { interaction_date: string }) => i.interaction_date)
    const lastDate = dates.length ? dates.sort().at(-1) : friend.created_at.slice(0, 10)
    const msPerDay = 24 * 60 * 60 * 1000
    const daysSince = Math.floor((Date.now() - new Date(lastDate).getTime()) / msPerDay)
    if (daysSince < targetInterval) continue

    pending.push({
      userId: friend.user_id,
      title: `Stay in touch with ${friend.name}`,
      body: `It's been ${daysSince} day${daysSince !== 1 ? 's' : ''} — your goal is every ${friend.goal_count === 1 ? friend.goal_unit : `${friend.goal_count} ${friend.goal_unit}s`}.`,
      url: '/friends',
    })
    await supabase.from('friends').update({ last_notified_date: nowDate }).eq('id', friend.id)
  }

  if (pending.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 })
  }

  const userIds = [...new Set(pending.map(n => n.userId))]
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', userIds)

  let sent = 0
  for (const notification of pending) {
    const subs = (subscriptions ?? []).filter(s => s.user_id === notification.userId)
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: notification.title, body: notification.body, url: notification.url }),
        )
        sent++
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }
  }

  return new Response(JSON.stringify({ sent }), { status: 200 })
})
