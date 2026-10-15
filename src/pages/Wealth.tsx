import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, X } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { WealthGoal, WealthItem } from '../supabase'
import { Fab } from '../components/ui/fab'
import { cn, today } from '../utils'
import AccountsList from '../features/wealth/AccountsList'
import AddItemDrawer from '../features/wealth/AddItemDrawer'
import EditItemDrawer from '../features/wealth/EditItemDrawer'
import GoalsList from '../features/wealth/GoalsList'
import NetWorthChart from '../features/wealth/NetWorthChart'
import WealthGoalDrawer from '../features/wealth/WealthGoalDrawer'
import WealthSummary from '../features/wealth/WealthSummary'
import { loadIlsRates, loadWealth } from '../features/wealth/data'
import type { WealthData } from '../features/wealth/data'
import {
  DEFAULT_OWNER,
  OWNER_LABELS,
  WEALTH_OWNERS,
  buildNetWorthSeries,
  filterByOwner,
  groupByCategory,
  itemValues,
  parseOwnerFilter,
  snapshotsForItem,
  sumIls,
  totalsByOwner,
  unconvertedCount,
} from '../features/wealth/wealth'
import type { IlsRates, OwnerFilter } from '../features/wealth/wealth'

type Tab = 'accounts' | 'goals' | 'trend'

const TABS: { key: Tab; label: string }[] = [
  { key: 'accounts', label: 'Accounts' },
  { key: 'goals', label: 'Goals' },
  { key: 'trend', label: 'Trend' },
]

const OWNER_FILTERS: OwnerFilter[] = ['all', ...WEALTH_OWNERS]

function parseTab(raw: string | null): Tab {
  return TABS.some(t => t.key === raw) ? (raw as Tab) : 'accounts'
}

const EMPTY: WealthData = { items: [], snapshots: [], goals: [] }

function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { key: T; label: string }[]
  value: T
  onChange: (next: T) => void
  label: string
}) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1" role="group" aria-label={label}>
      {options.map(o => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            'flex-1 whitespace-nowrap rounded-lg px-2 py-1.5 text-sm font-medium transition-colors',
            value === o.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function Wealth() {
  // Owner filter + tab live in the URL so they survive a reload.
  const [searchParams, setSearchParams] = useSearchParams()
  const owner = parseOwnerFilter(searchParams.get('owner'))
  const tab = parseTab(searchParams.get('tab'))

  const [user, setUser] = useState<User | null>(null)
  const [data, setData] = useState<WealthData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  const [rates, setRates] = useState<IlsRates>(null)
  const [ratesStatus, setRatesStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const [showAddItem, setShowAddItem] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [showAddGoal, setShowAddGoal] = useState(false)
  const [editingGoal, setEditingGoal] = useState<WealthGoal | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  async function load() {
    const { data, error } = await loadWealth()
    if (error) setError(error)
    else setData(data)
    setLoading(false)
  }

  function refreshRates() {
    setRatesStatus('loading')
    loadIlsRates().then(r => {
      setRates(r)
      setRatesStatus(r ? 'ready' : 'error')
    })
  }

  useEffect(() => { load() }, [])
  useEffect(() => { refreshRates() }, [])

  function updateParams(next: { owner?: OwnerFilter; tab?: Tab }) {
    const params = new URLSearchParams(searchParams)
    if (next.owner !== undefined) {
      if (next.owner === 'all') params.delete('owner')
      else params.set('owner', next.owner)
    }
    if (next.tab !== undefined) {
      if (next.tab === 'accounts') params.delete('tab')
      else params.set('tab', next.tab)
    }
    setSearchParams(params, { replace: true })
  }

  const { items, snapshots, goals } = data
  const todayStr = today()

  const values = useMemo(() => itemValues(items, snapshots, rates), [items, snapshots, rates])
  const visible = useMemo(() => filterByOwner(values, owner), [values, owner])
  const groups = useMemo(() => groupByCategory(visible), [visible])
  const series = useMemo(() => buildNetWorthSeries(items, snapshots, rates, owner), [items, snapshots, rates, owner])

  const hasForeign = values.some(v => v.snapshot && v.snapshot.currency !== 'ils')
  // Don't flash a partial total while rates for foreign balances are still loading.
  const totalsReady = !loading && (ratesStatus !== 'loading' || !hasForeign)
  const unconverted = ratesStatus === 'error' ? unconvertedCount(visible) : 0

  const editingItem: WealthItem | null = items.find(i => i.id === editingItemId) ?? null

  function handleItemSaved(warn?: string) {
    if (warn) setWarning(warn)
    load()
  }

  const filterOptions = OWNER_FILTERS.map(o => ({ key: o, label: o === 'all' ? 'All' : OWNER_LABELS[o] }))

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 pb-28">
      <div>
        <h1 className="text-2xl font-bold">Wealth</h1>
        <p className="text-sm text-muted-foreground">Accounts, goals & net worth</p>
      </div>

      <Segmented
        label="Filter by owner"
        options={filterOptions}
        value={owner}
        onChange={o => updateParams({ owner: o })}
      />

      <WealthSummary owner={owner} total={sumIls(visible)} byOwner={totalsByOwner(values)} ready={totalsReady} />

      {error && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss"><X className="h-4 w-4" /></button>
        </div>
      )}

      {warning && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-100 p-3 text-sm text-amber-800">
          <span>{warning}</span>
          <button type="button" onClick={() => setWarning(null)} aria-label="Dismiss"><X className="h-4 w-4" /></button>
        </div>
      )}

      {unconverted > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-100 p-3 text-sm text-amber-800">
          <span>
            Exchange rates unavailable — {unconverted} non-₪ {unconverted === 1 ? 'account is' : 'accounts are'} left out of the totals.
          </span>
          <button type="button" onClick={refreshRates} className="shrink-0 font-medium underline">Retry</button>
        </div>
      )}

      <Segmented label="Section" options={TABS} value={tab} onChange={t => updateParams({ tab: t })} />

      {loading ? (
        <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : tab === 'accounts' ? (
        <AccountsList
          groups={groups}
          hasItems={items.length > 0}
          todayStr={todayStr}
          onOpen={item => setEditingItemId(item.id)}
        />
      ) : tab === 'goals' ? (
        <GoalsList goals={goals} values={values} todayStr={todayStr} onOpen={setEditingGoal} />
      ) : (
        <NetWorthChart series={series} />
      )}

      {user && tab === 'accounts' && (
        <Fab onClick={() => setShowAddItem(true)} aria-label="Add account">
          <Plus className="h-6 w-6" />
        </Fab>
      )}
      {user && tab === 'goals' && (
        <Fab onClick={() => setShowAddGoal(true)} aria-label="Add goal">
          <Plus className="h-6 w-6" />
        </Fab>
      )}

      {user && showAddItem && (
        <AddItemDrawer
          open={showAddItem}
          onClose={() => setShowAddItem(false)}
          userId={user.id}
          defaultOwner={owner === 'all' ? DEFAULT_OWNER : owner}
          onSaved={handleItemSaved}
        />
      )}

      {user && editingItem && (
        <EditItemDrawer
          key={editingItem.id}
          open
          onClose={() => setEditingItemId(null)}
          userId={user.id}
          item={editingItem}
          snapshots={snapshotsForItem(snapshots, editingItem.id)}
          rates={rates}
          linkedGoalCount={goals.filter(g => g.item_id === editingItem.id).length}
          onChanged={load}
        />
      )}

      {user && (showAddGoal || editingGoal) && (
        <WealthGoalDrawer
          key={editingGoal?.id ?? 'new'}
          open
          onClose={() => { setShowAddGoal(false); setEditingGoal(null) }}
          userId={user.id}
          goal={editingGoal}
          defaultScope={owner === 'all' ? WEALTH_OWNERS : [owner]}
          items={items}
          onSaved={load}
        />
      )}
    </div>
  )
}
