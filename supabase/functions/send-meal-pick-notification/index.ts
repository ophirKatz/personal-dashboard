import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

// Called by the meal_shares_notify_pick trigger (pg_net) when someone picks a
// meal on a share link. Authenticates with the cron secret like the other
// DB-triggered functions; the body only carries the share id, and the meal name
// is read back from the database.
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

  let shareId: unknown
  try {
    shareId = (await req.json()).share_id
  } catch {
    return new Response(JSON.stringify({ error: 'BAD_REQUEST' }), { status: 400 })
  }
  if (typeof shareId !== 'string') {
    return new Response(JSON.stringify({ error: 'BAD_REQUEST' }), { status: 400 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: share } = await supabase
    .from('meal_shares')
    .select('user_id, picked_meal_id')
    .eq('id', shareId)
    .maybeSingle()
  if (!share?.picked_meal_id) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 })
  }

  const { data: meal } = await supabase
    .from('meals')
    .select('id, name')
    .eq('id', share.picked_meal_id)
    .eq('user_id', share.user_id)
    .maybeSingle()
  if (!meal) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 })
  }

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', share.user_id)

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

  let sent = 0
  for (const sub of subscriptions ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title: 'Meal idea picked', body: meal.name, url: `/meals/${meal.id}` }),
      )
      sent++
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      } else {
        console.error('send-meal-pick-notification: push send failed', sub.id, err)
      }
    }
  }

  return new Response(JSON.stringify({ sent }), { status: 200 })
})
