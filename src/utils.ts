import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, isToday, isTomorrow, parseISO, addDays as dfnsAddDays, addWeeks, addMonths as dfnsAddMonths } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const CLIMBING_GRADES = [
  'v0-1', 'v1-2', 'v2-3', 'v3-4', 'v4-5',
  'v5-6', 'v6-7', 'v7-8', 'v8-9', 'v9-10',
] as const

export type ClimbingGrade = typeof CLIMBING_GRADES[number]

export const QUICK_LOG_GRADES = [
  'v2-3', 'v3-4', 'v4-5', 'v5-6', 'v6-7', 'v7-8',
] as const

export function today(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function formatDate(dateStr: string): string {
  const date = parseISO(dateStr)
  if (isToday(date)) return 'Today'
  if (isTomorrow(date)) return 'Tomorrow'
  return format(date, 'MMM d')
}

export function formatTime(timeStr: string): string {
  return format(new Date(`2000-01-01T${timeStr}`), 'h:mm a')
}

export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr)
  if (isToday(date)) return `Today at ${format(date, 'h:mm a')}`
  if (isTomorrow(date)) return `Tomorrow at ${format(date, 'h:mm a')}`
  return format(date, 'MMM d, h:mm a')
}

export type RecurrenceUnit = 'day' | 'week' | 'month'

export function advanceRecurrence(dateStr: string, interval: number, unit: RecurrenceUnit): string {
  const date = parseISO(dateStr)
  const next = unit === 'day' ? dfnsAddDays(date, interval)
    : unit === 'week' ? addWeeks(date, interval)
    : dfnsAddMonths(date, interval)
  return format(next, 'yyyy-MM-dd')
}

export function formatRecurrence(interval: number, unit: RecurrenceUnit): string {
  if (interval === 1) return unit === 'day' ? 'Daily' : unit === 'week' ? 'Weekly' : 'Monthly'
  return `Every ${interval} ${unit}s`
}

// Habit reminder times are stored as UTC time-of-day (no date), so they survive
// across days regardless of which day they're checked against. Convert at the
// UI boundary so the picker always shows/accepts the browser's local time.
export function localTimeToUtcTime(localTime: string): string {
  const [h, m] = localTime.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toISOString().slice(11, 16)
}

export function utcTimeToLocalTime(utcTime: string): string {
  const [h, m] = utcTime.split(':').map(Number)
  const d = new Date()
  d.setUTCHours(h, m, 0, 0)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function isViewable(mimeType: string): boolean {
  return mimeType.startsWith('image/') || mimeType === 'application/pdf'
}

export function fileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType === 'application/pdf') return '📄'
  if (mimeType.startsWith('video/')) return '🎬'
  if (mimeType.startsWith('audio/')) return '🎵'
  if (mimeType.includes('zip') || mimeType.includes('rar')) return '🗜️'
  return '📎'
}
