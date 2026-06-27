import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

// Fixed for now — single-user dashboard, same assumption as the
// hardcoded 'Asia/Jerusalem' timezone in generate-focus-summary and fetch-weather.
const LOCATION = { latitude: 32.0853, longitude: 34.7818 }

// Same WMO rain/drizzle/thunderstorm codes as WeatherWidget's CloudDrizzle/CloudRain/CloudLightning icons.
const RAIN_WEATHER_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99])
const RAIN_PROBABILITY_THRESHOLD = 50

type DailyForecast = { weatherCode: number; precipitationProbabilityMax: number }

// Returns the current Asia/Jerusalem calendar date as YYYY-MM-DD, robust across
// DST (matches the helper in accrue-habit-debt).
function israelDate(date: Date): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' })
  return fmt.format(date)
}

async function fetchTodayForecast(): Promise<DailyForecast> {
  const params = new URLSearchParams({
    latitude: String(LOCATION.latitude),
    longitude: String(LOCATION.longitude),
    daily: 'weather_code,precipitation_probability_max',
    timezone: 'Asia/Jerusalem',
    forecast_days: '1',
  })
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
  if (!res.ok) {
    throw new Error(`Open-Meteo error ${res.status}: ${await res.text()}`)
  }
  const data = await res.json()
  const weatherCode = data.daily?.weather_code?.[0]
  if (weatherCode === undefined) throw new Error('Open-Meteo response missing daily forecast')
  return {
    weatherCode,
    precipitationProbabilityMax: data.daily?.precipitation_probability_max?.[0] ?? 0,
  }
}

async function getAllUserIds(supabase: SupabaseClient): Promise<string[]> {
  const ids = new Set<string>()
  const [todosRes, eventsRes, tokensRes] = await Promise.all([
    supabase.from('todos').select('user_id'),
    supabase.from('events').select('user_id'),
    supabase.from('google_accounts').select('user_id'),
  ])
  for (const row of [...(todosRes.data ?? []), ...(eventsRes.data ?? []), ...(tokensRes.data ?? [])]) {
    ids.add((row as { user_id: string }).user_id)
  }
  return [...ids]
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

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  let forecast: DailyForecast
  try {
    forecast = await fetchTodayForecast()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), { status: 502 })
  }

  const raining =
    RAIN_WEATHER_CODES.has(forecast.weatherCode) || forecast.precipitationProbabilityMax >= RAIN_PROBABILITY_THRESHOLD
  if (!raining) {
    return new Response(JSON.stringify({ sent: 0, raining: false, forecast }), { status: 200 })
  }

  const today = israelDate(new Date())
  const userIds = await getAllUserIds(supabase)
  if (userIds.length === 0) {
    return new Response(JSON.stringify({ sent: 0, raining: true, forecast }), { status: 200 })
  }

  const { data: alreadyNotified } = await supabase
    .from('weather_cache')
    .select('user_id')
    .in('user_id', userIds)
    .eq('rain_notified_date', today)
  const alreadyNotifiedIds = new Set((alreadyNotified ?? []).map(r => r.user_id as string))
  const pendingUserIds = userIds.filter(id => !alreadyNotifiedIds.has(id))

  if (pendingUserIds.length === 0) {
    return new Response(JSON.stringify({ sent: 0, raining: true, forecast, skipped: 'already notified today' }), { status: 200 })
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', pendingUserIds)

  let sent = 0
  for (const userId of pendingUserIds) {
    const subs = (subscriptions ?? []).filter(s => s.user_id === userId)
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: "It's raining today",
            body: 'Take an umbrella with you.',
            url: '/',
          }),
        )
        sent++
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }
    await supabase.from('weather_cache').upsert(
      {
        user_id: userId,
        latitude: LOCATION.latitude,
        longitude: LOCATION.longitude,
        rain_notified_date: today,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
  }

  return new Response(JSON.stringify({ sent, raining: true, forecast }), { status: 200 })
})
