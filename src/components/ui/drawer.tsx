import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '../../utils'

const Drawer = DialogPrimitive.Root
const DrawerTrigger = DialogPrimitive.Trigger
const DrawerPortal = DialogPrimitive.Portal
const DrawerClose = DialogPrimitive.Close

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn('fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0', className)}
    {...props}
  />
))
DrawerOverlay.displayName = DialogPrimitive.Overlay.displayName

// Tracks the on-screen keyboard: `fixed` positioning anchors to the layout
// viewport, which doesn't shrink when the keyboard opens, so a naive
// `bottom-0` sheet ends up parked behind the keyboard instead of above it.
// The visual viewport does shrink, so we measure the gap and use it to pull
// the sheet up.
function useKeyboardInset() {
  const [inset, setInset] = React.useState(0)

  React.useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    function update() {
      const offset = window.innerHeight - vv!.height - vv!.offsetTop
      setInset(Math.max(0, Math.round(offset)))
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return inset
}

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, style, ...props }, ref) => {
  const keyboardInset = useKeyboardInset()

  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DialogPrimitive.Content
        ref={ref}
        style={{ bottom: keyboardInset, maxHeight: `calc(100vh - ${keyboardInset}px)`, ...style }}
        className={cn(
          // overflow-x-hidden mirrors DialogContent: a stray overflowing
          // child (e.g. a native date/time control) gets clipped to the
          // sheet's rounded edge instead of bleeding past the screen
          'fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-2xl overflow-x-hidden overflow-y-auto bg-background shadow-2xl ring-1 ring-border/50 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom rounded-t-3xl pb-[max(1.25rem,env(safe-area-inset-bottom))]',
          className,
        )}
        {...props}
      >
        <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-muted" />
        {children}
      </DialogPrimitive.Content>
    </DrawerPortal>
  )
})
DrawerContent.displayName = DialogPrimitive.Content.displayName

const DrawerHeader = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex items-center justify-between px-5 pt-2 pb-1', className)} {...props}>
    {children}
    <DrawerClose className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
      <X className="h-4 w-4" />
    </DrawerClose>
  </div>
)

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-sm font-semibold text-muted-foreground', className)} {...props} />
))
DrawerTitle.displayName = DialogPrimitive.Title.displayName

const DrawerBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('px-5 pb-5 pt-2', className)} {...props} />
)

export { Drawer, DrawerTrigger, DrawerContent, DrawerClose, DrawerHeader, DrawerTitle, DrawerBody }
