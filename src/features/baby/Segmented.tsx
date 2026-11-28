import { cn } from '../../utils'

type Props<T extends string> = {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  label: string
  className?: string
}

/** A row of mutually exclusive choices, big enough to hit one-handed. */
export default function Segmented<T extends string>({ value, options, onChange, label, className }: Props<T>) {
  return (
    <div className={cn('flex gap-1 rounded-xl bg-muted p-1', className)} role="group" aria-label={label}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'min-h-10 flex-1 whitespace-nowrap rounded-lg px-2 text-sm font-medium transition-colors',
            value === o.value ? 'bg-background text-foreground shadow-sm dark:bg-white/10' : 'text-muted-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
