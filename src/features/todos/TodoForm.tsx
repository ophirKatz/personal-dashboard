import { useState } from 'react'
import { supabase } from '../../supabase'
import type { Todo } from '../../supabase'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../../components/ui/dialog'
import { today } from '../../utils'
import { haptic } from '../../lib/haptics'
import { Bell } from 'lucide-react'

type Props = {
  open: boolean
  onClose: () => void
  onSave: () => void
  todo?: Todo
  userId: string
}

export default function TodoForm({ open, onClose, onSave, todo, userId }: Props) {
  const [title, setTitle] = useState(todo?.title ?? '')
  const [notes, setNotes] = useState(todo?.notes ?? '')
  const [dueDate, setDueDate] = useState(todo?.due_date ?? today())
  const [dueTime, setDueTime] = useState(todo?.due_time ?? '')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>(todo?.priority ?? 'medium')
  const [reminderEnabled, setReminderEnabled] = useState(todo?.reminder_enabled ?? false)
  const [saving, setSaving] = useState(false)

  function toggleReminder() {
    haptic('selection')
    setReminderEnabled(r => {
      const next = !r
      if (next && !dueTime) setDueTime('09:00')
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    const remindAt = dueDate && reminderEnabled ? new Date(`${dueDate}T${dueTime || '09:00'}`).toISOString() : null
    const payload = {
      title: title.trim(),
      notes: notes.trim() || null,
      due_date: dueDate || null,
      due_time: dueDate ? dueTime || null : null,
      priority,
      reminder_enabled: dueDate ? reminderEnabled : false,
      remind_at: remindAt,
      notified_at: null,
      user_id: userId,
    }
    if (todo) {
      await supabase.from('todos').update(payload).eq('id', todo.id)
    } else {
      await supabase.from('todos').insert(payload)
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
          <DialogTitle>{todo ? 'Edit Task' : 'New Task'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs doing?" autoFocus />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 min-w-0">
                <Label>Due date</Label>
                <Input type="date" value={dueDate} min={today()} onChange={e => setDueDate(e.target.value)} className="min-w-0" />
              </div>
              <div className="space-y-2 min-w-0">
                <Label>Time</Label>
                <Input type="time" value={dueTime} disabled={!dueDate} onChange={e => setDueTime(e.target.value)} className="min-w-0" />
              </div>
            </div>
            {dueDate && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5"><Bell className="h-3.5 w-3.5" />Remind me</Label>
                  <button
                    type="button"
                    onClick={toggleReminder}
                    className={`relative w-11 h-6 rounded-full transition-colors ${reminderEnabled ? 'bg-primary' : 'bg-muted'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${reminderEnabled ? 'translate-x-5' : ''}`} />
                  </button>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v: 'low' | 'medium' | 'high') => setPriority(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes…" rows={3} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || !title.trim()}>
              {saving ? 'Saving…' : todo ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
