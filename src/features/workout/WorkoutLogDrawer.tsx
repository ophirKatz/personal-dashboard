import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
import WorkoutForm from './WorkoutForm'

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  // Date the new workout starts on; defaults to today.
  date?: string
  title?: string
}

/** The Workout page's log form in a bottom sheet, for logging straight from the home widget. */
export default function WorkoutLogDrawer({ open, onClose, onSaved, date, title = 'Log workout' }: Props) {
  return (
    <Drawer open={open} onOpenChange={v => !v && onClose()}>
      <DrawerContent>
        <DrawerHeader><DrawerTitle>{title}</DrawerTitle></DrawerHeader>
        <DrawerBody>
          <WorkoutForm initialDate={date} onSaved={onSaved} />
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
