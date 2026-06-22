import { useEffect, useState } from 'react'
import { RefreshCw, Sun, Moon, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning } from 'lucide-react'
import { supabase } from '../../supabase'
import type { WeatherCache } from '../../supabase'

function weatherIcon(code: number | null, isDay: boolean | null) {
  if (code === null) return Cloud
  if (code <= 1) return isDay === false ? Moon : Sun
  if (code === 2) return CloudSun
  if (code === 3) return Cloud
  if (code === 45 || code === 48) return CloudFog
  if ([51, 53, 55, 56, 57].includes(code)) return CloudDrizzle
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return CloudRain
  if ([71, 73, 75, 77, 85, 86].includes(code)) return CloudSnow
  if ([95, 96, 99].includes(code)) return CloudLightning
  return Cloud
}

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherCache | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    const { data } = await supabase.from('weather_cache').select('*').maybeSingle()
    setWeather(data ?? null)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function refresh() {
    setRefreshing(true)
    await supabase.functions.invoke('fetch-weather')
    await load()
    setRefreshing(false)
  }

  // Auto-fetch on first load if there's no cached row yet (e.g. before the hourly cron has run once).
  useEffect(() => {
    if (!loading && !weather && !refreshing) refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  if (loading || (!weather && refreshing)) {
    return <div className="h-5 w-20 bg-muted rounded animate-pulse" />
  }

  if (!weather || weather.status === 'error' || weather.temperature === null) {
    return (
      <button onClick={refresh} disabled={refreshing} className="flex items-center gap-1.5 text-xs text-muted-foreground disabled:opacity-40">
        Weather unavailable
        <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
      </button>
    )
  }

  const Icon = weatherIcon(weather.weather_code, weather.is_day)

  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm font-medium">{Math.round(weather.temperature)}°C</span>
      <button
        onClick={refresh}
        disabled={refreshing}
        className="p-1 rounded-lg hover:bg-accent text-muted-foreground disabled:opacity-40"
        title="Refresh weather"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
      </button>
    </div>
  )
}
