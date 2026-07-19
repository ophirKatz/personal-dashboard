import { useState } from 'react'
import { supabase } from '../../supabase'
import type { Habit, HabitFrequency } from '../../supabase'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../../components/ui/dialog'
import { haptic } from '../../lib/haptics'
import { localTimeToUtcTime, utcTimeToLocalTime } from '../../utils'
import { Bell, Clock } from 'lucide-react'

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
]

const EMOJIS = ['✅', '💪', '📚', '🏃', '🧘', '💧', '🥗', '😴', '🎯', '🌟', '🔥', '❤️']

type Props = {
  open: boolean
  onClose: () => void
  onSave: () => void
  habit?: Habit
  userId: string
  v2Enabled: boolean
}

export default function HabitForm({ open, onClose, onSave, habit, userId, v2Enabled }: Props) {
  const [name, setName] = useState(habit?.name ?? '')
  const [emoji, setEmoji] = useState(habit?.emoji ?? '✅')
  const [color, setColor] = useState(habit?.color ?? '#3b82f6')
  const [frequency, setFrequency] = useState<HabitFrequency>(habit?.frequency ?? 'daily')
  const [timesPerWeek, setTimesPerWeek] = useState(habit?.times_per_week ?? 3)
  const [intervalDays, setIntervalDays] = useState(habit?.interval_days ?? 3)
  const [reminderEnabled, setReminderEnabled] = useState(habit?.reminder_enabled ?? false)
  const [reminderTime, setReminderTime] = useState(
    habit?.reminder_time ? utcTimeToLocalTime(habit.reminder_time.slice(0, 5)) : '09:00',
  )
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const payload = {
      name: name.trim(),
      emoji,
      color,
      frequency,
      times_per_week: frequency === 'weekly' ? timesPerWeek : null,
      interval_days: frequency === 'every_n_days' ? intervalDays : null,
      reminder_enabled: reminderEnabled,
      reminder_time: reminderEnabled ? localTimeToUtcTime(reminderTime) : null,
      last_notified_date: null,
      user_id: userId,
    }
    if (habit) {
      await supabase.from('habits').update(payload).eq('id', habit.id)
    } else {
      await supabase.from('habits').insert(payload)
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
          <DialogTitle>{habit ? 'Edit Habit' : 'New Habit'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-5">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Drink water"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-2">
                {EMOJIS.map(e => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => { haptic('selection'); setEmoji(e) }}
                    className={`text-xl p-2 rounded-lg border-2 transition-colors ${emoji === e ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-accent'}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { haptic('selection'); setColor(c) }}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Frequency</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { haptic('selection'); setFrequency('daily') }}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${frequency === 'daily' ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-accent'}`}
                >
                  Daily
                </button>
                <button
                  type="button"
                  onClick={() => { haptic('selection'); setFrequency('weekly') }}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${frequency === 'weekly' ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-accent'}`}
                >
                  Weekly
                </button>
                {v2Enabled && (
                  <button
                    type="button"
                    onClick={() => { haptic('selection'); setFrequency('every_n_days') }}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${frequency === 'every_n_days' ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-accent'}`}
                  >
                    Every N days
                  </button>
                )}
              </div>
              {frequency === 'weekly' && (
                <div className="flex items-center gap-3 pt-1">
                  <Label className="shrink-0">Times per week</Label>
                  <div className="flex items-center gap-2 ml-auto">
                    <button type="button" onClick={() => setTimesPerWeek(Math.max(1, timesPerWeek - 1))} className="w-8 h-8 rounded-lg border flex items-center justify-center hover:bg-accent">−</button>
                    <span className="w-6 text-center font-medium">{timesPerWeek}</span>
                    <button type="button" onClick={() => setTimesPerWeek(Math.min(7, timesPerWeek + 1))} className="w-8 h-8 rounded-lg border flex items-center justify-center hover:bg-accent">+</button>
                  </div>
                </div>
              )}
              {frequency === 'every_n_days' && (
                <div className="flex items-center gap-3 pt-1">
                  <Label className="shrink-0">Every</Label>
                  <div className="flex items-center gap-2 ml-auto">
                    <button type="button" onClick={() => setIntervalDays(Math.max(2, intervalDays - 1))} className="w-8 h-8 rounded-lg border flex items-center justify-center hover:bg-accent">−</button>
                    <span className="w-6 text-center font-medium">{intervalDays}</span>
                    <button type="button" onClick={() => setIntervalDays(Math.min(30, intervalDays + 1))} className="w-8 h-8 rounded-lg border flex items-center justify-center hover:bg-accent">+</button>
                  </div>
                  <span className="text-sm text-muted-foreground">days</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5"><Bell className="h-3.5 w-3.5" />Reminder</Label>
                <button
                  type="button"
                  onClick={() => { haptic('selection'); setReminderEnabled(r => !r) }}
                  className={`relative w-11 h-6 rounded-full transition-colors ${reminderEnabled ? 'bg-primary' : 'bg-muted'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${reminderEnabled ? 'translate-x-5' : ''}`} />
                </button>
              </div>
              {reminderEnabled && (
                <div className="space-y-1.5 min-w-0">
                  <Label className="flex items-center gap-1 text-xs">
                    <Clock className="h-3.5 w-3.5" />
                    Time
                  </Label>
                  <Input
                    type="time"
                    value={reminderTime}
                    onChange={e => setReminderTime(e.target.value)}
                    className="h-11 rounded-xl min-w-0"
                  />
                </div>
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? 'Saving…' : habit ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
