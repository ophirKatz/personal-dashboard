import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../utils'

const Fab = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, ...props }, ref) => {
    const [mounted, setMounted] = React.useState(false)
    React.useEffect(() => setMounted(true), [])
    if (!mounted) return null

    return createPortal(
      <button
        ref={ref}
        className={cn(
          // bottom offset clears the mobile tab bar using its live measured
          // height (see Layout.tsx) plus a gap, so it can never drift back
          // under/into the bar the way a hardcoded offset previously did
          'fixed bottom-[calc(var(--tabbar-height,5rem)_+_1rem)] md:bottom-8 right-5 md:right-8 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform active:scale-95 hover:bg-primary/90',
          className,
        )}
        {...props}
      >
        {children}
      </button>,
      document.body,
    )
  },
)
Fab.displayName = 'Fab'

export { Fab }
