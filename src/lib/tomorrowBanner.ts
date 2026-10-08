export type TomorrowBannerSettings = {
  start: string // HH:MM, Israel time — when the banner starts showing
  end: string // HH:MM — only tomorrow's items before this time are summarized
  dismissedAt: string | null // ISO timestamp of the last dismissal
}

export const DEFAULT_TOMORROW_BANNER_SETTINGS: TomorrowBannerSettings = {
  start: '21:00',
  end: '12:00',
  dismissedAt: null,
}

export const TOMORROW_BANNER_CHANGED_EVENT = 'tomorrow-banner-changed'

const ISRAEL_TZ = 'Asia/Jerusalem'

// en-CA formats dates as YYYY-MM-DD.
const israelDateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: ISRAEL_TZ })
const israelTimeFormat = new Intl.DateTimeFormat('en-GB', { timeZone: ISRAEL_TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

export function israelDate(date: Date): string {
  return israelDateFormat.format(date)
}

export function israelTime(date: Date): string {
  return israelTimeFormat.format(date)
}

export function normalizeTime(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^\d{2}:\d{2}/.test(value) ? value.slice(0, 5) : fallback
}

// Visible from `start` until midnight (when "tomorrow" rolls over), unless
// already dismissed during the current Israel-time day.
export function isTomorrowBannerVisible(settings: TomorrowBannerSettings, now: Date): boolean {
  if (israelTime(now) < settings.start) return false
  if (settings.dismissedAt && israelDate(new Date(settings.dismissedAt)) === israelDate(now)) return false
  return true
}

// Untimed items (all-day events, tasks without a time) belong to the whole day,
// so they're always included.
export function isBeforeCutoff(time: string | null, end: string): boolean {
  return time == null || time.slice(0, 5) < end
}
