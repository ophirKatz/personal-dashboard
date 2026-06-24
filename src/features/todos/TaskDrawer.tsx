import { useState } from 'react'
import { supabase } from '../../supabase'
import type { Todo } from '../../supabase'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Drawer, DrawerContent, DrawerBody } from '../../components/ui/drawer'
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

export default function TaskDrawer({ open, onClose, onSave, todo, userId }: Props) {
  const isGoogleTask = todo?.source === 'google'
  const [title, setTitle] = useState(todo?.title ?? '')
  const [dueDate, setDueDate] = useState(todo?.due_date ?? '')
  const [dueTime, setDueTime] = useState(todo?.due_time ?? '')
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
        <form onSubmit={handleSubmit}>
          <DrawerBody className="space-y-3">
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What needs doing?"
              autoFocus
              className="text-base h-12"
            />
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dueDate}
                min={isGoogleTask ? undefined : today()}
                onChange={e => setDueDate(e.target.value)}
                className="flex-1 min-w-0"
              />
              {!isGoogleTask && (
                <Input
                  type="time"
                  value={dueTime}
                  disabled={!dueDate}
                  onChange={e => setDueTime(e.target.value)}
                  className="flex-1 min-w-0"
                />
              )}
            </div>
            <Button type="submit" disabled={saving || !title.trim()} className="w-full">
              {saving ? 'Saving…' : todo ? 'Save' : 'Add task'}
            </Button>
          </DrawerBody>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
