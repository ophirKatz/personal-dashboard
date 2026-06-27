import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { supabase } from '../../supabase'
import type { WeatherCache } from '../../supabase'

function temperatureStyle(celsius: number) {
  if (celsius < 0) return { color: 'text-blue-600', emoji: '🥶' }
  if (celsius < 10) return { color: 'text-sky-500', emoji: '❄️' }
  if (celsius < 18) return { color: 'text-cyan-600', emoji: '😌' }
  if (celsius < 24) return { color: 'text-emerald-600', emoji: '🙂' }
  if (celsius < 30) return { color: 'text-amber-500', emoji: '☀️' }
  if (celsius < 35) return { color: 'text-orange-500', emoji: '🥵' }
  return { color: 'text-red-600', emoji: '🔥' }
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

  const { color, emoji } = temperatureStyle(weather.temperature)

  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-sm font-medium ${color}`}>
        {emoji} {Math.round(weather.temperature)}°C
      </span>
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
