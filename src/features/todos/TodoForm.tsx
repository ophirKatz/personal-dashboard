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
import { updateGoogleTask } from './googleTasks'

type Props = {
  open: boolean
  onClose: () => void
  onSave: () => void
  todo?: Todo
  userId: string
}

export default function TodoForm({ open, onClose, onSave, todo, userId }: Props) {
  const isGoogleTask = todo?.source === 'google'
  const [title, setTitle] = useState(todo?.title ?? '')
  const [notes, setNotes] = useState(todo?.notes ?? '')
  const [dueDate, setDueDate] = useState(todo?.due_date ?? today())
  const [dueTime, setDueTime] = useState(todo?.due_time ?? '')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>(todo?.priority ?? 'medium')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)

    if (todo && isGoogleTask) {
      await updateGoogleTask(todo, {
        title: title.trim(),
        notes: notes.trim() || null,
        due_date: dueDate || null,
      })
    } else {
      const remindAt = dueDate && dueTime ? new Date(`${dueDate}T${dueTime}`).toISOString() : null
      const payload = {
        title: title.trim(),
        notes: notes.trim() || null,
        due_date: dueDate || null,
        due_time: dueDate ? dueTime || null : null,
        priority,
        reminder_enabled: !!remindAt,
        remind_at: remindAt,
        notified_at: todo && remindAt === todo.remind_at ? todo.notified_at : null,
        user_id: userId,
      }
      if (todo) {
        await supabase.from('todos').update(payload).eq('id', todo.id)
      } else {
        await supabase.from('todos').insert(payload)
      }
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
            {isGoogleTask ? (
              <div className="space-y-2 min-w-0">
                <Label>Due date</Label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="min-w-0" />
              </div>
            ) : (
              <>
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
                {dueDate && !dueTime && (
                  <p className="text-xs text-muted-foreground">Add a time to get a reminder notification.</p>
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
              </>
            )}
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
