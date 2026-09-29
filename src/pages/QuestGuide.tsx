import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, Backpack, Check, ChevronLeft, ExternalLink, Gift, Lightbulb, ListChecks, Loader2, Skull, Target, Zap, BookOpen } from 'lucide-react'
import { supabase } from '../supabase'
import { Button } from '../components/ui/button'
import { cn } from '../utils'
import { haptic } from '../lib/haptics'
import { ACTIVE_CHARACTER_KEY } from '../features/runescape/goals'
import { RsApiError } from '../features/runescape/api'
import { fetchGuide, type FactKey, type Guide, type GuideVariant } from '../features/runescape/guide'
import '../features/runescape/wiki-content.css'

type Load = { state: 'loading' } | { state: 'ready'; guide: Guide } | { state: 'missing' } | { state: 'error' }

const CARDS: { key: FactKey; icon: typeof Gift; accent: string; collapsed?: boolean }[] = [
  { key: 'requirements', icon: ListChecks, accent: 'text-sky-600 bg-sky-100' },
  { key: 'items', icon: Backpack, accent: 'text-amber-600 bg-amber-100' },
  { key: 'rewards', icon: Gift, accent: 'text-emerald-600 bg-emerald-100' },
  { key: 'recommended', icon: Lightbulb, accent: 'text-violet-600 bg-violet-100', collapsed: true },
  { key: 'enemies', icon: Skull, accent: 'text-rose-600 bg-rose-100', collapsed: true },
]

const CHIPS: FactKey[] = ['difficulty', 'length', 'start']

function stripTags(html: string) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

async function load(name: string, variant: GuideVariant, signal: AbortSignal): Promise<Load> {
  try {
    return { state: 'ready', guide: await fetchGuide(name, variant, signal) }
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    return err instanceof RsApiError && err.code === 'NOT_FOUND' ? { state: 'missing' } : { state: 'error' }
  }
}

/** Where this quest stands as a goal for the character the RuneScape page is showing. */
type GoalState =
  | { state: 'loading' | 'unavailable' | 'set' }
  | { state: 'none' | 'saving' | 'error'; userId: string; characterId: string; questId: string }

async function loadGoalState(name: string): Promise<GoalState> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { state: 'unavailable' }
  const [chars, quest] = await Promise.all([
    supabase.from('rs_characters').select('id').order('created_at'),
    supabase.from('rs_quests').select('id').eq('name', name).maybeSingle(),
  ])
  if (chars.error || quest.error || !quest.data || !chars.data?.length) return { state: 'unavailable' }

  let remembered: string | null = null
  try { remembered = localStorage.getItem(ACTIVE_CHARACTER_KEY) } catch { /* storage unavailable */ }
  const characterId = chars.data.find(c => c.id === remembered)?.id ?? chars.data[0].id

  const existing = await supabase
    .from('rs_goals').select('id').eq('character_id', characterId).eq('quest_id', quest.data.id).limit(1)
  if (existing.error) return { state: 'unavailable' }
  if (existing.data.length > 0) return { state: 'set' }
  return { state: 'none', userId: user.id, characterId, questId: quest.data.id }
}

export default function QuestGuide() {
  const { name: rawName = '' } = useParams()
  const name = decodeURIComponent(rawName)
  const navigate = useNavigate()

  const [full, setFull] = useState<Load>({ state: 'loading' })
  const [quick, setQuick] = useState<Load>({ state: 'loading' })
  const [variant, setVariant] = useState<GuideVariant | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [goal, setGoal] = useState<GoalState>({ state: 'loading' })

  useEffect(() => {
    let cancelled = false
    setGoal({ state: 'loading' })
    loadGoalState(name)
      .then(s => { if (!cancelled) setGoal(s) })
      .catch(() => { if (!cancelled) setGoal({ state: 'unavailable' }) })
    return () => { cancelled = true }
  }, [name])

  async function createGoal() {
    if (goal.state !== 'none' && goal.state !== 'error') return
    const { userId, characterId, questId } = goal
    haptic()
    setGoal({ state: 'saving', userId, characterId, questId })
    const { error } = await supabase.from('rs_goals').insert({ user_id: userId, character_id: characterId, type: 'quest', quest_id: questId })
    setGoal(error ? { state: 'error', userId, characterId, questId } : { state: 'set' })
  }

  useEffect(() => {
    const controller = new AbortController()
    setFull({ state: 'loading' })
    setQuick({ state: 'loading' })
    setVariant(null)
    load(name, 'full', controller.signal).then(setFull).catch(() => {})
    load(name, 'quick', controller.signal).then(setQuick).catch(() => {})
    return () => controller.abort()
  }, [name, attempt])

  // Default to the quick guide when the wiki has one, otherwise the full walkthrough.
  useEffect(() => {
    if (variant || quick.state === 'loading') return
    setVariant(quick.state === 'ready' ? 'quick' : 'full')
  }, [variant, quick.state])

  const active = variant === 'quick' ? quick : variant === 'full' ? full : ({ state: 'loading' } as Load)
  // Requirements, items and rewards live on the main quest page's infobox.
  const factsGuide = full.state === 'ready' ? full.guide : quick.state === 'ready' ? quick.guide : null
  const facts = new Map(factsGuide?.facts.map(f => [f.key, f]))
  const wikiUrl = factsGuide?.url ?? `https://runescape.wiki/w/${encodeURIComponent(name.replace(/ /g, '_'))}`
  const bothFailed = full.state !== 'loading' && quick.state !== 'loading' && full.state !== 'ready' && quick.state !== 'ready'

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4 pb-24">
      <button
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/runescape'))}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Back
      </button>

      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-amber-900 p-5 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-amber-300/90">
            <BookOpen className="h-3.5 w-3.5" /> Quest guide
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{name}</h1>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {CHIPS.map(k => facts.get(k)).filter(Boolean).map(f => (
              <span key={f!.key} className="rounded-full bg-white/10 px-2.5 py-1 text-xs backdrop-blur">
                <span className="text-white/60">{f!.label}: </span>
                {stripTags(f!.html)}
              </span>
            ))}
            {goal.state === 'set' ? (
              <Link to="/runescape?tab=goals" className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2.5 py-1 text-xs font-medium text-emerald-200 backdrop-blur hover:bg-emerald-400/30">
                <Check className="h-3 w-3" /> Goal set
              </Link>
            ) : goal.state === 'none' || goal.state === 'saving' || goal.state === 'error' ? (
              <button
                onClick={createGoal}
                disabled={goal.state === 'saving'}
                className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-xs font-semibold text-slate-900 hover:bg-amber-300 disabled:opacity-70"
              >
                {goal.state === 'saving' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Target className="h-3 w-3" />}
                {goal.state === 'error' ? 'Retry: create goal' : 'Create goal'}
              </button>
            ) : null}
            <a
              href={wikiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs backdrop-blur hover:bg-white/20"
            >
              RuneScape Wiki <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </section>

      {bothFailed ? (
        <div className="flex gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="space-y-2">
            <p>
              {full.state === 'missing'
                ? `The wiki has no page titled "${name}".`
                : 'Could not load this guide from the RuneScape Wiki right now.'}
            </p>
            <div className="flex gap-2">
              {full.state === 'error' && <Button size="sm" variant="outline" onClick={() => setAttempt(a => a + 1)}>Try again</Button>}
              <Button size="sm" variant="outline" asChild><Link to="/runescape">Back to quests</Link></Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            <VariantTab icon={Zap} label="Quick guide" active={variant === 'quick'} disabled={quick.state === 'missing' || quick.state === 'error'} onClick={() => setVariant('quick')} />
            <VariantTab icon={BookOpen} label="Full guide" active={variant === 'full'} disabled={full.state === 'missing' || full.state === 'error'} onClick={() => setVariant('full')} />
          </div>
          {quick.state === 'missing' && (
            <p className="text-xs text-muted-foreground">The wiki has no quick guide for this quest, showing the full walkthrough.</p>
          )}

          {CARDS.map(({ key, icon: Icon, accent, collapsed }) => {
            const fact = facts.get(key)
            if (!fact) return null
            const body = <div className="wiki-content wiki-content-compact" dangerouslySetInnerHTML={{ __html: fact.html }} />
            const header = (
              <span className="flex items-center gap-2.5 font-semibold">
                <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', accent)}><Icon className="h-4 w-4" /></span>
                {fact.label}
              </span>
            )
            return collapsed ? (
              <details key={key} className="rounded-2xl border border-border bg-card p-4">
                <summary className="cursor-pointer list-none">{header}</summary>
                <div className="mt-3">{body}</div>
              </details>
            ) : (
              <section key={key} className="space-y-3 rounded-2xl border border-border bg-card p-4">
                {header}
                {body}
              </section>
            )
          })}

          {active.state === 'loading' || variant === null ? (
            <div className="space-y-2">
              {[0, 1, 2].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />)}
            </div>
          ) : active.state === 'ready' ? (
            <GuideBody guide={active.guide} />
          ) : (
            <p className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              This guide couldn't be loaded.
            </p>
          )}
        </>
      )}
    </div>
  )
}

function VariantTab({ icon: Icon, label, active, disabled, onClick }: {
  icon: typeof Zap; label: string; active: boolean; disabled: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all disabled:opacity-40',
        active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
      )}
    >
      <Icon className="h-4 w-4" />{label}
    </button>
  )
}

function GuideBody({ guide }: { guide: Guide }) {
  if (guide.sections.length === 0) {
    return <p className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">This page has no guide content.</p>
  }
  return (
    <div className="space-y-3">
      {guide.sections.map((s, i) => (
        <section key={i} className="rounded-2xl border border-border bg-card p-4">
          {s.title && <h2 className="mb-1 text-base font-bold">{s.title}</h2>}
          <div className="wiki-content" dangerouslySetInnerHTML={{ __html: s.html }} />
        </section>
      ))}
    </div>
  )
}
