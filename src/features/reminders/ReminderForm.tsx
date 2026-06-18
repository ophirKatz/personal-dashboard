import { useState } from 'react'
import { supabase } from '../../supabase'
import type { Reminder } from '../../supabase'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../../components/ui/dialog'
import { format } from 'date-fns'
import { haptic } from '../../lib/haptics'

type Props = {
  open: boolean
  onClose: () => void
  onSave: () => void
  reminder?: Reminder
  userId: string
}

export default function ReminderForm({ open, onClose, onSave, reminder, userId }: Props) {
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
      await supabase.from('reminders').update(payload).eq('id', reminder.id)
    } else {
      await supabase.from('reminders').insert(payload)
    }
    haptic('success')
    setSaving(false)
    onSave()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{reminder ? 'Edit Reminder' : 'New Reminder'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="What to remember?" autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Date & Time</Label>
              <Input type="datetime-local" value={remindAt} onChange={e => setRemindAt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Repeat</Label>
              <Select value={repeat} onValueChange={setRepeat}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No repeat</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || !title.trim()}>
              {saving ? 'Saving…' : reminder ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
