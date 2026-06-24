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
          'fixed bottom-20 md:bottom-8 right-5 md:right-8 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform active:scale-95 hover:bg-primary/90',
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
