import { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { MAX_DISTANCE_KM, MIN_DISTANCE_KM, formatKm, parseKm } from './workoutUtils'

const STEP_KM = 0.5

type Props = { value: number; onChange: (km: number) => void }

// Kilometres for a distance exercise: -/+ nudge by half a km, or type an exact distance (3.2).
export default function DistanceStepper({ value, onChange }: Props) {
  // The box keeps its own text so partial input ("3.") isn't rewritten under the cursor.
  const [text, setText] = useState(formatKm(value))

  useEffect(() => {
    setText(current => (parseKm(current) === value ? current : formatKm(value)))
  }, [value])

  function step(delta: number) {
    const next = Math.round((value + delta) * 100) / 100
    onChange(Math.min(MAX_DISTANCE_KM, Math.max(MIN_DISTANCE_KM, next)))
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground w-7">Dist</span>
      <button
        type="button"
        aria-label="Decrease distance"
        onClick={() => step(-STEP_KM)}
        className="p-1.5 rounded-lg border border-border hover:bg-accent"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        type="text"
        inputMode="decimal"
        aria-label="Distance in kilometres"
        value={text}
        onChange={e => {
          setText(e.target.value)
          const km = parseKm(e.target.value)
          if (km !== null) onChange(km)
        }}
        onBlur={() => setText(formatKm(value))}
        onFocus={e => e.target.select()}
        className="w-14 rounded-lg border border-border bg-background px-1 py-1 text-center text-sm font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <span className="text-xs text-muted-foreground">km</span>
      <button
        type="button"
        aria-label="Increase distance"
        onClick={() => step(STEP_KM)}
        className="p-1.5 rounded-lg border border-border hover:bg-accent"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
