import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, Crown, Download, Loader2, ListFilter, Plus, RefreshCw, Search, Swords, Pencil, Target, ScrollText, BookOpen, LayoutGrid, AlertCircle, Check } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { RsCharacter, RsGoal, RsQuest } from '../supabase'
import { Fab } from '../components/ui/fab'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../components/ui/drawer'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { cn } from '../utils'
import { haptic } from '../lib/haptics'
import { errorMessage, fetchCharacterStats, formatActivityDate, fetchMiniquestNames, fetchQuests, fetchSagaNames, type CharacterStats, type QuestStatus } from '../features/runescape/api'
import { formatXp } from '../features/runescape/skills'
import { ACTIVE_CHARACTER_KEY, goalProgress, goalTitle, questKey, questStatusMap } from '../features/runescape/goals'
import { loadQuestCatalogue, refreshQuestCatalogue } from '../features/runescape/quests'
import { buildReport, compareRequirements, downloadMarkdown, fetchQuestRequirements, type ReportEntry } from '../features/runescape/report'
import SkillGrid from '../features/runescape/SkillGrid'
import GoalCard, { SortableGoalCard } from '../features/runescape/GoalCard'
import GoalDrawer from '../features/runescape/GoalDrawer'
import CharacterDrawer from '../features/runescape/CharacterDrawer'
import DiaryTracker from '../features/runescape/DiaryTracker'

const DEFAULT_CHARACTER = 'BowlSplit'
const ACTIVE_KEY = ACTIVE_CHARACTER_KEY
const ACTIVITY_PAGE = 8

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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const [refreshingQuests, setRefreshingQuests] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const [questSearch, setQuestSearch] = useState('')
  const [questFilter, setQuestFilter] = useState<QuestFilter>('NOT_STARTED')
  const [miniquestNames, setMiniquestNames] = useState<string[]>([])
  const [sagaNames, setSagaNames] = useState<string[]>([])
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [filterOpen, setFilterOpen] = useState(false)
  const [skillsOpen, setSkillsOpen] = useState(true)
  const [activityCount, setActivityCount] = useState(ACTIVITY_PAGE)

  const [showGoal, setShowGoal] = useState(false)
  const [characterForm, setCharacterForm] = useState<{ character?: RsCharacter } | null>(null)
  const [showSwitcher, setShowSwitcher] = useState(false)
  const autoSeeded = useRef(false)

  // Tab lives in the URL so returning from a quest guide lands back on the same tab.
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = ['overview', 'goals', 'quests', 'diaries'].includes(searchParams.get('tab') ?? '') ? searchParams.get('tab')! : 'overview'

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
    const { data } = await supabase.from('rs_goals').select('*').eq('character_id', active.id).order('sort_order').order('created_at', { ascending: false })
    setGoals(data ?? [])
  }, [active])

  useEffect(() => { loadGoals() }, [loadGoals])

  const loadCatalogue = useCallback(async () => {
    try { setCatalogue(await loadQuestCatalogue()) } catch { /* shown as an empty list */ }
  }, [])

  useEffect(() => { loadCatalogue() }, [loadCatalogue])

  // Miniquests/sagas are optional extras: if the lookups fail their sections just stay empty.
  useEffect(() => {
    fetchMiniquestNames().then(setMiniquestNames).catch(() => { /* section stays empty */ })
    fetchSagaNames().then(setSagaNames).catch(() => { /* section stays empty */ })
  }, [])

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

  // Miniquests and sagas are listed apart from quests, so keep them out of the main list.
  const extraKeys = useMemo(() => new Set([...miniquestNames, ...sagaNames].map(questKey)), [miniquestNames, sagaNames])

  const matches = useCallback((name: string, status: QuestStatus | null, statusKnown: boolean) => {
    const term = questSearch.trim().toLowerCase()
    if (term && !name.toLowerCase().includes(term)) return false
    if (questFilter === 'all' || !statusKnown) return true
    return (status ?? 'NOT_STARTED') === questFilter
  }, [questSearch, questFilter])

  const visibleQuests = useMemo(
    () => catalogue
      .filter(q => !extraKeys.has(questKey(q.name)))
      .map(q => ({ quest: q, status: questEntries?.get(questKey(q.name)) ?? null }))
      .filter(r => matches(r.quest.name, r.status, true)),
    [catalogue, extraKeys, questEntries, matches],
  )

  // Prefer catalogue metadata when the extra is in it; otherwise it's just a name from the wiki.
  // Without a RuneMetrics status for an entry we can't tell if it's done, so the status filter skips it.
  const extraGroups = useMemo(() => {
    const byKey = new Map(catalogue.map(q => [questKey(q.name), q]))
    const build = (names: string[]) => names
      .map(name => {
        const key = questKey(name)
        const known = questEntries?.has(key) ?? false
        return { name, quest: byKey.get(key) ?? null, status: questEntries?.get(key) ?? null, known }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter(r => matches(r.name, r.status, r.known))
    return [
      { id: 'miniquests', label: 'Miniquests', rows: build(miniquestNames) },
      { id: 'sagas', label: 'Sagas', rows: build(sagaNames) },
    ]
  }, [catalogue, questEntries, miniquestNames, sagaNames, matches])

  const completedQuestCount = questEntries ? [...questEntries.values()].filter(s => s === 'COMPLETED').length : null

  async function exportReport() {
    if (!active || !stats || !questEntries || exporting) return
    haptic()
    setExporting(true)
    try {
      const incomplete: ReportEntry[] = catalogue
        .filter(q => !extraKeys.has(questKey(q.name)) && questEntries.get(questKey(q.name)) !== 'COMPLETED')
        .map(q => ({ name: q.name, status: questEntries.get(questKey(q.name)) ?? 'NOT_STARTED', missing: null }))
      const requirements = await fetchQuestRequirements(
        incomplete.map(q => q.name),
        p => setNotice(p.phase === 'wiki' ? `Reading quest requirements from the wiki… ${p.done}/${p.total}` : `Analysing requirements… ${p.done}/${p.total}`),
      )
      const entries = incomplete.map(q => {
        const req = requirements.get(questKey(q.name))
        return { ...q, missing: req ? compareRequirements(req, stats, questEntries) : null }
      })
      downloadMarkdown(`runescape-report-${active.name}-${new Date().toISOString().slice(0, 10)}.md`, buildReport(active.name, entries, completedQuestCount ?? 0))
      setNotice(`Report exported (${entries.length} incomplete quests).`)
    } catch (err) {
      setNotice(`Could not export report: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
    setExporting(false)
  }

  async function toggleGoal(goal: RsGoal) {
    haptic()
    await supabase.from('rs_goals').update({ completed_at: goal.completed_at ? null : new Date().toISOString() }).eq('id', goal.id)
    loadGoals()
  }

  async function reorderGoals(activeId: string, overId: string) {
    const from = activeGoals.findIndex(r => r.goal.id === activeId)
    const to = activeGoals.findIndex(r => r.goal.id === overId)
    if (from < 0 || to < 0 || from === to) return
    haptic()
    const reordered = arrayMove(activeGoals.map(r => r.goal), from, to)
    // Renumber the whole active list so ties (e.g. freshly added goals) can't make the order ambiguous.
    const changed = reordered.map((g, i) => ({ id: g.id, sort_order: i + 1 })).filter(({ id, sort_order }) => goals.find(g => g.id === id)?.sort_order !== sort_order)
    const newOrder = new Map(changed.map(c => [c.id, c.sort_order]))
    setGoals(prev => prev
      .map(g => (newOrder.has(g.id) ? { ...g, sort_order: newOrder.get(g.id)! } : g))
      .sort((a, b) => a.sort_order - b.sort_order || b.created_at.localeCompare(a.created_at)))
    await Promise.all(changed.map(c => supabase.from('rs_goals').update({ sort_order: c.sort_order }).eq('id', c.id)))
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
        <TabsList className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="overview" className="gap-1.5 py-2"><LayoutGrid className="h-4 w-4" />Overview</TabsTrigger>
          <TabsTrigger value="goals" className="gap-1.5 py-2">
            <Target className="h-4 w-4" />Goals
            {activeGoals.length > 0 && <span className="rounded-full bg-primary/10 px-1.5 text-xs text-primary">{activeGoals.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="quests" className="gap-1.5 py-2"><ScrollText className="h-4 w-4" />Quests</TabsTrigger>
          <TabsTrigger value="diaries" className="gap-1.5 py-2"><BookOpen className="h-4 w-4" />Diaries</TabsTrigger>
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
              <section className="space-y-2.5">
                <button
                  onClick={() => { haptic(); setSkillsOpen(o => !o) }}
                  aria-expanded={skillsOpen}
                  className="flex w-full items-center justify-between text-sm font-semibold text-muted-foreground"
                >
                  Skills
                  <ChevronDown className={cn('h-4 w-4 transition-transform', !skillsOpen && '-rotate-90')} />
                </button>
                {skillsOpen && <SkillGrid stats={stats} />}
              </section>
              {stats.activities.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-sm font-semibold text-muted-foreground">Recent activity</h2>
                  <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
                    {stats.activities.slice(0, activityCount).map((a, i) => (
                      <li key={i} className="px-3.5 py-2.5">
                        <div className="text-sm font-medium">{a.text}</div>
                        {a.details && <div className="text-xs text-muted-foreground">{a.details}</div>}
                        <div className="mt-0.5 text-[11px] text-muted-foreground/80">{formatActivityDate(a.date)}</div>
                      </li>
                    ))}
                  </ul>
                  {stats.activities.length > activityCount && (
                    <Button
                      variant="outline"
                      className="w-full rounded-xl"
                      onClick={() => { haptic(); setActivityCount(c => c + ACTIVITY_PAGE) }}
                    >
                      Load more
                    </Button>
                  )}
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
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragEnd={({ active, over }) => { if (over) reorderGoals(String(active.id), String(over.id)) }}
              >
                <SortableContext items={activeGoals.map(r => r.goal.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2.5">
                    {activeGoals.map(r => (
                      <SortableGoalCard
                        key={r.goal.id}
                        goal={r.goal}
                        title={r.title}
                        progress={r.progress}
                        onToggleComplete={() => toggleGoal(r.goal)}
                        onDelete={() => deleteGoal(r.goal)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
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
            <Popover open={filterOpen} onOpenChange={setFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="relative" aria-label="Filter quests">
                  <ListFilter className="h-4 w-4" />
                  {questFilter !== 'all' && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-44">
                {(['all', 'COMPLETED', 'STARTED', 'NOT_STARTED'] as QuestFilter[]).map(f => (
                  <button
                    key={f}
                    onClick={() => { setQuestFilter(f); setFilterOpen(false) }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    {f === 'all' ? 'All' : STATUS_STYLE[f].label}
                    {questFilter === f && <Check className="h-4 w-4 text-primary" />}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="icon" onClick={() => refreshQuests()} disabled={refreshingQuests} aria-label="Refresh quest list">
              <RefreshCw className={cn('h-4 w-4', refreshingQuests && 'animate-spin')} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={exportReport}
              disabled={exporting || !stats || !questEntries || catalogue.length === 0}
              aria-label="Export report"
              title={questEntries ? 'Export quest report' : 'Needs a public RuneMetrics profile'}
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            </Button>
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
                <QuestRow key={quest.id} name={quest.name} status={status} quest={quest} />
              ))}
              {visibleQuests.length === 0 && <li className="px-3.5 py-6 text-center text-sm text-muted-foreground">No matching quests.</li>}
            </ul>
          )}

          {extraGroups.filter(g => g.rows.length > 0).map(g => {
            const open = openGroups[g.id] ?? false
            return (
              <section key={g.id} className="space-y-2">
                <button
                  onClick={() => { haptic(); setOpenGroups(o => ({ ...o, [g.id]: !open })) }}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between pt-2 text-sm font-semibold text-muted-foreground"
                >
                  <span>{g.label} · {g.rows.length}</span>
                  <ChevronDown className={cn('h-4 w-4 transition-transform', !open && '-rotate-90')} />
                </button>
                {open && (
                  <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
                    {g.rows.map(r => <QuestRow key={r.name} name={r.name} status={r.status} quest={r.quest} />)}
                  </ul>
                )}
              </section>
            )
          })}
        </TabsContent>

        <TabsContent value="diaries" className="mt-4">
          {user && active && <DiaryTracker key={active.id} userId={user.id} characterId={active.id} />}
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

function QuestRow({ name, status, quest }: { name: string; status: QuestStatus | null; quest: RsQuest | null }) {
  const meta = quest
    ? [quest.difficulty, quest.quest_points != null ? `${quest.quest_points} QP` : null, quest.members === false ? 'F2P' : null].filter(Boolean).join(' · ')
    : ''
  return (
    <li>
      <Link to={`/runescape/quests/${encodeURIComponent(name)}`} className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-accent/50">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{name}</div>
          {meta && <div className="text-xs text-muted-foreground">{meta}</div>}
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
