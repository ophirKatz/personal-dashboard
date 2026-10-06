import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, Loader2, RefreshCw } from 'lucide-react'
import type { RsDiaryTask } from '../../supabase'
import { Button } from '../../components/ui/button'
import { cn } from '../../utils'
import { haptic } from '../../lib/haptics'
import { errorMessage } from './api'
import { groupDiaries, loadDiaryProgress, loadDiaryTasks, setTaskDone, syncDiaryCatalogue } from './diaries'

type Props = { userId: string; characterId: string }

export default function DiaryTracker({ userId, characterId }: Props) {
  const [tasks, setTasks] = useState<RsDiaryTask[]>([])
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [missingOnly, setMissingOnly] = useState(true)
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    try {
      const [t, p] = await Promise.all([loadDiaryTasks(), loadDiaryProgress(characterId)])
      setTasks(t)
      setDoneIds(new Set(p.map(r => r.task_id)))
    } catch (err) {
      setMessage(errorMessage(err))
    }
    setLoading(false)
  }, [characterId])

  useEffect(() => { setLoading(true); load() }, [load])

  async function sync() {
    haptic()
    setSyncing(true)
    setMessage(null)
    try {
      const r = await syncDiaryCatalogue(tasks)
      await load()
      const failed = r.failed.length > 0 ? ` Couldn't read: ${r.failed.join(', ')}.` : ''
      setMessage(r.tasks === 0
        ? `No diary tasks found on the wiki.${failed}`
        : `${r.areas} areas, ${r.tasks} tasks (${r.added} new).${failed}`)
    } catch (err) {
      setMessage(errorMessage(err))
    }
    setSyncing(false)
  }

  async function toggle(ids: string[], done: boolean) {
    haptic()
    const prev = doneIds
    setDoneIds(s => {
      const next = new Set(s)
      ids.forEach(id => (done ? next.add(id) : next.delete(id)))
      return next
    })
    try {
      await setTaskDone(userId, characterId, ids, done)
    } catch {
      setDoneIds(prev)
      setMessage('Could not save that change.')
    }
  }

  const groups = useMemo(() => groupDiaries(tasks, doneIds), [tasks, doneIds])
  const totalDone = groups.reduce((a, g) => a + g.done, 0)
  const total = groups.reduce((a, g) => a + g.total, 0)

  if (loading) return <div className="h-24 animate-pulse rounded-2xl bg-muted" />

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {total > 0 ? <><span className="font-semibold text-foreground">{totalDone}</span> / {total} tasks done</> : 'No diary tasks yet'}
        </div>
        <div className="flex gap-2">
          <Button variant={missingOnly ? 'default' : 'outline'} size="sm" className="rounded-xl" onClick={() => setMissingOnly(m => !m)}>
            Missing only
          </Button>
          <Button variant="outline" size="icon" onClick={sync} disabled={syncing} aria-label="Sync diary tasks from the wiki">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {message && (
        <button onClick={() => setMessage(null)} className="flex w-full items-start gap-2 rounded-xl bg-muted px-3.5 py-2.5 text-left text-sm">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> <span>{message}</span>
        </button>
      )}

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-12 text-center">
          <p className="font-medium">No diaries loaded</p>
          <p className="text-sm text-muted-foreground">Fetch the task lists from the RuneScape Wiki.</p>
          <Button className="mt-2 rounded-xl" onClick={sync} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Load diaries
          </Button>
        </div>
      ) : groups.map(g => {
        const isOpen = open[g.area] ?? false
        const complete = g.done === g.total
        return (
          <section key={g.area} className="overflow-hidden rounded-2xl border border-border bg-card">
            <button
              onClick={() => { haptic(); setOpen(o => ({ ...o, [g.area]: !isOpen })) }}
              aria-expanded={isOpen}
              className="w-full px-3.5 py-3 text-left"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{g.area}</span>
                <span className="flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
                  {complete ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">Complete</span> : `${g.total - g.done} missing`}
                  <ChevronDown className={cn('h-4 w-4 transition-transform', !isOpen && '-rotate-90')} />
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className={cn('h-full rounded-full transition-all', complete ? 'bg-emerald-500' : 'bg-primary')} style={{ width: `${(g.done / g.total) * 100}%` }} />
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">{g.done}/{g.total}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {g.tiers.map(t => {
                  const d = t.tasks.filter(x => doneIds.has(x.id)).length
                  return (
                    <span key={t.tier} className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', d === t.tasks.length ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground')}>
                      {t.tier} {d}/{t.tasks.length}
                    </span>
                  )
                })}
              </div>
            </button>
            {isOpen && (
              <div className="divide-y divide-border border-t border-border">
                {g.tiers.map(t => {
                  const shown = missingOnly ? t.tasks.filter(x => !doneIds.has(x.id)) : t.tasks
                  const allDone = t.tasks.every(x => doneIds.has(x.id))
                  if (shown.length === 0) return null
                  return (
                    <div key={t.tier}>
                      <div className="flex items-center justify-between bg-muted/40 px-3.5 py-1.5">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.tier}</span>
                        <button
                          className="text-xs font-medium text-primary"
                          onClick={() => toggle(t.tasks.map(x => x.id), !allDone)}
                        >
                          {allDone ? 'Clear all' : 'Mark all done'}
                        </button>
                      </div>
                      <ul className="divide-y divide-border">
                        {shown.map(task => {
                          const done = doneIds.has(task.id)
                          return (
                            <li key={task.id}>
                              <button onClick={() => toggle([task.id], !done)} className="flex w-full items-start gap-3 px-3.5 py-2.5 text-left hover:bg-accent/50">
                                <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border', done ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
                                  {done && <Check className="h-3.5 w-3.5" />}
                                </span>
                                <span className={cn('text-sm', done && 'text-muted-foreground line-through')}>{task.name}</span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )
                })}
                {missingOnly && complete && <p className="px-3.5 py-4 text-center text-sm text-muted-foreground">Everything in {g.area} is done.</p>}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
