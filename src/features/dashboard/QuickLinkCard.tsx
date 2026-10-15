import type { KeyboardEvent, MouseEvent } from 'react'
import { Plus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useLongPress } from '../../lib/useLongPress'

type Props = {
  to: string
  label: string
  icon: LucideIcon
  iconClassName: string
  // undefined while the value is still loading
  subtitle: string | undefined
  // The "+" button and a long press on the card both run this.
  onQuickAdd: () => void
  quickAddLabel: string
  longPressHint: string
}

export default function QuickLinkCard({ to, label, icon: Icon, iconClassName, subtitle, onQuickAdd, quickAddLabel, longPressHint }: Props) {
  const navigate = useNavigate()
  const longPress = useLongPress(onQuickAdd)

  function onClick(e: MouseEvent<HTMLDivElement>) {
    longPress.onClick(e)
    if (!e.defaultPrevented) navigate(to)
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      navigate(to)
    }
  }

  return (
    // The "+" is a sibling of the link, not a child, so it never counts as a long-press or navigation.
    <div className="relative">
      <div
        role="link"
        tabIndex={0}
        title={longPressHint}
        className="p-2.5 bg-card border border-border rounded-xl active:scale-[0.98] transition-transform select-none cursor-pointer"
        {...longPress}
        onClick={onClick}
        onKeyDown={onKeyDown}
      >
        {/* pr-9 keeps the label clear of the "+" button overlaid on the right */}
        <div className="flex items-center gap-1.5 h-8 pr-9 select-none">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconClassName}`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <p className="text-sm font-semibold truncate">{label}</p>
        </div>
        <div className="mt-1 h-4 flex items-center select-none">
          {subtitle === undefined ? (
            <span className="block h-3 w-20 rounded bg-muted animate-pulse" />
          ) : (
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
      </div>
      <button
        type="button"
        aria-label={quickAddLabel}
        onClick={onQuickAdd}
        className="absolute top-2.5 right-2.5 h-8 w-8 rounded-full bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}
