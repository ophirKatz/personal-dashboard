type HapticPattern = 'light' | 'medium' | 'selection' | 'success' | 'warning'

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 20,
  selection: 8,
  success: [10, 50, 10],
  warning: [20, 40, 20],
}

export function haptic(pattern: HapticPattern = 'light') {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return
  navigator.vibrate(PATTERNS[pattern])
}
