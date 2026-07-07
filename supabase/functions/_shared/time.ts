import { APP_TIMEZONE } from './constants.ts'

// Returns a calendar date (YYYY-MM-DD) in the given IANA timezone, robust
// across DST. Defaults to APP_TIMEZONE and the current instant.
export function todayInTZ(tz: string = APP_TIMEZONE, date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

// Shifts a YYYY-MM-DD calendar date by a number of days (may be negative),
// treating it as a UTC date so no timezone/DST math is needed for the shift
// itself — only todayInTZ needs to know the actual IANA timezone.
export function addDaysUTC(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
