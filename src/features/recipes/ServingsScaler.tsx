import { Scale } from 'lucide-react'

type Props = {
  baseServings: number
  value: number
  onChange: (servings: number) => void
}

export default function ServingsScaler({ baseServings, value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <Scale className="h-4 w-4 text-muted-foreground" />
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="w-7 h-7 rounded-lg border border-input flex items-center justify-center hover:bg-accent"
      >
        −
      </button>
      <span className="w-24 text-center text-sm">
        <span className="font-semibold">{value}</span> <span className="text-muted-foreground">serving{value === 1 ? '' : 's'}</span>
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="w-7 h-7 rounded-lg border border-input flex items-center justify-center hover:bg-accent"
      >
        +
      </button>
      {value !== baseServings && (
        <button type="button" onClick={() => onChange(baseServings)} className="text-xs text-muted-foreground hover:text-foreground underline">
          Reset
        </button>
      )}
    </div>
  )
}
