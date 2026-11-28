import { useCallback, useEffect, useRef, useState } from 'react'
import { startOfDay, subDays } from 'date-fns'
import { supabase } from '../../supabase'
import { newEventId, newestFirst, upsertEvent, type BabyEvent, type EventDraft } from './babyEvents'
import {
  errorMessage,
  insertEvent,
  isDuplicateId,
  isTimerConflict,
  loadEvents,
  loadRunningEvents,
  updateEvent,
  type EventPatch,
} from './babyApi'

export type SaveResult =
  | { ok: true; event: BabyEvent }
  /** Another phone already has a timer of this kind running. */
  | { ok: false; reason: 'timer_running' }
  | { ok: false; reason: 'failed'; message: string }

export type LoadStatus = 'loading' | 'ready' | 'error'

const POLL_MS = 45_000

/**
 * A baby's log for the last `windowDays` days (plus any timer still running), kept in step with the
 * other parent's phone. Changes made here show at once and are rolled back if the save fails.
 *
 * Staying in sync matters more than anything else in this feature, so it does not rely on one
 * mechanism: live updates over Realtime, a reload whenever the app comes back to the foreground or
 * the network returns, a reload after the live connection drops and recovers, and a slow poll.
 */
export function useBabyEvents(babyId: string, userId: string, windowDays: number) {
  const [events, setEvents] = useState<BabyEvent[]>([])
  const [status, setStatus] = useState<LoadStatus>('loading')
  /** The latest reload failed, so what is shown may be out of date. */
  const [offline, setOffline] = useState(false)

  const eventsRef = useRef(events)
  eventsRef.current = events
  const alive = useRef(true)
  // Our own writes that haven't been confirmed yet, keyed by entry id. A reload or a live update
  // that races with one must not undo it.
  const pending = useRef(new Map<string, BabyEvent>())

  const refresh = useCallback(async () => {
    try {
      const since = startOfDay(subDays(new Date(), windowDays)).toISOString()
      const [recent, running] = await Promise.all([loadEvents(babyId, since), loadRunningEvents(babyId)])
      if (!alive.current) return
      let merged = newestFirst([...new Map([...recent, ...running].map(e => [e.id, e])).values()])
      for (const mine of pending.current.values()) merged = upsertEvent(merged, mine)
      setEvents(merged)
      setStatus('ready')
      setOffline(false)
    } catch {
      if (!alive.current) return
      setStatus(s => (s === 'loading' ? 'error' : s))
      setOffline(true)
    }
  }, [babyId, windowDays])

  // The subscription outlives a change of history window, so it calls the latest refresh through this.
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  useEffect(() => {
    alive.current = true
    refresh()
    return () => {
      alive.current = false
    }
  }, [refresh])

  // Live updates from the other phone.
  useEffect(() => {
    let connectedBefore = false
    const channel = supabase
      .channel(`baby-events-${babyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'baby_events', filter: `baby_id=eq.${babyId}` },
        payload => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id?: string }).id
            if (id) setEvents(prev => prev.filter(e => e.id !== id))
            return
          }
          const row = payload.new as Partial<BabyEvent>
          if (!row?.id || pending.current.has(row.id)) return
          // Columns the database leaves out of an update (unchanged large values) keep what we have.
          setEvents(prev => {
            const old = prev.find(e => e.id === row.id)
            return upsertEvent(prev, { ...old, ...row } as BabyEvent)
          })
        },
      )
      .subscribe(state => {
        if (state !== 'SUBSCRIBED') return
        // Anything that happened while the connection was down is missed by the stream.
        if (connectedBefore) refreshRef.current()
        connectedBefore = true
      })
    return () => {
      supabase.removeChannel(channel)
    }
  }, [babyId])

  // Back in the foreground, back online, or just time passing: ask again.
  useEffect(() => {
    const reload = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    const timer = window.setInterval(reload, POLL_MS)
    document.addEventListener('visibilitychange', reload)
    window.addEventListener('online', reload)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', reload)
      window.removeEventListener('online', reload)
    }
  }, [refresh])

  const add = useCallback(
    async (draft: EventDraft): Promise<SaveResult> => {
      const now = new Date().toISOString()
      const optimistic: BabyEvent = {
        ...draft,
        id: newEventId(),
        baby_id: babyId,
        logged_by: userId,
        updated_by: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      }
      pending.current.set(optimistic.id, optimistic)
      setEvents(prev => upsertEvent(prev, optimistic))
      try {
        const saved = await insertEvent(optimistic)
        pending.current.delete(optimistic.id)
        setEvents(prev => upsertEvent(prev, saved))
        return { ok: true, event: saved }
      } catch (error) {
        pending.current.delete(optimistic.id)
        if (isDuplicateId(error)) {
          refresh()
          return { ok: true, event: optimistic }
        }
        setEvents(prev => prev.filter(e => e.id !== optimistic.id))
        if (isTimerConflict(error)) {
          refresh()
          return { ok: false, reason: 'timer_running' }
        }
        return { ok: false, reason: 'failed', message: errorMessage(error) }
      }
    },
    [babyId, userId, refresh],
  )

  /** Changes an entry. `base` is for an entry that is no longer in the list (undoing a removal). */
  const change = useCallback(
    async (id: string, patch: EventPatch, base?: BabyEvent): Promise<SaveResult> => {
      const current = base ?? eventsRef.current.find(e => e.id === id)
      if (!current) return { ok: false, reason: 'failed', message: 'That entry is no longer there.' }
      const optimistic: BabyEvent = { ...current, ...patch, updated_at: new Date().toISOString() }
      pending.current.set(id, optimistic)
      setEvents(prev => upsertEvent(prev, optimistic))
      try {
        const saved = await updateEvent(id, patch)
        pending.current.delete(id)
        setEvents(prev => upsertEvent(prev, saved))
        return { ok: true, event: saved }
      } catch (error) {
        pending.current.delete(id)
        setEvents(prev => upsertEvent(prev, current))
        refresh()
        return { ok: false, reason: 'failed', message: errorMessage(error) }
      }
    },
    [refresh],
  )

  const update = useCallback((id: string, patch: EventPatch) => change(id, patch), [change])

  /** Removes an entry from the log (it is kept, marked deleted, so it can be brought back). */
  const remove = useCallback(
    (event: BabyEvent) => change(event.id, { deleted_at: new Date().toISOString() }, event),
    [change],
  )

  const restore = useCallback(
    (event: BabyEvent) => change(event.id, { deleted_at: null }, { ...event, deleted_at: new Date().toISOString() }),
    [change],
  )

  return { events, status, offline, refresh, add, update, remove, restore }
}
