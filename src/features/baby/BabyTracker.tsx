import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { WifiOff } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { haptic } from '../../lib/haptics'
import { loadMembers, type MyBaby } from './babyApi'
import { describeEvent, startMs, type Baby, type BabyEvent, type BabyMember, type EventDraft } from './babyEvents'
import EventDrawer, { type DrawerTarget } from './EventDrawer'
import { feedDefaults, type FormTarget } from './eventForm'
import FamilyTab from './FamilyTab'
import HistoryTab from './HistoryTab'
import LogTab from './LogTab'
import { useBabyEvents, type SaveResult } from './useBabyEvents'
import { useNow } from './useNow'

const TABS = ['log', 'history', 'family'] as const
type Tab = (typeof TABS)[number]

const DAYS_PER_PAGE = 7
const TOAST_MS = 6000

type Toast = { message: string; undo?: () => void }

function failureText(result: Extract<SaveResult, { ok: false }>): string {
  return result.reason === 'timer_running'
    ? 'A timer of that kind is already running, probably started on the other phone. It is shown now.'
    : result.message
}

type Props = {
  me: MyBaby
  userId: string
  onBabyChanged: (baby: Baby) => void
  /** The signed-in person left this tracker. */
  onLeft: () => void
}

export default function BabyTracker({ me, userId, onBabyChanged, onLeft }: Props) {
  const { baby, role } = me
  const canWrite = role === 'parent'

  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('tab')
  const tab: Tab = TABS.find(t => t === requested) ?? 'log'

  const [windowDays, setWindowDays] = useState(DAYS_PER_PAGE)
  const now = useNow(30_000)
  const { events, status, offline, refresh, add, update, remove, restore } = useBabyEvents(baby.id, userId, windowDays)

  const [members, setMembers] = useState<BabyMember[]>([])
  const reloadMembers = useCallback(() => {
    loadMembers(baby.id).then(setMembers).catch(() => {})
  }, [baby.id])
  useEffect(reloadMembers, [reloadMembers])

  // Everyone who ever logged keeps their name, even after leaving.
  const names = useMemo(() => new Map(members.map(m => [m.user_id, m.display_name])), [members])
  const showAuthor = members.filter(m => !m.removed_at).length > 1

  // The other person may have joined since this screen opened: when an entry turns up from someone
  // we have no name for, or the Family tab is opened, fetch the member list again. Each unknown
  // person is only asked about once, so someone who can't be named doesn't cause a loop.
  const askedAbout = useRef(new Set<string>())
  useEffect(() => {
    const stranger = events.find(e => e.logged_by && !names.has(e.logged_by) && !askedAbout.current.has(e.logged_by))
    if (!stranger?.logged_by) return
    askedAbout.current.add(stranger.logged_by)
    reloadMembers()
  }, [events, names, reloadMembers])
  useEffect(() => {
    if (tab === 'family') reloadMembers()
  }, [tab, reloadMembers])
  const defaults = useMemo(() => feedDefaults(events), [events])

  const [target, setTarget] = useState<DrawerTarget | null>(null)
  const openDrawer = (t: FormTarget) => setTarget({ ...t, key: Date.now() })

  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimer = useRef<number>()
  const notify = useCallback((next: Toast) => {
    window.clearTimeout(toastTimer.current)
    setToast(next)
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_MS)
  }, [])
  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  /** Removes an entry and offers to bring it back. */
  const removeWithUndo = useCallback(
    async (event: BabyEvent) => {
      const result = await remove(event)
      if (!result.ok) {
        notify({ message: failureText(result) })
        return
      }
      notify({
        message: `${describeEvent(event, Date.now()).title} removed`,
        undo: async () => {
          setToast(null)
          const back = await restore(event)
          if (!back.ok) notify({ message: failureText(back) })
        },
      })
    },
    [remove, restore, notify],
  )

  async function save(draft: EventDraft, existing: BabyEvent | null): Promise<string | null> {
    if (existing) {
      const result = await update(existing.id, draft)
      return result.ok ? null : failureText(result)
    }
    const result = await add(draft)
    if (!result.ok) return failureText(result)
    const saved = result.event
    notify({
      message: draft.in_progress ? `${describeEvent(saved, Date.now()).title} timer started` : `${describeEvent(saved, Date.now()).title} logged`,
      undo: () => {
        setToast(null)
        removeWithUndo(saved)
      },
    })
    return null
  }

  async function startSleep() {
    haptic('medium')
    const result = await add({
      type: 'sleep',
      started_at: new Date().toISOString(),
      ended_at: null,
      in_progress: true,
      details: {},
      note: null,
    })
    if (!result.ok) {
      notify({ message: failureText(result) })
      return
    }
    notify({ message: 'Sleep started', undo: () => { setToast(null); removeWithUndo(result.event) } })
  }

  async function stop(event: BabyEvent) {
    haptic('medium')
    // The other phone's clock may be ahead of this one; an end before the start is not allowed.
    const ended = new Date(Math.max(Date.now(), startMs(event))).toISOString()
    const result = await update(event.id, { in_progress: false, ended_at: ended })
    if (!result.ok) notify({ message: failureText(result) })
  }

  const edit = (event: BabyEvent) => openDrawer({ mode: 'edit', event })

  if (status === 'loading') {
    return (
      <div className="flex justify-center pt-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="mx-auto max-w-xs space-y-3 pt-16 text-center">
        <p className="font-medium">Couldn't load the log</p>
        <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
        <button type="button" onClick={refresh} className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-accent">
          Try again
        </button>
      </div>
    )
  }

  return (
    <>
      {offline && (
        <p role="status" className="mb-4 flex items-start gap-2 rounded-xl bg-amber-100 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
          <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Can't reach the server. This may be out of date, and changes may not be saved.
        </p>
      )}

      <Tabs value={tab} onValueChange={v => setSearchParams({ tab: v }, { replace: true })}>
        <TabsList className="mb-6 w-full">
          <TabsTrigger value="log" className="flex-1">Log</TabsTrigger>
          <TabsTrigger value="history" className="flex-1">History</TabsTrigger>
          <TabsTrigger value="family" className="flex-1">Family</TabsTrigger>
        </TabsList>

        <TabsContent value="log">
          <LogTab
            baby={baby}
            events={events}
            now={now}
            canWrite={canWrite}
            names={names}
            showAuthor={showAuthor}
            onNew={type => openDrawer({ mode: 'create', type })}
            onStartSleep={startSleep}
            onSelect={edit}
            onStop={stop}
          />
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab
            events={events}
            now={now}
            canWrite={canWrite}
            names={names}
            showAuthor={showAuthor}
            windowDays={windowDays}
            onShowEarlier={() => setWindowDays(d => d + DAYS_PER_PAGE)}
            onSelect={edit}
            onStop={stop}
          />
        </TabsContent>
        <TabsContent value="family">
          <FamilyTab
            baby={baby}
            userId={userId}
            role={role}
            members={members}
            now={now}
            onMembersChanged={reloadMembers}
            onBabyChanged={onBabyChanged}
            onLeft={onLeft}
          />
        </TabsContent>
      </Tabs>

      <EventDrawer
        target={target}
        defaults={defaults}
        onClose={() => setTarget(null)}
        onSave={save}
        onDelete={event => {
          setTarget(null)
          removeWithUndo(event)
        }}
      />

      {toast && (
        <div className="fixed inset-x-0 bottom-[calc(var(--tabbar-height,0px)+0.75rem)] z-30 flex justify-center px-4">
          <div role="status" className="flex w-full max-w-md items-center gap-3 rounded-xl border border-border bg-popover px-4 py-3 text-sm shadow-lg">
            <span className="min-w-0 flex-1">{toast.message}</span>
            {toast.undo && (
              <button type="button" onClick={toast.undo} className="shrink-0 font-semibold text-primary">
                Undo
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
