import { Beaker, Droplets, Milk, Moon, Pill, Ruler, StickyNote, Thermometer, type LucideIcon } from 'lucide-react'
import type { BabyEventType } from './babyEvents'

export const EVENT_ICON: Record<BabyEventType, LucideIcon> = {
  feed: Milk,
  diaper: Droplets,
  sleep: Moon,
  pump: Beaker,
  temperature: Thermometer,
  medication: Pill,
  growth: Ruler,
  note: StickyNote,
}

// Pastel tints with dark-mode variants, like the app's other badges.
export const EVENT_TINT: Record<BabyEventType, string> = {
  feed: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  diaper: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  sleep: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  pump: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  temperature: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  medication: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  growth: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  note: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300',
}

export const EVENT_LABEL: Record<BabyEventType, string> = {
  feed: 'feed',
  diaper: 'diaper',
  sleep: 'sleep',
  pump: 'pumping',
  temperature: 'temperature',
  medication: 'medication',
  growth: 'growth',
  note: 'note',
}
