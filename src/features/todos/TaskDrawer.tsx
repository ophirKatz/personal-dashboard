import { useState } from 'react'
import { CalendarDays, Clock } from 'lucide-react'
import { supabase } from '../../supabase'
import type { Todo } from '../../supabase'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
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

function nextRoundHour(): string {
  const d = new Date()
  d.setHours(d.getHours() + 1, 0, 0, 0)
  return `${String(d.getHours()).padStart(2, '0')}:00`
}

export default function TaskDrawer({ open, onClose, onSave, todo, userId }: Props) {
  const isGoogleTask = todo?.source === 'google'
  const [title, setTitle] = useState(todo?.title ?? '')
  const [dueDate, setDueDate] = useState(todo?.due_date ?? today())
  const [dueTime, setDueTime] = useState(todo?.due_time ?? (isGoogleTask ? '' : nextRoundHour()))
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)

    if (todo && isGoogleTask) {
      await updateGoogleTask(todo, {
        title: title.trim(),
        notes: todo.notes,
        due_date: dueDate || null,
      })
    } else {
      const remindAt = dueDate && dueTime ? new Date(`${dueDate}T${dueTime}`).toISOString() : null
      const payload = {
        title: title.trim(),
        due_date: dueDate || null,
        due_time: dueDate ? dueTime || null : null,
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
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{todo ? 'Edit task' : 'New task'}</DrawerTitle>
        </DrawerHeader>
        <form onSubmit={handleSubmit}>
          <DrawerBody className="space-y-4">
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What needs doing?"
              autoFocus
              className="h-12 rounded-xl text-base"
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 min-w-0">
                <label className="flex items-center gap-1 px-1 text-xs font-medium text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Date
                </label>
                <Input
                  type="date"
                  value={dueDate}
                  min={isGoogleTask ? undefined : today()}
                  onChange={e => setDueDate(e.target.value)}
                  className="h-11 rounded-xl min-w-0"
                />
              </div>
              {!isGoogleTask && (
                <div className="space-y-1.5 min-w-0">
                  <label className="flex items-center gap-1 px-1 text-xs font-medium text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    Time
                  </label>
                  <Input
                    type="time"
                    value={dueTime}
                    disabled={!dueDate}
                    onChange={e => setDueTime(e.target.value)}
                    className="h-11 rounded-xl min-w-0"
                  />
                </div>
              )}
            </div>
            <Button type="submit" disabled={saving || !title.trim()} className="h-12 w-full rounded-xl text-base font-semibold">
              {saving ? 'Saving…' : todo ? 'Save' : 'Add task'}
            </Button>
          </DrawerBody>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
