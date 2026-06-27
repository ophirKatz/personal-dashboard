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

  function onTouchEnd(e: TouchEvent) {
    clear()
    // A successful long-press must suppress the browser's synthetic
    // mousedown/mouseup/click that follows touchend, otherwise the
    // synthetic mousedown re-triggers start() and resets triggeredRef
    // before the click handler can read it.
    if (triggeredRef.current) e.preventDefault()
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
    onTouchEnd,
    onTouchMove: clear,
    onClick,
    onContextMenu: (e: MouseEvent | TouchEvent) => e.preventDefault(),
    style: { WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' } as const,
  }
}
