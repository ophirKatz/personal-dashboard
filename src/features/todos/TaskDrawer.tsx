import { useState } from 'react'
import { CalendarClock, CalendarDays, RefreshCw, Users, ChevronDown } from 'lucide-react'
import { supabase } from '../../supabase'
import type { Todo, Friend } from '../../supabase'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Checkbox } from '../../components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Popover, PopoverTrigger, PopoverContent } from '../../components/ui/popover'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
import { today, cn } from '../../utils'
import type { RecurrenceUnit } from '../../utils'
import { haptic } from '../../lib/haptics'
import { updateGoogleTask } from './googleTasks'

type Props = {
  open: boolean
  onClose: () => void
  onSave: () => void
  todo?: Todo
  userId: string
  friends: Friend[]
  linkedFriendIds: string[]
}

type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom'

function nextRoundHour(): string {
  const d = new Date()
  d.setHours(d.getHours() + 1, 0, 0, 0)
  return `${String(d.getHours()).padStart(2, '0')}:00`
}

function recurrenceTypeOf(todo: Todo | undefined): RecurrenceType {
  if (!todo?.recurrence_interval || !todo?.recurrence_unit) return 'none'
  if (todo.recurrence_interval === 1 && todo.recurrence_unit === 'day') return 'daily'
  if (todo.recurrence_interval === 1 && todo.recurrence_unit === 'week') return 'weekly'
  if (todo.recurrence_interval === 1 && todo.recurrence_unit === 'month') return 'monthly'
  return 'custom'
}

export default function TaskDrawer({ open, onClose, onSave, todo, userId, friends, linkedFriendIds }: Props) {
  const isGoogleTask = todo?.source === 'google'
  const [title, setTitle] = useState(todo?.title ?? '')
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>(linkedFriendIds)
  const [dueDate, setDueDate] = useState(todo?.due_date ?? today())
  const [dueAt, setDueAt] = useState(`${todo?.due_date ?? today()}T${todo?.due_time ?? nextRoundHour()}`)
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(recurrenceTypeOf(todo))
  const [customInterval, setCustomInterval] = useState(
    recurrenceTypeOf(todo) === 'custom' ? todo!.recurrence_interval! : 1,
  )
  const [customUnit, setCustomUnit] = useState<RecurrenceUnit>(
    recurrenceTypeOf(todo) === 'custom' ? todo!.recurrence_unit! : 'day',
  )
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)

    let todoId = todo?.id

    if (todo && isGoogleTask) {
      await updateGoogleTask(todo, {
        title: title.trim(),
        notes: todo.notes,
        due_date: dueDate || null,
      })
    } else {
      const [nextDate, nextTime] = dueAt ? dueAt.split('T') : [null, null]
      const remindAt = dueAt ? new Date(dueAt).toISOString() : null
      const recurrence = nextDate && recurrenceType !== 'none'
        ? recurrenceType === 'daily' ? { interval: 1, unit: 'day' as const }
          : recurrenceType === 'weekly' ? { interval: 1, unit: 'week' as const }
          : recurrenceType === 'monthly' ? { interval: 1, unit: 'month' as const }
          : { interval: customInterval, unit: customUnit }
        : null
      const payload = {
        title: title.trim(),
        due_date: nextDate,
        due_time: nextTime,
        reminder_enabled: !!remindAt,
        remind_at: remindAt,
        notified_at: todo && remindAt === todo.remind_at ? todo.notified_at : null,
        user_id: userId,
        recurrence_interval: recurrence?.interval ?? null,
        recurrence_unit: recurrence?.unit ?? null,
      }
      if (todo) {
        await supabase.from('todos').update(payload).eq('id', todo.id)
      } else {
        const { data } = await supabase.from('todos').insert(payload).select('id').single()
        todoId = data?.id
      }
    }

    if (todoId) {
      await supabase.from('todo_friends').delete().eq('todo_id', todoId)
      if (selectedFriendIds.length > 0) {
        await supabase.from('todo_friends').insert(
          selectedFriendIds.map(friendId => ({ todo_id: todoId, friend_id: friendId, user_id: userId })),
        )
      }
    }

    haptic('success')
    setSaving(false)
    onSave()
    onClose()
  }

  function toggleFriend(friendId: string, checked: boolean) {
    setSelectedFriendIds(prev => checked ? [...prev, friendId] : prev.filter(id => id !== friendId))
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
              dir="auto"
              className="h-12 rounded-xl text-base"
            />
            {isGoogleTask ? (
              <div className="space-y-1.5">
                <label className="flex items-center gap-1 px-1 text-xs font-medium text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Date
                </label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="flex items-center gap-1 px-1 text-xs font-medium text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5" />
                  Date &amp; time
                </label>
                <Input
                  type="datetime-local"
                  value={dueAt}
                  min={`${today()}T00:00`}
                  onChange={e => setDueAt(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
            )}
            {!isGoogleTask && dueAt && (
              <div className="space-y-1.5">
                <label className="flex items-center gap-1 px-1 text-xs font-medium text-muted-foreground">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Repeat
                </label>
                <Select value={recurrenceType} onValueChange={v => setRecurrenceType(v as RecurrenceType)}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Does not repeat</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                {recurrenceType === 'custom' && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-sm text-muted-foreground shrink-0">Every</span>
                    <Input
                      type="number"
                      min={1}
                      value={customInterval}
                      onChange={e => setCustomInterval(Math.max(1, Number(e.target.value) || 1))}
                      className="h-11 rounded-xl w-20"
                    />
                    <Select value={customUnit} onValueChange={v => setCustomUnit(v as RecurrenceUnit)}>
                      <SelectTrigger className="h-11 rounded-xl flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">Day(s)</SelectItem>
                        <SelectItem value="week">Week(s)</SelectItem>
                        <SelectItem value="month">Month(s)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
            {friends.length > 0 && (
              <div className="space-y-1.5">
                <label className="flex items-center gap-1 px-1 text-xs font-medium text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  Friends (optional)
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex h-11 w-full items-center justify-between rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <span className={cn('truncate text-left', selectedFriendIds.length === 0 && 'text-muted-foreground')}>
                        {selectedFriendIds.length === 0
                          ? 'Select friends'
                          : friends.filter(f => selectedFriendIds.includes(f.id)).map(f => f.name).join(', ')}
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-h-52 overflow-y-auto">
                    {friends.map(friend => (
                      <label key={friend.id} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm cursor-pointer hover:bg-accent">
                        <Checkbox
                          checked={selectedFriendIds.includes(friend.id)}
                          onCheckedChange={checked => toggleFriend(friend.id, checked === true)}
                        />
                        <span dir="auto">{friend.name}</span>
                      </label>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>
            )}
            <Button type="submit" disabled={saving || !title.trim()} className="h-12 w-full rounded-xl text-base font-semibold">
              {saving ? 'Saving…' : todo ? 'Save' : 'Add task'}
            </Button>
          </DrawerBody>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
