import { useEffect, useState } from 'react'
import { Delete } from 'lucide-react'
import { CODE_LENGTH, formatCooldown } from '../../lib/pageLock'
import { haptic } from '../../lib/haptics'
import { cn } from '../../utils'
import type { CodeResult } from './LockProvider'

type Props = {
  title: string
  subtitle?: string
  /** Called once the last digit is typed. A failure shows its message and clears the dots. */
  onSubmit: (code: string) => CodeResult | Promise<CodeResult>
  /** While this is in the future, entry is disabled and a countdown is shown. */
  lockedUntil?: number
  onCancel?: () => void
  cancelLabel?: string
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

// Re-renders every few hundred ms while a cooldown is running.
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [active])
  return now
}

export default function PinPad({ title, subtitle, onSubmit, lockedUntil = 0, onCancel, cancelLabel = 'Cancel' }: Props) {
  const [digits, setDigits] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  const coolingDown = lockedUntil > Date.now()
  const now = useNow(coolingDown)
  const remaining = Math.max(0, lockedUntil - now)
  const disabled = busy || remaining > 0

  async function press(digit: string) {
    if (disabled || digits.length >= CODE_LENGTH) return
    haptic('selection')
    const next = digits + digit
    setDigits(next)
    setMessage(null)
    if (next.length < CODE_LENGTH) return

    setBusy(true)
    const result = await onSubmit(next)
    if (result.ok) {
      haptic('success')
      setBusy(false)
      return
    }
    haptic('warning')
    setMessage(result.message)
    setFailed(true)
    setTimeout(() => {
      setDigits('')
      setFailed(false)
      setBusy(false)
    }, 450)
  }

  function backspace() {
    if (disabled) return
    setDigits(d => d.slice(0, -1))
    setMessage(null)
  }

  // Hardware keyboard on desktop.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') backspace()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const status = remaining > 0 ? `Too many wrong codes. Try again in ${formatCooldown(remaining)}.` : message

  return (
    <div className="mx-auto flex w-full max-w-xs flex-col items-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}

      <div className="mt-6 flex gap-4" aria-hidden="true">
        {Array.from({ length: CODE_LENGTH }, (_, i) => (
          <span
            key={i}
            className={cn(
              'h-3.5 w-3.5 rounded-full border-2 transition-colors',
              failed
                ? 'border-destructive bg-destructive'
                : i < digits.length
                  ? 'border-primary bg-primary'
                  : 'border-muted-foreground/40',
            )}
          />
        ))}
      </div>

      {/* Reserved height so the keypad doesn't jump when a message appears. */}
      <p role="status" className="mt-4 min-h-10 text-center text-sm text-destructive">
        {status}
      </p>

      <div className="mt-2 grid w-full grid-cols-3 gap-3">
        {KEYS.map(k => (
          <button
            key={k}
            type="button"
            disabled={disabled}
            onClick={() => press(k)}
            aria-label={k}
            className="h-16 rounded-2xl border border-border bg-card text-2xl font-medium transition-colors active:bg-accent disabled:opacity-40"
          >
            {k}
          </button>
        ))}
        {onCancel ? (
          <button type="button" onClick={onCancel} className="h-16 rounded-2xl text-sm font-medium text-muted-foreground active:bg-accent">
            {cancelLabel}
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={() => press('0')}
          aria-label="0"
          className="h-16 rounded-2xl border border-border bg-card text-2xl font-medium transition-colors active:bg-accent disabled:opacity-40"
        >
          0
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={backspace}
          aria-label="Delete"
          className="flex h-16 items-center justify-center rounded-2xl text-muted-foreground active:bg-accent disabled:opacity-40"
        >
          <Delete className="h-6 w-6" />
        </button>
      </div>
    </div>
  )
}
