import * as React from 'react'
import { cn } from '../../utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        // native date/time controls have a browser-defined intrinsic min
        // width (especially on iOS Safari) that can exceed the box's own
        // width and push past its container; max-w-full+min-w-0 force it to
        // shrink to whatever space is actually available instead of
        // overflowing the screen
        'flex h-10 w-full min-w-0 max-w-full rounded-lg border border-input bg-background px-3 py-2 text-base sm:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export { Input }
