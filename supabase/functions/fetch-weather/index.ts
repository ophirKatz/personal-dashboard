import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'

// Fixed for now — single-user dashboard, same assumption as the
// hardcoded 'Asia/Jerusalem' timezone in generate-focus-summary.
const LOCATION = { latitude: 32.0853, longitude: 34.7818 }

const WEATHER_CODE_LABELS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Freezing fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Light showers',
  81: 'Showers',
  82: 'Violent showers',
  85: 'Light snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Thunderstorm with heavy hail',
}

type OpenMeteoResponse = {
  current?: {
    temperature_2m: number
    apparent_temperature: number
    relative_humidity_2m: number
    wind_speed_10m: number
    weather_code: number
    is_day: number
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

async function fetchCurrentWeather(): Promise<OpenMeteoResponse['current']> {
  const params = new URLSearchParams({
    latitude: String(LOCATION.latitude),
    longitude: String(LOCATION.longitude),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m',
    timezone: 'Asia/Jerusalem',
  })
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
  if (!res.ok) {
    throw new Error(`Open-Meteo error ${res.status}: ${await res.text()}`)
  }
  const data: OpenMeteoResponse = await res.json()
  if (!data.current) throw new Error('Open-Meteo response missing current conditions')
  return data.current
}

async function refreshWeatherForUser(supabase: SupabaseClient, userId: string) {
  try {
    const current = await fetchCurrentWeather()
    await supabase.from('weather_cache').upsert({
      user_id: userId,
      latitude: LOCATION.latitude,
      longitude: LOCATION.longitude,
      temperature: current!.temperature_2m,
      feels_like: current!.apparent_temperature,
      weather_code: current!.weather_code,
      condition: WEATHER_CODE_LABELS[current!.weather_code] ?? 'Unknown',
      is_day: current!.is_day === 1,
      humidity: current!.relative_humidity_2m,
      wind_speed: current!.wind_speed_10m,
      status: 'ready',
      error: null,
      fetched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await supabase.from('weather_cache').upsert({
      user_id: userId,
      latitude: LOCATION.latitude,
      longitude: LOCATION.longitude,
      status: 'error',
      error: message,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    throw err
  }
}

Deno.serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const cronSecret = Deno.env.get('CRON_SECRET')

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'MISSING_CONFIG' }), { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const authHeader = req.headers.get('authorization') ?? ''
  const isCron = Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`

  if (isCron) {
    const userIds = await getAllUserIds(supabase)
    const results = await Promise.allSettled(userIds.map(userId => refreshWeatherForUser(supabase, userId)))
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
    await refreshWeatherForUser(supabase, userData.user.id)
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), { status: 502 })
  }
})
