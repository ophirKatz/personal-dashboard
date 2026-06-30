import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, ExternalLink, Link2, MapPin } from 'lucide-react'
import { supabase } from '../supabase'
import type { CalendarEvent } from '../supabase'
import type { User } from '@supabase/supabase-js'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { today } from '../utils'
import { format, parseISO, isToday, isTomorrow } from 'date-fns'
import { refreshGoogleCalendarEvents } from '../features/calendar/googleCalendar'
import { connectGoogle, isGoogleConnected } from '../lib/googleAuth'
import { listGoogleAccounts, accountBadge, type GoogleAccount } from '../lib/googleAccounts'
import MonthCalendar from '../features/calendar/MonthCalendar'
import { Link } from 'react-router-dom'

function EventForm({ open, onClose, onSave, event, userId }: {
  open: boolean; onClose: () => void; onSave: () => void; event?: CalendarEvent; userId: string
}) {
  const [title, setTitle] = useState(event?.title ?? '')
  const [eventDate, setEventDate] = useState(event?.event_date ?? today())
  const [eventTime, setEventTime] = useState(event?.event_time ?? '')
  const [endTime, setEndTime] = useState(event?.event_end_time ?? '')
  const [location, setLocation] = useState(event?.location ?? '')
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
      event_end_date: endTime ? eventDate : null,
      event_end_time: endTime || null,
      location: location.trim() || null,
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2 min-w-0">
                <Label>Date</Label>
                <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className="min-w-0" />
              </div>
              <div className="space-y-2 min-w-0">
                <Label>Start time (optional)</Label>
                <Input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} className="min-w-0" />
              </div>
              <div className="space-y-2 min-w-0">
                <Label>End time (optional)</Label>
                <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="min-w-0" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Optional location…" />
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
  const [accounts, setAccounts] = useState<Map<string, GoogleAccount>>(new Map())
  const [googleConnected, setGoogleConnected] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<CalendarEvent | undefined>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  async function load() {
    const [eventsRes, connected, googleAccounts] = await Promise.all([
      supabase.from('events').select('*').gte('event_date', today()).order('event_date').order('event_time'),
      isGoogleConnected(),
      listGoogleAccounts(),
    ])
    setEvents(eventsRes.data ?? [])
    setGoogleConnected(connected)
    setAccounts(new Map(googleAccounts.map(a => [a.id, a])))
    setLoading(false)
  }

  useEffect(() => {
    load().then(() => {
      refreshGoogleCalendarEvents().then(load)
    })
  }, [])

  async function deleteEvent(id: string) {
    await supabase.from('events').delete().eq('id', id)
    load()
  }

  function groupByDate(allEvents: CalendarEvent[]) {
    const groups: Record<string, CalendarEvent[]> = {}
    allEvents.forEach(e => {
      groups[e.event_date] = [...(groups[e.event_date] ?? []), e]
    })
    Object.values(groups).forEach(items =>
      items.sort((a, b) => (a.event_time ?? '99:99:99').localeCompare(b.event_time ?? '99:99:99'))
    )
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }

  function dateLabel(dateStr: string) {
    const d = parseISO(dateStr)
    if (isToday(d)) return 'Today'
    if (isTomorrow(d)) return 'Tomorrow'
    return format(d, 'EEEE, MMMM d')
  }

  function formatDuration(minutes: number) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    if (h === 0) return `${m}m`
    if (m === 0) return `${h}h`
    return `${h}h ${m}m`
  }

  function eventTimeInfo(event: CalendarEvent) {
    if (!event.event_time) return null
    const start = new Date(`2000-01-01T${event.event_time}`)
    if (!event.event_end_time) return { start: format(start, 'h:mm a'), end: null, duration: null }
    const dayOffset = event.event_end_date && event.event_end_date !== event.event_date ? 1 : 0
    const end = new Date(`2000-01-0${1 + dayOffset}T${event.event_end_time}`)
    const minutes = Math.round((end.getTime() - start.getTime()) / 60_000)
    return {
      start: format(start, 'h:mm a'),
      end: minutes > 0 ? format(end, 'h:mm a') : null,
      duration: minutes > 0 ? formatDuration(minutes) : null,
    }
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <Button onClick={() => { setEditing(undefined); setShowForm(true) }} size="icon" className="rounded-xl h-11 w-11">
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {!loading && !googleConnected && (
        <button
          onClick={connectGoogle}
          className="w-full flex items-center justify-center gap-2 mb-6 p-3 rounded-xl border border-dashed border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
        >
          <Link2 className="h-4 w-4" />
          Connect Google Calendar
        </button>
      )}

      {!loading && googleConnected && (
        <Link
          to="/settings"
          className="flex items-center gap-1.5 mb-6 px-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Link2 className="h-3.5 w-3.5" />
          Manage connected Google accounts
        </Link>
      )}

      <Tabs defaultValue="list">
        <TabsList className="mb-6">
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="month">Month</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
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
                        {event.event_time && (() => {
                          const info = eventTimeInfo(event)!
                          return (
                            <div className="text-xs font-medium text-muted-foreground pt-0.5 w-16 shrink-0">
                              <div>{info.start}</div>
                              {info.end && <div className="text-[10px] font-normal text-muted-foreground/70 mt-0.5">– {info.end}</div>}
                              {info.duration && <div className="text-[10px] font-normal text-muted-foreground/70">{info.duration}</div>}
                            </div>
                          )
                        })()}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium truncate">{event.title}</p>
                            {event.source === 'google' && (() => {
                              const badge = accountBadge(event.google_account_id, accounts)
                              return (
                                <span
                                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 inline-flex items-center gap-1 max-w-[9rem]"
                                  style={{ backgroundColor: `${badge.color}1a`, color: badge.color }}
                                  title={badge.email}
                                >
                                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: badge.color }} />
                                  <span className="truncate">{accounts.size > 1 ? badge.email.split('@')[0] : 'Google'}</span>
                                </span>
                              )
                            })()}
                          </div>
                          {event.location && (
                            <p className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5 truncate">
                              <MapPin className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{event.location}</span>
                            </p>
                          )}
                          {event.notes && <p className="text-sm text-muted-foreground mt-0.5 truncate">{event.notes}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          {event.source === 'local' ? (
                            <>
                              <button onClick={() => { setEditing(event); setShowForm(true) }} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground">
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button onClick={() => deleteEvent(event.id)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            event.html_link && (
                              <a href={event.html_link} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="month">
          <MonthCalendar />
        </TabsContent>
      </Tabs>

      {user && showForm && (
        <EventForm open={showForm} onClose={() => setShowForm(false)} onSave={load} event={editing} userId={user.id} />
      )}
    </div>
  )
}
