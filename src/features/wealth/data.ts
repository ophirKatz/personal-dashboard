import { supabase } from '../../supabase'
import type { WealthGoal, WealthItem, WealthSnapshot } from '../../supabase'
import { fetchRates } from '../finance/currency'
import type { IlsRates } from './wealth'

// PostgREST returns at most 1000 rows per request, and every balance edit adds
// a snapshot, so page through them rather than silently truncating history.
const PAGE_SIZE = 1000

async function loadAllSnapshots(): Promise<{ data: WealthSnapshot[]; error: string | null }> {
  const all: WealthSnapshot[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('wealth_snapshots')
      .select('*')
      .order('recorded_on')
      .order('id')
      .range(from, from + PAGE_SIZE - 1)
    if (error) return { data: [], error: error.message }
    const rows = (data ?? []) as WealthSnapshot[]
    all.push(...rows)
    if (rows.length < PAGE_SIZE) return { data: all, error: null }
  }
}

export type WealthData = {
  items: WealthItem[]
  snapshots: WealthSnapshot[]
  goals: WealthGoal[]
}

export async function loadWealth(): Promise<{ data: WealthData; error: string | null }> {
  const [itemsRes, snapshotsRes, goalsRes] = await Promise.all([
    supabase.from('wealth_items').select('*').order('created_at'),
    loadAllSnapshots(),
    supabase.from('wealth_goals').select('*').order('created_at'),
  ])
  const error = itemsRes.error?.message ?? snapshotsRes.error ?? goalsRes.error?.message ?? null
  return {
    data: {
      items: (itemsRes.data ?? []) as WealthItem[],
      snapshots: snapshotsRes.data,
      goals: (goalsRes.data ?? []) as WealthGoal[],
    },
    error,
  }
}

/** How much of each currency one shekel buys, or null if the rate service is unreachable. */
export async function loadIlsRates(): Promise<IlsRates> {
  try {
    return (await fetchRates('ils')) ?? null
  } catch {
    return null
  }
}
