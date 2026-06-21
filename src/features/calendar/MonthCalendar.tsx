import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, isToday, addMonths, parseISO } from 'date-fns'
import { supabase } from '../../supabase'
import type { CalendarEvent } from '../../supabase'
import { fetchGoogleCalendarEvents } from './googleCalendar'
import type { GoogleCalendarEvent } from './googleCalendar'
import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '../../components/ui/dialog'
import { cn, formatTime } from '../../utils'

type MergedEvent =
  | { source: 'local'; event: CalendarEvent }
  | { source: 'google'; event: GoogleCalendarEvent }

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function MonthCalendar() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [localEvents, setLocalEvents] = useState<CalendarEvent[]>([])
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    fetchGoogleCalendarEvents(90).then(res => setGoogleEvents(res.events))
  }, [])

  useEffect(() => {
    const start = format(month, 'yyyy-MM-dd')
    const end = format(endOfMonth(month), 'yyyy-MM-dd')
    supabase.from('events').select('*').gte('event_date', start).lte('event_date', end)
      .then(({ data }) => setLocalEvents(data ?? []))
  }, [month])

  const eventsByDate = useMemo(() => {
    const map: Record<string, MergedEvent[]> = {}
    localEvents.forEach(event => {
      map[event.event_date] = [...(map[event.event_date] ?? []), { source: 'local', event }]
    })
    googleEvents.forEach(event => {
      map[event.event_date] = [...(map[event.event_date] ?? []), { source: 'google', event }]
    })
    Object.values(map).forEach(items =>
      items.sort((a, b) => (a.event.event_time ?? '99:99:99').localeCompare(b.event.event_time ?? '99:99:99'))
    )
    return map
  }, [localEvents, googleEvents])

  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(month))
    const gridEnd = endOfWeek(endOfMonth(month))
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [month])

  const selectedEvents = selectedDate ? eventsByDate[selectedDate] ?? [] : []

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={() => setMonth(m => addMonths(m, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-sm font-semibold">{format(month, 'MMMM yyyy')}</h2>
        <Button variant="ghost" size="icon" onClick={() => setMonth(m => addMonths(m, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_LABELS.map((d, i) => (
          <div key={i} className="text-center text-[11px] font-medium text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const dayEvents = eventsByDate[dateStr] ?? []
          const inMonth = isSameMonth(day, month)
          const isCurrentDay = isToday(day)
          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(dateStr)}
              className={cn(
                'aspect-square flex flex-col items-center justify-center gap-1 rounded-xl text-sm transition-colors hover:bg-accent',
                !inMonth && 'text-muted-foreground/40',
              )}
            >
              <span className={cn('flex items-center justify-center h-7 w-7 rounded-full', isCurrentDay && 'bg-primary text-primary-foreground font-semibold')}>
                {format(day, 'd')}
              </span>
              <span className="flex gap-0.5 h-1.5">
                {dayEvents.slice(0, 3).map((e, i) => (
                  <span key={i} className={cn('h-1.5 w-1.5 rounded-full', e.source === 'google' ? 'bg-blue-500' : 'bg-primary')} />
                ))}
              </span>
            </button>
          )
        })}
      </div>

      <Dialog open={!!selectedDate} onOpenChange={open => !open && setSelectedDate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedDate && format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-2">
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events on this day.</p>
            ) : (
              selectedEvents.map(({ source, event }) => (
                <div key={`${source}-${event.id}`} className="p-3 rounded-xl border border-border bg-card">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium">{event.title}</p>
                    {source === 'google' && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 shrink-0">Google</span>
                    )}
                  </div>
                  {event.event_time && (
                    <p className="text-xs text-muted-foreground mt-0.5">{formatTime(event.event_time)}</p>
                  )}
                  {event.notes && <p className="text-sm text-muted-foreground mt-1">{event.notes}</p>}
                  {source === 'google' && (
                    <a href={event.htmlLink} target="_blank" rel="noreferrer" className="text-xs text-primary mt-1 inline-block hover:underline">
                      Open in Google Calendar
                    </a>
                  )}
                </div>
              ))
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  )
}
