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

export function today(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function formatDate(dateStr: string): string {
  const date = parseISO(dateStr)
  if (isToday(date)) return 'Today'
  if (isTomorrow(date)) return 'Tomorrow'
  return format(date, 'MMM d')
}

export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr)
  if (isToday(date)) return `Today at ${format(date, 'h:mm a')}`
  if (isTomorrow(date)) return `Tomorrow at ${format(date, 'h:mm a')}`
  return format(date, 'MMM d, h:mm a')
}

export function advanceRepeat(dateStr: string, repeat: 'daily' | 'weekly' | 'monthly'): string {
  const date = new Date(dateStr)
  if (repeat === 'daily') return dfnsAddDays(date, 1).toISOString()
  if (repeat === 'weekly') return addWeeks(date, 1).toISOString()
  return dfnsAddMonths(date, 1).toISOString()
}

export const PRIORITY_CONFIG = {
  low: { label: 'Low', className: 'bg-blue-100 text-blue-700' },
  medium: { label: 'Medium', className: 'bg-amber-100 text-amber-700' },
  high: { label: 'High', className: 'bg-red-100 text-red-700' },
} as const

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function fileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType === 'application/pdf') return '📄'
  if (mimeType.startsWith('video/')) return '🎬'
  if (mimeType.startsWith('audio/')) return '🎵'
  if (mimeType.includes('zip') || mimeType.includes('rar')) return '🗜️'
  return '📎'
}
