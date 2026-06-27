import { useRef } from 'react'
import type { MouseEvent, TouchEvent } from 'react'
import { haptic } from './haptics'

export function useLongPress(onLongPress: () => void, delay = 500) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggeredRef = useRef(false)

  function start() {
    triggeredRef.current = false
    timerRef.current = setTimeout(() => {
      triggeredRef.current = true
      haptic('medium')
      onLongPress()
    }, delay)
  }

  function clear() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  function onClick(e: MouseEvent) {
    if (triggeredRef.current) {
      e.preventDefault()
      triggeredRef.current = false
    }
  }

  return {
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear,
    onTouchStart: start,
    onTouchEnd: clear,
    onTouchMove: clear,
    onClick,
    onContextMenu: (e: MouseEvent | TouchEvent) => e.preventDefault(),
    style: { WebkitTouchCallout: 'none' } as const,
  }
}
