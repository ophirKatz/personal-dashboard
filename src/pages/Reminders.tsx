import { useEffect, useState } from 'react'
import { Plus, Bell, BellOff, Pencil, Trash2, RefreshCw } from 'lucide-react'
import { supabase } from '../supabase'
import type { Reminder } from '../supabase'
import type { User } from '@supabase/supabase-js'
import ReminderDrawer from '../features/reminders/ReminderDrawer'
import { Fab } from '../components/ui/fab'
import { cn, formatDateTime, advanceRepeat } from '../utils'
import { isBefore } from 'date-fns'

export default function Reminders() {
  const [user, setUser] = useState<User | null>(null)
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Reminder | undefined>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  async function load() {
    const { data } = await supabase.from('reminders').select('*').order('remind_at')
    setReminders(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function dismiss(reminder: Reminder) {
    if (reminder.repeat) {
      const nextAt = advanceRepeat(reminder.remind_at, reminder.repeat)
      await supabase.from('reminders').update({ remind_at: nextAt, notified_at: null }).eq('id', reminder.id)
    } else {
      await supabase.from('reminders').delete().eq('id', reminder.id)
    }
    load()
  }

  async function deleteReminder(id: string) {
    await supabase.from('reminders').delete().eq('id', id)
    load()
  }

  const now = new Date()
  const overdue = reminders.filter(r => isBefore(new Date(r.remind_at), now))
  const upcoming = reminders.filter(r => !isBefore(new Date(r.remind_at), now))

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Reminders</h1>
        {overdue.length > 0 && (
          <p className="text-sm text-destructive font-medium">{overdue.length} overdue</p>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : reminders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-4xl mb-3">🔔</div>
          <p className="font-medium">No reminders</p>
          <p className="text-sm mt-1">Tap + to create one</p>
        </div>
      ) : (
        <div className="space-y-3">
          {overdue.length > 0 && (
            <>
              <p className="text-xs font-semibold text-destructive uppercase tracking-wider px-1">Overdue</p>
              {overdue.map(r => <ReminderRow key={r.id} reminder={r} onDismiss={() => dismiss(r)} onEdit={() => { setEditing(r); setShowForm(true) }} onDelete={() => deleteReminder(r.id)} overdue />)}
            </>
          )}
          {upcoming.length > 0 && (
            <>
              {overdue.length > 0 && <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 pt-2">Upcoming</p>}
              {upcoming.map(r => <ReminderRow key={r.id} reminder={r} onDismiss={() => dismiss(r)} onEdit={() => { setEditing(r); setShowForm(true) }} onDelete={() => deleteReminder(r.id)} />)}
            </>
          )}
        </div>
      )}

      {user && (
        <Fab onClick={() => { setEditing(undefined); setShowForm(true) }} aria-label="Add reminder">
          <Plus className="h-6 w-6" />
        </Fab>
      )}

      {user && showForm && (
        <ReminderDrawer open={showForm} onClose={() => setShowForm(false)} onSave={load} reminder={editing} userId={user.id} />
      )}
    </div>
  )
}

function ReminderRow({ reminder, onDismiss, onEdit, onDelete, overdue }: {
  reminder: Reminder
  onDismiss: () => void
  onEdit: () => void
  onDelete: () => void
  overdue?: boolean
}) {
  return (
    <div className={cn('flex items-center gap-3 p-4 bg-card border rounded-xl', overdue ? 'border-destructive/30 bg-destructive/5' : 'border-border')}>
      <div className={cn('p-2 rounded-lg', overdue ? 'bg-destructive/10' : 'bg-muted')}>
        {overdue ? <BellOff className="h-4 w-4 text-destructive" /> : <Bell className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{reminder.title}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <span>{formatDateTime(reminder.remind_at)}</span>
          {reminder.repeat && (
            <span className="flex items-center gap-0.5">
              <RefreshCw className="h-3 w-3" />
              {reminder.repeat}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {overdue && (
          <button onClick={onDismiss} className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium">
            Dismiss
          </button>
        )}
        <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground">
          <Pencil className="h-4 w-4" />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
