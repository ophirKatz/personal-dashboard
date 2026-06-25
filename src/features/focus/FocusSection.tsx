import { useEffect, useState } from 'react'
import { RefreshCw, Sparkles } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { supabase } from '../../supabase'
import type { FocusSummary } from '../../supabase'
import { getAutoGenerateFocusSummariesOnChange } from '../../lib/userSettings'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs'

type Period = 'today' | 'week'

export default function FocusSection() {
  const [summaries, setSummaries] = useState<Record<Period, FocusSummary | null>>({ today: null, week: null })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState<Period | null>(null)
  const [tab, setTab] = useState<Period>('today')
  const [autoGenerate, setAutoGenerate] = useState<boolean | null>(null)

  async function load() {
    const { data } = await supabase.from('focus_summaries').select('*').in('period', ['today', 'week'])
    const next: Record<Period, FocusSummary | null> = { today: null, week: null }
    for (const row of (data ?? []) as FocusSummary[]) {
      next[row.period] = row
    }
    setSummaries(next)
    setLoading(false)
  }

  useEffect(() => {
    load()
    getAutoGenerateFocusSummariesOnChange().then(setAutoGenerate)
  }, [])

  async function refresh(period: Period) {
    setRefreshing(period)
    await supabase.functions.invoke('generate-focus-summary', { body: { period } })
    await load()
    setRefreshing(null)
  }

  // Auto-generate on first load (or on switching to a tab) if no cached summary exists yet,
  // unless the user disabled auto-generation in Settings (manual refresh always still works).
  useEffect(() => {
    if (!loading && autoGenerate && !summaries[tab] && refreshing !== tab) {
      refresh(tab)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, tab, autoGenerate])

  function renderContent(period: Period) {
    const summary = summaries[period]
    const isRefreshing = refreshing === period

    if (loading || (isRefreshing && !summary)) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-1.5">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
          Generating your focus summary…
        </div>
      )
    }

    if (summary?.status === 'error' && !summary.summary) {
      return <p className="text-sm text-destructive">Couldn't generate a summary. Try the refresh button.</p>
    }

    if (!summary?.summary) {
      return <p className="text-sm text-muted-foreground">No summary yet.</p>
    }

    return (
      <>
        <div className="flex items-start gap-2">
          <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-sm whitespace-pre-line leading-relaxed">{summary.summary}</p>
        </div>
        {summary.generated_at && (
          <p className="text-xs text-muted-foreground mt-2">
            Updated {formatDistanceToNow(new Date(summary.generated_at), { addSuffix: true })}
          </p>
        )}
      </>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Focus</h2>
        <button
          onClick={() => refresh(tab)}
          disabled={refreshing === tab}
          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground disabled:opacity-40"
          title="Regenerate"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing === tab ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as Period)}>
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="week">This Week</TabsTrigger>
        </TabsList>
        <TabsContent value="today" className="mt-3">
          <div className="p-3.5 bg-card border border-border rounded-xl">{renderContent('today')}</div>
        </TabsContent>
        <TabsContent value="week" className="mt-3">
          <div className="p-3.5 bg-card border border-border rounded-xl">{renderContent('week')}</div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
