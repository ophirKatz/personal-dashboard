import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../supabase'
import type { CalendarEvent } from '../supabase'
import type { User } from '@supabase/supabase-js'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../components/ui/dialog'
import { today, formatDate } from '../utils'
import { format, parseISO, isToday, isTomorrow } from 'date-fns'

function EventForm({ open, onClose, onSave, event, userId }: {
  open: boolean; onClose: () => void; onSave: () => void; event?: CalendarEvent; userId: string
}) {
  const [title, setTitle] = useState(event?.title ?? '')
  const [eventDate, setEventDate] = useState(event?.event_date ?? today())
  const [eventTime, setEventTime] = useState(event?.event_time ?? '')
  const [notes, setNotes] = useState(event?.notes ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    const payload = {
      title: title.trim(),
      event_date: eventDate,
      event_time: eventTime || null,
      notes: notes.trim() || null,
      user_id: userId,
    }
    if (event) {
      await supabase.from('events').update(payload).eq('id', event.id)
    } else {
      await supabase.from('events').insert(payload)
    }
    setSaving(false)
    onSave()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{event ? 'Edit Event' : 'New Event'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Event name" autoFocus />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 min-w-0">
                <Label>Date</Label>
                <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className="min-w-0" />
              </div>
              <div className="space-y-2 min-w-0">
                <Label>Time (optional)</Label>
                <Input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} className="min-w-0" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes…" rows={3} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || !title.trim()}>{saving ? 'Saving…' : event ? 'Save' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function Calendar() {
  const [user, setUser] = useState<User | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<CalendarEvent | undefined>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  async function load() {
    const { data } = await supabase.from('events').select('*').gte('event_date', today()).order('event_date').order('event_time')
    setEvents(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function deleteEvent(id: string) {
    await supabase.from('events').delete().eq('id', id)
    load()
  }

  function groupByDate(events: CalendarEvent[]) {
    const groups: Record<string, CalendarEvent[]> = {}
    events.forEach(e => {
      groups[e.event_date] = [...(groups[e.event_date] ?? []), e]
    })
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }

  function dateLabel(dateStr: string) {
    const d = parseISO(dateStr)
    if (isToday(d)) return 'Today'
    if (isTomorrow(d)) return 'Tomorrow'
    return format(d, 'EEEE, MMMM d')
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <Button onClick={() => { setEditing(undefined); setShowForm(true) }} size="icon" className="rounded-xl h-11 w-11">
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-4xl mb-3">📅</div>
          <p className="font-medium">No upcoming events</p>
          <p className="text-sm mt-1">Tap + to add one</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupByDate(events).map(([date, dateEvents]) => (
            <div key={date}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                {dateLabel(date)}
              </h2>
              <div className="space-y-2">
                {dateEvents.map(event => (
                  <div key={event.id} className="flex items-start gap-3 p-4 bg-card border border-border rounded-xl">
                    {event.event_time && (
                      <div className="text-xs font-medium text-muted-foreground pt-0.5 w-12 shrink-0">
                        {format(new Date(`2000-01-01T${event.event_time}`), 'h:mm a')}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{event.title}</p>
                      {event.notes && <p className="text-sm text-muted-foreground mt-0.5 truncate">{event.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditing(event); setShowForm(true) }} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => deleteEvent(event.id)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {user && showForm && (
        <EventForm open={showForm} onClose={() => setShowForm(false)} onSave={load} event={editing} userId={user.id} />
      )}
    </div>
  )
}
