import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, Crown, Plus, RefreshCw, Search, Swords, Pencil, Target, ScrollText, LayoutGrid, AlertCircle, Check } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { RsCharacter, RsGoal, RsQuest } from '../supabase'
import { Fab } from '../components/ui/fab'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../components/ui/drawer'
import { cn } from '../utils'
import { haptic } from '../lib/haptics'
import { errorMessage, fetchCharacterStats, fetchQuests, type CharacterStats, type QuestStatus } from '../features/runescape/api'
import { formatXp } from '../features/runescape/skills'
import { ACTIVE_CHARACTER_KEY, goalProgress, goalTitle, questKey, questStatusMap } from '../features/runescape/goals'
import { loadQuestCatalogue, refreshQuestCatalogue } from '../features/runescape/quests'
import SkillGrid from '../features/runescape/SkillGrid'
import GoalCard from '../features/runescape/GoalCard'
import GoalDrawer from '../features/runescape/GoalDrawer'
import CharacterDrawer from '../features/runescape/CharacterDrawer'

const DEFAULT_CHARACTER = 'BowlSplit'
const ACTIVE_KEY = ACTIVE_CHARACTER_KEY

type QuestFilter = 'all' | QuestStatus

const STATUS_STYLE: Record<QuestStatus, { label: string; className: string }> = {
  COMPLETED: { label: 'Done', className: 'bg-emerald-100 text-emerald-700' },
  STARTED: { label: 'In progress', className: 'bg-amber-100 text-amber-700' },
  NOT_STARTED: { label: 'Not started', className: 'bg-muted text-muted-foreground' },
}

function readActiveId(): string | null {
  try { return localStorage.getItem(ACTIVE_KEY) } catch { return null }
}

export default function RuneScape() {
  const [user, setUser] = useState<User | null>(null)
  const [characters, setCharacters] = useState<RsCharacter[]>([])
  const [activeId, setActiveId] = useState<string | null>(readActiveId)
  const [loading, setLoading] = useState(true)

  const [stats, setStats] = useState<CharacterStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [questEntries, setQuestEntries] = useState<Map<string, QuestStatus> | null>(null)

  const [catalogue, setCatalogue] = useState<RsQuest[]>([])
  const [goals, setGoals] = useState<RsGoal[]>([])
  const [refreshingQuests, setRefreshingQuests] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const [questSearch, setQuestSearch] = useState('')
  const [questFilter, setQuestFilter] = useState<QuestFilter>('all')

  const [showGoal, setShowGoal] = useState(false)
  const [characterForm, setCharacterForm] = useState<{ character?: RsCharacter } | null>(null)
  const [showSwitcher, setShowSwitcher] = useState(false)
  const autoSeeded = useRef(false)

  // Tab lives in the URL so returning from a quest guide lands back on the same tab.
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = ['overview', 'goals', 'quests'].includes(searchParams.get('tab') ?? '') ? searchParams.get('tab')! : 'overview'

  const active = characters.find(c => c.id === activeId) ?? characters[0] ?? null

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  const loadCharacters = useCallback(async (preferId?: string) => {
    const { data, error } = await supabase.from('rs_characters').select('*').order('created_at')
    if (error) { setLoading(false); return }
    let list = data ?? []
    if (list.length === 0) {
      const { data: u } = await supabase.auth.getUser()
      if (u.user) {
        const res = await supabase.from('rs_characters').insert({ name: DEFAULT_CHARACTER, user_id: u.user.id }).select('*').single()
        if (res.data) list = [res.data]
      }
    }
    setCharacters(list)
    if (preferId) setActiveId(preferId)
    setLoading(false)
  }, [])

  useEffect(() => { loadCharacters() }, [loadCharacters])

  useEffect(() => {
    if (!active) return
    try { localStorage.setItem(ACTIVE_KEY, active.id) } catch { /* storage unavailable */ }
  }, [active])

  const loadGoals = useCallback(async () => {
    if (!active) return
    const { data } = await supabase.from('rs_goals').select('*').eq('character_id', active.id).order('created_at', { ascending: false })
    setGoals(data ?? [])
  }, [active])

  useEffect(() => { loadGoals() }, [loadGoals])

  const loadCatalogue = useCallback(async () => {
    try { setCatalogue(await loadQuestCatalogue()) } catch { /* shown as an empty list */ }
  }, [])

  useEffect(() => { loadCatalogue() }, [loadCatalogue])

  const loadStats = useCallback(async (signal?: AbortSignal) => {
    if (!active) return
    setStatsLoading(true)
    setStatsError(null)
    const name = active.name
    const [statsRes, questsRes] = await Promise.allSettled([fetchCharacterStats(name, signal), fetchQuests(name, signal)])
    if (signal?.aborted) return
    if (statsRes.status === 'fulfilled') setStats(statsRes.value)
    else { setStats(null); setStatsError(errorMessage(statsRes.reason)) }
    setQuestEntries(questsRes.status === 'fulfilled' ? questStatusMap(questsRes.value) : null)
    setStatsLoading(false)
  }, [active])

  useEffect(() => {
    const controller = new AbortController()
    loadStats(controller.signal)
    return () => controller.abort()
  }, [loadStats])

  const refreshQuests = useCallback(async (silent = false) => {
    if (!active) return
    setRefreshingQuests(true)
    try {
      const { added, total } = await refreshQuestCatalogue(active.name, catalogue)
      await loadCatalogue()
      if (!silent) setNotice(added > 0 ? `${added} new quest${added === 1 ? '' : 's'} added (${total} total).` : `Quest list is up to date (${total} quests).`)
    } catch (err) {
      if (!silent) setNotice(errorMessage(err))
    }
    setRefreshingQuests(false)
  }, [active, catalogue, loadCatalogue])

  // First visit: seed the shared quest catalogue automatically, once.
  useEffect(() => {
    if (autoSeeded.current || !active || catalogue.length > 0 || loading) return
    autoSeeded.current = true
    refreshQuests(true)
  }, [active, catalogue.length, loading, refreshQuests])

  const questsById = useMemo(() => new Map(catalogue.map(q => [q.id, q])), [catalogue])

  const goalRows = useMemo(
    () => goals.map(goal => ({
      goal,
      title: goalTitle(goal, questsById),
      progress: goalProgress(goal, stats, questsById, questEntries),
    })),
    [goals, stats, questsById, questEntries],
  )
  const activeGoals = goalRows.filter(r => !r.progress.done)
  const doneGoals = goalRows.filter(r => r.progress.done)

  const takenQuestIds = useMemo(() => new Set(goals.map(g => g.quest_id).filter((id): id is string => !!id)), [goals])

  const visibleQuests = useMemo(() => {
    const term = questSearch.trim().toLowerCase()
    return catalogue
      .map(q => ({ quest: q, status: questEntries?.get(questKey(q.name)) ?? null }))
      .filter(r => !term || r.quest.name.toLowerCase().includes(term))
      .filter(r => questFilter === 'all' || (r.status ?? 'NOT_STARTED') === questFilter)
  }, [catalogue, questEntries, questSearch, questFilter])

  const completedQuestCount = questEntries ? [...questEntries.values()].filter(s => s === 'COMPLETED').length : null

  async function toggleGoal(goal: RsGoal) {
    haptic()
    await supabase.from('rs_goals').update({ completed_at: goal.completed_at ? null : new Date().toISOString() }).eq('id', goal.id)
    loadGoals()
  }

  async function deleteGoal(goal: RsGoal) {
    if (!confirm('Delete this goal?')) return
    await supabase.from('rs_goals').delete().eq('id', goal.id)
    loadGoals()
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4 pb-28">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900 p-5 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-amber-300/90">
              <Swords className="h-3.5 w-3.5" /> RuneScape 3
            </div>
            <button
              onClick={() => (characters.length > 1 ? setShowSwitcher(true) : active && setCharacterForm({ character: active }))}
              className="mt-1 flex items-center gap-1.5 text-left"
            >
              <h1 className="truncate text-3xl font-bold tracking-tight">{active?.name}</h1>
              {characters.length > 1 && <ChevronDown className="h-5 w-5 shrink-0 text-white/60" />}
            </button>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <button
              onClick={() => { haptic(); loadStats() }}
              disabled={statsLoading}
              aria-label="Refresh stats"
              className="rounded-full bg-white/10 p-2.5 backdrop-blur hover:bg-white/20 disabled:opacity-60"
            >
              <RefreshCw className={cn('h-4 w-4', statsLoading && 'animate-spin')} />
            </button>
            <button
              onClick={() => active && setCharacterForm({ character: active })}
              aria-label="Edit character"
              className="rounded-full bg-white/10 p-2.5 backdrop-blur hover:bg-white/20"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCharacterForm({})}
              aria-label="Add character"
              className="rounded-full bg-white/10 p-2.5 backdrop-blur hover:bg-white/20"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <HeroStat label="Total level" value={stats ? stats.totalLevel.toLocaleString('en-US') : '—'} icon={<Crown className="h-3.5 w-3.5" />} />
          <HeroStat label="Total XP" value={stats ? formatXp(stats.totalXp) : '—'} />
          <HeroStat label="Combat" value={stats?.combatLevel ? String(stats.combatLevel) : '—'} />
          <HeroStat label="Quests done" value={completedQuestCount !== null ? String(completedQuestCount) : stats?.questsComplete != null ? String(stats.questsComplete) : '—'} />
        </div>
      </section>

      {notice && (
        <button onClick={() => setNotice(null)} className="flex w-full items-start gap-2 rounded-xl bg-muted px-3.5 py-2.5 text-left text-sm animate-in fade-in-0">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> <span>{notice}</span>
        </button>
      )}

      <Tabs value={tab} onValueChange={t => setSearchParams(t === 'overview' ? {} : { tab: t }, { replace: true })}>
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="overview" className="gap-1.5 py-2"><LayoutGrid className="h-4 w-4" />Overview</TabsTrigger>
          <TabsTrigger value="goals" className="gap-1.5 py-2">
            <Target className="h-4 w-4" />Goals
            {activeGoals.length > 0 && <span className="rounded-full bg-primary/10 px-1.5 text-xs text-primary">{activeGoals.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="quests" className="gap-1.5 py-2"><ScrollText className="h-4 w-4" />Quests</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-5">
          {statsLoading && !stats ? (
            <SkillSkeleton />
          ) : statsError ? (
            <div className="flex gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div className="space-y-2">
                <p>{statsError}</p>
                <Button size="sm" variant="outline" onClick={() => loadStats()}>Try again</Button>
              </div>
            </div>
          ) : stats && (
            <>
              {stats.source === 'hiscores' && (
                <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
                  Showing public hiscores only. Enable "Show RuneMetrics profile" in your RuneScape settings to unlock combat level, quest progress and recent activity.
                </p>
              )}
              <SkillGrid stats={stats} />
              {stats.activities.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-sm font-semibold text-muted-foreground">Recent activity</h2>
                  <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
                    {stats.activities.slice(0, 8).map((a, i) => (
                      <li key={i} className="px-3.5 py-2.5">
                        <div className="text-sm font-medium">{a.text}</div>
                        {a.details && <div className="text-xs text-muted-foreground">{a.details}</div>}
                        <div className="mt-0.5 text-[11px] text-muted-foreground/80">{a.date}</div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="goals" className="mt-4 space-y-5">
          {goalRows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-14 text-center">
              <Target className="h-8 w-8 text-muted-foreground/60" />
              <p className="font-medium">No goals yet</p>
              <p className="text-sm text-muted-foreground">Set a skill, quest or free-form goal.</p>
              <Button className="mt-2 rounded-xl" onClick={() => setShowGoal(true)}><Plus className="h-4 w-4" />New goal</Button>
            </div>
          ) : (
            <>
              <div className="space-y-2.5">
                {activeGoals.map(r => (
                  <GoalCard key={r.goal.id} goal={r.goal} title={r.title} progress={r.progress} onToggleComplete={() => toggleGoal(r.goal)} onDelete={() => deleteGoal(r.goal)} />
                ))}
              </div>
              {doneGoals.length > 0 && (
                <section className="space-y-2.5">
                  <h2 className="text-sm font-semibold text-muted-foreground">Completed · {doneGoals.length}</h2>
                  {doneGoals.map(r => (
                    <GoalCard key={r.goal.id} goal={r.goal} title={r.title} progress={r.progress} onToggleComplete={() => toggleGoal(r.goal)} onDelete={() => deleteGoal(r.goal)} />
                  ))}
                </section>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="quests" className="mt-4 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search quests" value={questSearch} onChange={e => setQuestSearch(e.target.value)} />
            </div>
            <Button variant="outline" size="icon" onClick={() => refreshQuests()} disabled={refreshingQuests} aria-label="Refresh quest list">
              <RefreshCw className={cn('h-4 w-4', refreshingQuests && 'animate-spin')} />
            </Button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            {(['all', 'COMPLETED', 'STARTED', 'NOT_STARTED'] as QuestFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setQuestFilter(f)}
                className={cn('shrink-0 rounded-full border px-3 py-1 text-xs font-medium', questFilter === f ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground')}
              >
                {f === 'all' ? 'All' : STATUS_STYLE[f].label}
              </button>
            ))}
          </div>
          {!questEntries && catalogue.length > 0 && (
            <p className="text-xs text-muted-foreground">Quest status needs a public RuneMetrics profile. Showing the quest list only.</p>
          )}
          {catalogue.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              {refreshingQuests ? 'Loading quests…' : 'No quests loaded yet. Tap refresh to fetch the list.'}
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
              {visibleQuests.map(({ quest, status }) => (
                <li key={quest.id}>
                  <Link to={`/runescape/quests/${encodeURIComponent(quest.name)}`} className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-accent/50">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{quest.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {[quest.difficulty, quest.quest_points != null ? `${quest.quest_points} QP` : null, quest.members === false ? 'F2P' : null].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {status && (
                        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_STYLE[status].className)}>
                          {STATUS_STYLE[status].label}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                    </div>
                  </Link>
                </li>
              ))}
              {visibleQuests.length === 0 && <li className="px-3.5 py-6 text-center text-sm text-muted-foreground">No matching quests.</li>}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <Fab onClick={() => { haptic(); setShowGoal(true) }} aria-label="New goal"><Plus className="h-6 w-6" /></Fab>

      {user && active && (
        <GoalDrawer
          open={showGoal}
          onClose={() => setShowGoal(false)}
          onSaved={loadGoals}
          userId={user.id}
          characterId={active.id}
          quests={catalogue}
          questStatus={questEntries}
          takenQuestIds={takenQuestIds}
          onRefreshQuests={() => refreshQuests()}
          refreshingQuests={refreshingQuests}
        />
      )}

      {user && (
        <CharacterDrawer
          open={!!characterForm}
          onClose={() => setCharacterForm(null)}
          onSaved={id => loadCharacters(id)}
          userId={user.id}
          character={characterForm?.character}
          canDelete={characters.length > 1}
        />
      )}

      <Drawer open={showSwitcher} onOpenChange={setShowSwitcher}>
        <DrawerContent>
          <DrawerHeader><DrawerTitle>Switch character</DrawerTitle></DrawerHeader>
          <DrawerBody className="space-y-1.5">
            {characters.map(c => (
              <button
                key={c.id}
                onClick={() => { setActiveId(c.id); setShowSwitcher(false) }}
                className={cn('flex w-full items-center justify-between rounded-xl px-4 py-3 text-left font-medium hover:bg-accent', c.id === active?.id && 'bg-accent')}
              >
                {c.name}
                {c.id === active?.id && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

function HeroStat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/10 px-3 py-2.5 backdrop-blur">
      <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-white/60">{icon}{label}</div>
      <div className="mt-0.5 truncate text-lg font-bold tabular-nums">{value}</div>
    </div>
  )
}

function SkillSkeleton() {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
      {Array.from({ length: 12 }).map((_, i) => <div key={i} className="h-[112px] animate-pulse rounded-2xl bg-muted" />)}
    </div>
  )
}
