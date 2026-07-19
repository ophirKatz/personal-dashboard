import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'
import { todayInTZ, addDaysUTC } from '../_shared/time.ts'

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

  // Single-user app, based in Israel — mirrors the period math in
  // src/utils.ts (habitPeriodLengthDays / isHabitDueToday), so a weekly habit
  // already logged this period doesn't get re-notified on the other days of
  // that period. Only used by the v1 (habits_v2_enabled = false) branch below.
  function daysBetween(fromDateStr: string, toDateStr: string): number {
    const from = new Date(`${fromDateStr}T00:00:00Z`).getTime()
    const to = new Date(`${toDateStr}T00:00:00Z`).getTime()
    return Math.round((to - from) / 86_400_000)
  }

  function habitPeriodLengthDays(habit: { frequency: string; times_per_week: number | null }): number {
    if (habit.frequency === 'daily') return 1
    return Math.max(1, Math.floor(7 / (habit.times_per_week ?? 1)))
  }

  const todayIL = todayInTZ()

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

  // habits_v2_enabled controls which of the two habit implementations is
  // live app-wide (see supabase/migrations/*_habit_v2_derived_state.sql).
  // v1's debt/period math stays untouched below; v2 just reads the
  // server-computed is_due_today off the habit_status view instead of
  // reimplementing the period math a third time.
  const { data: appSettings } = await supabase.from('app_settings').select('habits_v2_enabled').eq('id', true).maybeSingle()
  const habitsV2Enabled = appSettings?.habits_v2_enabled ?? false

  if (habitsV2Enabled) {
    const { data: dueHabits } = await supabase
      .from('habit_status')
      .select('id, user_id, name, emoji, reminder_time, last_notified_date, is_due_today')
      .eq('reminder_enabled', true)
      .not('reminder_time', 'is', null)

    for (const habit of dueHabits ?? []) {
      if ((habit.reminder_time as string).slice(0, 5) !== nowTime) continue
      if (habit.last_notified_date === todayIL) continue
      if (!habit.is_due_today) continue

      pending.push({
        userId: habit.user_id,
        title: `${habit.emoji} ${habit.name}`,
        body: "Don't forget your habit today.",
        url: '/habits',
      })
      await supabase.from('habits').update({ last_notified_date: todayIL }).eq('id', habit.id)
    }
  } else {
    const { data: dueHabits } = await supabase
      .from('habits')
      .select('id, user_id, name, emoji, reminder_time, last_notified_date, frequency, times_per_week, created_at')
      .eq('reminder_enabled', true)
      .not('reminder_time', 'is', null)

    for (const habit of dueHabits ?? []) {
      if ((habit.reminder_time as string).slice(0, 5) !== nowTime) continue
      if (habit.last_notified_date === todayIL) continue

      const createdDate = (habit.created_at as string).slice(0, 10)
      if (createdDate <= todayIL) {
        const periodLength = habitPeriodLengthDays(habit)
        const daysSinceCreation = daysBetween(createdDate, todayIL)
        const periodIndex = Math.floor(daysSinceCreation / periodLength)
        const periodStart = addDaysUTC(createdDate, periodIndex * periodLength)

        const { data: log } = await supabase
          .from('habit_logs')
          .select('id')
          .eq('habit_id', habit.id)
          .gte('logged_date', periodStart)
          .lte('logged_date', todayIL)
          .limit(1)
          .maybeSingle()
        if (log) continue
      }

      pending.push({
        userId: habit.user_id,
        title: `${habit.emoji} ${habit.name}`,
        body: "Don't forget your habit today.",
        url: '/habits',
      })
      await supabase.from('habits').update({ last_notified_date: todayIL }).eq('id', habit.id)
    }
  }

  // Check for calendar event reminders that are due
  const { data: dueEventReminders } = await supabase
    .from('event_reminders')
    .select('id, user_id, event_id, reminder_days_before, events(title, event_date, event_time)')
    .eq('reminder_type', 'calendar_event')
    .is('notified_at', null)

  for (const reminder of dueEventReminders ?? []) {
    const event = reminder.events as unknown as { title: string; event_date: string; event_time: string | null }
    if (!event) continue

    // Calculate if reminder is due today
    const reminderDate = addDaysUTC(event.event_date, -reminder.reminder_days_before)
    if (reminderDate !== todayIL) continue

    // Create in-app notification
    const daysUntilEvent = reminder.reminder_days_before
    let messagePrefix: string
    if (daysUntilEvent === 0) messagePrefix = 'Today'
    else if (daysUntilEvent === 1) messagePrefix = 'Tomorrow'
    else messagePrefix = `In ${daysUntilEvent} days`

    const timeStr = event.event_time ? ` at ${event.event_time.slice(0, 5)}` : ''
    const message = `${messagePrefix}${timeStr}`

    await supabase.from('notifications').insert({
      user_id: reminder.user_id,
      type: 'calendar_event_reminder',
      title: `Reminder: ${event.title}`,
      message: message,
      read: false,
    })

    // Mark reminder as notified
    await supabase.from('event_reminders').update({ notified_at: now.toISOString() }).eq('id', reminder.id)

    pending.push({
      userId: reminder.user_id,
      title: `Reminder: ${event.title}`,
      body: message,
      url: '/calendar',
    })
  }

  const { data: dueFriends } = await supabase
    .from('friends')
    .select('id, user_id, name, goal_count, goal_unit, goal_mode, notes, reminder_enabled, last_notified_date, created_at')
    .eq('reminder_enabled', true)
    .neq('goal_mode', 'none')

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
    const days = unitDays[friend.goal_unit]
    const targetInterval = friend.goal_mode === 'frequency'
      ? Math.max(1, Math.round(days / friend.goal_count))
      : friend.goal_count * days
    const dates = (friendInteractions ?? [])
      .filter((i: { friend_id: string }) => i.friend_id === friend.id)
      .map((i: { interaction_date: string }) => i.interaction_date)
    const lastDate = dates.length ? dates.sort().at(-1) : friend.created_at.slice(0, 10)
    const msPerDay = 24 * 60 * 60 * 1000
    const daysSince = Math.floor((Date.now() - new Date(lastDate).getTime()) / msPerDay)
    if (daysSince < targetInterval) continue

    const noteClause = friend.notes ? ` Note: ${friend.notes}` : ''
    pending.push({
      userId: friend.user_id,
      title: `Stay in touch with ${friend.name}`,
      body: `It's been ${daysSince} day${daysSince !== 1 ? 's' : ''} — your goal is ${friend.goal_mode === 'frequency' ? (friend.goal_count === 1 ? `once a ${friend.goal_unit}` : `${friend.goal_count}x a ${friend.goal_unit}`) : (friend.goal_count === 1 ? `every ${friend.goal_unit}` : `every ${friend.goal_count} ${friend.goal_unit}s`)}.${noteClause}`,
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
        } else {
          console.error('send-notifications: push send failed', notification.userId, sub.id, err)
        }
      }
    }
  }

  return new Response(JSON.stringify({ sent }), { status: 200 })
})
