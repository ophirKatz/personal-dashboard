import { Minus, Plus } from 'lucide-react'

type Props = { label: string; value: number; min?: number; bigStep?: number; onChange: (v: number) => void }

export default function Stepper({ label, value, min = 1, bigStep, onChange }: Props) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground w-7">{label}</span>
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="p-1.5 rounded-lg border border-border hover:bg-accent"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-7 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        onClick={() => onChange(value + 1)}
        className="p-1.5 rounded-lg border border-border hover:bg-accent"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      {bigStep && (
        <button
          type="button"
          aria-label={`Increase ${label} by ${bigStep}`}
          onClick={() => onChange(value + bigStep)}
          className="px-1.5 py-1.5 rounded-lg border border-border hover:bg-accent text-xs font-semibold tabular-nums leading-none"
        >
          +{bigStep}
        </button>
      )}
    </div>
  )
}
