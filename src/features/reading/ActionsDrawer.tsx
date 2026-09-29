import type { LucideIcon } from 'lucide-react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
import { cn } from '../../utils'

export type DrawerAction = {
  label: string
  icon: LucideIcon
  onSelect: () => void
  destructive?: boolean
}

type Props = { open: boolean; onClose: () => void; title: string; actions: DrawerAction[] }

/** Row-of-actions bottom sheet (same look as AddRecipeSheet). */
export default function ActionsDrawer({ open, onClose, title, actions }: Props) {
  return (
    <Drawer open={open} onOpenChange={v => !v && onClose()}>
      <DrawerContent>
        <DrawerHeader><DrawerTitle className="line-clamp-1">{title}</DrawerTitle></DrawerHeader>
        <DrawerBody className="space-y-2">
          {actions.map(action => (
            <button
              key={action.label}
              onClick={() => { onClose(); action.onSelect() }}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card hover:bg-accent text-left transition-colors"
            >
              <div className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                action.destructive ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary',
              )}>
                <action.icon className="h-5 w-5" />
              </div>
              <p className={cn('font-medium', action.destructive && 'text-destructive')}>{action.label}</p>
            </button>
          ))}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
