import { Activity, ArrowUpFromLine, Bike, ChevronsDown, ChevronsUp, Dumbbell, Flame, Footprints, HeartPulse, PersonStanding, Route, Timer, Weight, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export const EXERCISE_ICONS: Record<string, LucideIcon> = {
  dumbbell: Dumbbell,
  push_ups: ArrowUpFromLine,
  sit_ups: Activity,
  calf_raises: Footprints,
  squats: ChevronsDown,
  pull_ups: ChevronsUp,
  running: Route,
  flame: Flame,
  timer: Timer,
  heart: HeartPulse,
  zap: Zap,
  person: PersonStanding,
  bike: Bike,
  weight: Weight,
}

// Icons offered when creating a custom exercise.
export const CUSTOM_ICON_KEYS = ['dumbbell', 'flame', 'timer', 'heart', 'zap', 'person', 'bike', 'weight']

export function exerciseIcon(key: string): LucideIcon {
  return EXERCISE_ICONS[key] ?? Dumbbell
}

export const BUILTIN_EXERCISES = [
  { key: 'push_ups', name: 'Push ups' },
  { key: 'sit_ups', name: 'Sit-ups' },
  { key: 'calf_raises', name: 'Calf raises' },
  { key: 'squats', name: 'Squats' },
  { key: 'pull_ups', name: 'Pull ups' },
  // Measured in kilometres rather than sets x reps (see isDistanceExercise).
  { key: 'running', name: 'Running' },
]
