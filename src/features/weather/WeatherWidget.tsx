import { useEffect, useState } from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'
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

function formatAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherCache | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showMinMax, setShowMinMax] = useState(false)

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

  // No reading has ever succeeded for this row — nothing to fall back to.
  if (!weather || weather.temperature === null) {
    return (
      <button
        onClick={refresh}
        disabled={refreshing}
        className="flex items-center gap-1.5 text-xs text-muted-foreground disabled:opacity-40"
        title={weather?.error ?? undefined}
      >
        Weather unavailable
        <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
      </button>
    )
  }

  // The latest refresh failed, but a previous good reading is still cached — show it
  // instead of blanking out, since it's still roughly right for anything less than a
  // few hours stale.
  const stale = weather.status === 'error'

  const displayTemp = showMinMax && weather.temperature_min !== null && weather.temperature_max !== null
    ? `${Math.round(weather.temperature_min)}–${Math.round(weather.temperature_max)}°C`
    : `${Math.round(weather.temperature)}°C`

  const tempStyle = showMinMax && weather.temperature_min !== null
    ? temperatureStyle(weather.temperature_min)
    : temperatureStyle(weather.temperature)

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => setShowMinMax(!showMinMax)}
        className={`text-sm font-medium ${stale ? 'text-muted-foreground' : tempStyle.color} hover:opacity-70 transition-opacity`}
        title={showMinMax ? 'Current temperature' : 'Low/High temperature'}
      >
        {tempStyle.emoji} {displayTemp}
      </button>
      {stale && weather.fetched_at && (
        <span
          className="flex items-center gap-0.5 text-xs text-muted-foreground"
          title={`Couldn't refresh${weather.error ? `: ${weather.error}` : ''} — showing the last known reading`}
        >
          <AlertTriangle className="h-3 w-3" />
          {formatAgo(weather.fetched_at)}
        </span>
      )}
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
