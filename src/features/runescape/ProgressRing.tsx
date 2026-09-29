import { cn } from '../../utils'

type Props = {
  value: number
  size?: number
  stroke?: number
  className?: string
  trackClassName?: string
  barClassName?: string
  children?: React.ReactNode
}

/** Circular progress; `value` is 0..1. */
export default function ProgressRing({
  value, size = 64, stroke = 5, className, trackClassName = 'stroke-muted', barClassName = 'stroke-primary', children,
}: Props) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.min(1, Math.max(0, value))
  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={trackClassName} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          className={cn('transition-[stroke-dashoffset] duration-700 ease-out', barClassName)}
          strokeDasharray={c} strokeDashoffset={c * (1 - clamped)}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}
