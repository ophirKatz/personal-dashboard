import { useState } from 'react'
import { addHours } from 'date-fns'
import { CalendarArrowUp, CalendarClock, Clock4 } from 'lucide-react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { haptic } from '../../lib/haptics'

type Props = {
  open: boolean
  onClose: () => void
  onPostponeTomorrow: () => void
  onPostponeTo: (target: Date) => void
}

export default function PostponeMenu({ open, onClose, onPostponeTomorrow, onPostponeTo }: Props) {
  const [customizing, setCustomizing] = useState(false)
  const [customValue, setCustomValue] = useState('')

  function handleOpenChange(next: boolean) {
    if (next) return
    setCustomizing(false)
    setCustomValue('')
    onClose()
  }

  function handleTomorrow() {
    haptic('light')
    onPostponeTomorrow()
  }

  function handleInOneHour() {
    haptic('light')
    onPostponeTo(addHours(new Date(), 1))
  }

  function handleCustomSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!customValue) return
    haptic('light')
    onPostponeTo(new Date(customValue))
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Postpone task</DrawerTitle>
        </DrawerHeader>
        <DrawerBody className="space-y-1">
          {!customizing ? (
            <div key="menu" className="space-y-1 animate-in fade-in-0 slide-in-from-left-2 duration-150">
              <button onClick={handleTomorrow} className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-accent text-left">
                <CalendarArrowUp className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium">Tomorrow</span>
              </button>
              <button onClick={handleInOneHour} className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-accent text-left">
                <Clock4 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium">In 1 hour</span>
              </button>
              <button onClick={() => setCustomizing(true)} className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-accent text-left">
                <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium">Custom date & time…</span>
              </button>
            </div>
          ) : (
            <form
              key="custom"
              onSubmit={handleCustomSubmit}
              className="flex items-center gap-2 pt-1 animate-in fade-in-0 slide-in-from-right-2 duration-150"
            >
              <Input
                type="datetime-local"
                value={customValue}
                onChange={e => setCustomValue(e.target.value)}
                autoFocus
                className="h-11 flex-1 rounded-xl text-base"
              />
              <Button type="submit" disabled={!customValue} className="h-11 rounded-xl shrink-0">
                Set
              </Button>
            </form>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
