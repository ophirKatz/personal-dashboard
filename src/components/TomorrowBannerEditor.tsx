import { useEffect, useState } from 'react'
import { Input } from './ui/input'
import { haptic } from '../lib/haptics'
import { getTomorrowBannerSettings, setTomorrowBannerTimes } from '../lib/userSettings'
import { TOMORROW_BANNER_CHANGED_EVENT, type TomorrowBannerSettings } from '../lib/tomorrowBanner'

export default function TomorrowBannerEditor() {
  const [settings, setSettings] = useState<TomorrowBannerSettings | null>(null)

  useEffect(() => {
    getTomorrowBannerSettings().then(setSettings)
  }, [])

  async function save(patch: Partial<Pick<TomorrowBannerSettings, 'start' | 'end'>>) {
    if (!settings) return
    // Clearing a native time input yields '' — ignore rather than save a blank.
    if (Object.values(patch).some(v => !v)) return
    haptic('selection')
    const next = { ...settings, ...patch }
    setSettings(next)
    window.dispatchEvent(new CustomEvent(TOMORROW_BANNER_CHANGED_EVENT, { detail: next }))
    await setTomorrowBannerTimes(next.start, next.end)
  }

  if (!settings) return null

  return (
    <div className="space-y-3">
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">Show banner from</span>
        <Input type="time" className="w-32" value={settings.start} onChange={e => save({ start: e.target.value })} />
      </label>
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">Include tomorrow until</span>
        <Input type="time" className="w-32" value={settings.end} onChange={e => save({ end: e.target.value })} />
      </label>
    </div>
  )
}
