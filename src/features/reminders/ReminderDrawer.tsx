import { useState } from 'react'
import { CalendarClock, RefreshCw } from 'lucide-react'
import { supabase } from '../../supabase'
import type { Reminder } from '../../supabase'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
import { format } from 'date-fns'
import { haptic } from '../../lib/haptics'

type Props = {
  open: boolean
  onClose: () => void
  onSave: () => void
  reminder?: Reminder
  userId: string
}

export default function ReminderDrawer({ open, onClose, onSave, reminder, userId }: Props) {
  const defaultDt = reminder ? reminder.remind_at.slice(0, 16) : format(new Date(), "yyyy-MM-dd'T'HH:mm")
  const [title, setTitle] = useState(reminder?.title ?? '')
  const [remindAt, setRemindAt] = useState(defaultDt)
  const [repeat, setRepeat] = useState<string>(reminder?.repeat ?? 'none')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !remindAt) return
    setSaving(true)
    const payload = {
      title: title.trim(),
      remind_at: new Date(remindAt).toISOString(),
      repeat: repeat === 'none' ? null : repeat,
      user_id: userId,
    }
    if (reminder) {
      await supabase.from('reminders').update({ ...payload, notified_at: null }).eq('id', reminder.id)
    } else {
      await supabase.from('reminders').insert(payload)
    }
    haptic('success')
    setSaving(false)
    onSave()
    onClose()
  }

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{reminder ? 'Edit reminder' : 'New reminder'}</DrawerTitle>
        </DrawerHeader>
        <form onSubmit={handleSubmit}>
          <DrawerBody className="space-y-4">
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What to remember?"
              autoFocus
              className="h-12 rounded-xl text-base"
            />
            {/* Stacked full-width: a combined datetime-local control needs
                more room than a 50% column gives it, which made it overflow
                its grid cell and visually overlap the Repeat field next to it. */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1 px-1 text-xs font-medium text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" />
                Date &amp; time
              </label>
              <Input
                type="datetime-local"
                value={remindAt}
                onChange={e => setRemindAt(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-1 px-1 text-xs font-medium text-muted-foreground">
                <RefreshCw className="h-3.5 w-3.5" />
                Repeat
              </label>
              <Select value={repeat} onValueChange={setRepeat}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No repeat</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={saving || !title.trim()} className="h-12 w-full rounded-xl text-base font-semibold">
              {saving ? 'Saving…' : reminder ? 'Save' : 'Add reminder'}
            </Button>
          </DrawerBody>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
