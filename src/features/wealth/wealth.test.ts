import { describe, it, expect } from 'vitest'
import type { WealthGoal, WealthItem, WealthOwner, WealthSnapshot } from '../../supabase'
import {
  buildNetWorthSeries,
  categoryOf,
  describeDaysLeft,
  filterByOwner,
  formatMoney,
  formatMoneyCompact,
  formatMoneyRounded,
  formatRecordedOn,
  goalProgress,
  groupByCategory,
  ilsPerUnit,
  isGoalValid,
  isItemValid,
  itemValues,
  latestSnapshots,
  parseAmount,
  parseOwnerFilter,
  scopeLabel,
  snapshotsForItem,
  sortGoals,
  sumIls,
  toggleOwner,
  toggleScope,
  totalsByOwner,
  unconvertedCount,
} from './wealth'

function item(id: string, name: string, owner: WealthOwner = 'ophir', category = 'bank'): WealthItem {
  return { id, user_id: 'u1', name, category, owner, notes: null, created_at: '2026-10-01T00:00:00Z' }
}

let snapSeq = 0
function snap(itemId: string, recordedOn: string, balance: number, currency = 'ils'): WealthSnapshot {
  snapSeq++
  return {
    id: `s${snapSeq}`,
    user_id: 'u1',
    item_id: itemId,
    recorded_on: recordedOn,
    balance,
    currency,
    created_at: `2026-10-01T00:00:${String(snapSeq).padStart(2, '0')}Z`,
  }
}

function goal(extra: Partial<WealthGoal> = {}): WealthGoal {
  return {
    id: 'g1',
    user_id: 'u1',
    name: 'Apartment',
    target_amount: 1000,
    target_date: null,
    scope: ['ophir', 'yael', 'shared'],
    notes: null,
    created_at: '2026-10-01T00:00:00Z',
    ...extra,
  }
}

// 1 ILS buys 0.25 USD and 0.2 EUR  =>  1 USD = 4 ILS, 1 EUR = 5 ILS.
const RATES = { usd: 0.25, eur: 0.2 }

describe('owners', () => {
  it('parses the owner filter, falling back to all', () => {
    expect(parseOwnerFilter('yael')).toBe('yael')
    expect(parseOwnerFilter('shared')).toBe('shared')
    expect(parseOwnerFilter('nobody')).toBe('all')
    expect(parseOwnerFilter(null)).toBe('all')
  })

  it('toggles owners in canonical order', () => {
    expect(toggleOwner(['shared'], 'ophir')).toEqual(['ophir', 'shared'])
    expect(toggleOwner(['ophir', 'shared'], 'ophir')).toEqual(['shared'])
  })

  it('never lets a goal scope become empty', () => {
    expect(toggleScope(['yael'], 'yael')).toEqual(['yael'])
    expect(toggleScope(['yael', 'shared'], 'yael')).toEqual(['shared'])
    expect(toggleScope(['yael'], 'ophir')).toEqual(['ophir', 'yael'])
  })

  it('labels scopes', () => {
    expect(scopeLabel(['ophir', 'yael', 'shared'])).toBe('Everyone')
    expect(scopeLabel(['shared', 'ophir'])).toBe('Ophir + Shared')
    expect(scopeLabel(['yael'])).toBe('Yael')
  })
})

describe('categories', () => {
  it('falls back to Other for unknown keys', () => {
    expect(categoryOf('pension').label).toBe('Pension')
    expect(categoryOf('mystery').key).toBe('other')
  })
})

describe('currency', () => {
  it('converts to shekels', () => {
    expect(ilsPerUnit(RATES, 'ils')).toBe(1)
    expect(ilsPerUnit(RATES, 'usd')).toBeCloseTo(4)
    expect(ilsPerUnit(RATES, 'USD')).toBeCloseTo(4)
  })

  it('treats missing or bad rates as unknown, but NIS always works', () => {
    expect(ilsPerUnit(null, 'usd')).toBeNull()
    expect(ilsPerUnit(RATES, 'gbp')).toBeNull()
    expect(ilsPerUnit({ usd: 0 }, 'usd')).toBeNull()
    expect(ilsPerUnit(null, 'ils')).toBe(1)
  })

  it('formats money with symbols and a fixed locale', () => {
    expect(formatMoney(1234.5)).toBe('₪1,234.50')
    expect(formatMoney(1234)).toBe('₪1,234')
    expect(formatMoney(-300, 'usd')).toBe('-$300')
    expect(formatMoney(12, 'eur')).toBe('€12')
    expect(formatMoney(0.001)).toBe('₪0')
    expect(formatMoney(-0.001)).toBe('₪0')
  })

  it('rounds computed values to whole units', () => {
    expect(formatMoneyRounded(395312.9)).toBe('₪395,313')
    expect(formatMoneyRounded(36812.4, 'usd')).toBe('$36,812')
    expect(formatMoneyRounded(-1500.4)).toBe('-₪1,500')
    expect(formatMoneyRounded(-0.2)).toBe('₪0')
  })

  it('formats compact axis labels', () => {
    expect(formatMoneyCompact(1_250_000)).toBe('₪1.25M')
    expect(formatMoneyCompact(350_000)).toBe('₪350K')
    expect(formatMoneyCompact(1_500)).toBe('₪1.5K')
    expect(formatMoneyCompact(420)).toBe('₪420')
  })

  it('parses typed amounts', () => {
    expect(parseAmount('1,234.567')).toBe(1234.57)
    expect(parseAmount(' -300 ')).toBe(-300)
    expect(parseAmount('.5')).toBe(0.5)
    expect(parseAmount('0')).toBe(0)
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount('12.3.4')).toBeNull()
    expect(parseAmount('1e5')).toBeNull()
  })
})

describe('snapshots', () => {
  const a1 = snap('a', '2026-09-01', 100)
  const a2 = snap('a', '2026-10-01', 150)
  const a0 = snap('a', '2026-08-01', 90) // backfilled, inserted last
  const b1 = snap('b', '2026-09-15', 10, 'usd')

  it('picks each item\'s latest snapshot by date, not by insertion order', () => {
    const latest = latestSnapshots([a1, a2, a0, b1])
    expect(latest.get('a')).toBe(a2)
    expect(latest.get('b')).toBe(b1)
    expect(latest.size).toBe(2)
  })

  it('lists one item\'s history newest first', () => {
    expect(snapshotsForItem([a1, a2, a0, b1], 'a').map(s => s.recorded_on)).toEqual([
      '2026-10-01',
      '2026-09-01',
      '2026-08-01',
    ])
  })

  it('formats the recorded date relative to today', () => {
    expect(formatRecordedOn('2026-10-15', '2026-10-15')).toBe('Today')
    expect(formatRecordedOn('2026-10-03', '2026-10-15')).toBe('Oct 3')
    expect(formatRecordedOn('2025-12-31', '2026-10-15')).toBe('Dec 31, 2025')
  })
})

describe('values and totals', () => {
  const items = [
    item('a', 'Leumi', 'ophir', 'bank'),
    item('b', 'Brokerage', 'yael', 'investment'),
    item('c', 'Joint savings', 'shared', 'savings'),
    item('d', 'Empty', 'ophir', 'bank'),
  ]
  const snapshots = [
    snap('a', '2026-09-01', 100),
    snap('a', '2026-10-01', 200),
    snap('b', '2026-10-01', 50, 'usd'), // 200 ILS
    snap('c', '2026-10-01', 10, 'eur'), // 50 ILS
  ]

  it('values items in shekels from their latest snapshot', () => {
    const values = itemValues(items, snapshots, RATES)
    expect(values.map(v => v.ils)).toEqual([200, 200, 50, null])
    expect(values[3].snapshot).toBeNull()
    expect(sumIls(values)).toBe(450)
  })

  it('totals by owner and filters by owner', () => {
    const values = itemValues(items, snapshots, RATES)
    expect(totalsByOwner(values)).toEqual({ ophir: 200, yael: 200, shared: 50 })
    expect(sumIls(filterByOwner(values, 'yael'))).toBe(200)
    expect(filterByOwner(values, 'all')).toHaveLength(4)
  })

  it('excludes (and counts) items whose rate is unavailable', () => {
    const values = itemValues(items, snapshots, null)
    expect(sumIls(values)).toBe(200) // only the NIS item
    expect(unconvertedCount(values)).toBe(2) // the USD and EUR ones; the empty item isn't "unconverted"
  })

  it('groups by category in built-in order with subtotals', () => {
    const groups = groupByCategory(itemValues(items, snapshots, RATES))
    expect(groups.map(g => g.category.key)).toEqual(['bank', 'savings', 'investment'])
    expect(groups[0].subtotal).toBe(200)
    // Within a group: biggest first, items with no balance last.
    expect(groups[0].values.map(v => v.item.name)).toEqual(['Leumi', 'Empty'])
  })
})

describe('goal progress', () => {
  const items = [item('a', 'Mine', 'ophir'), item('b', 'Hers', 'yael'), item('c', 'Ours', 'shared')]
  const snapshots = [snap('a', '2026-10-01', 300), snap('b', '2026-10-01', 100), snap('c', '2026-10-01', 200)]
  const values = itemValues(items, snapshots, RATES)

  it('sums wealth in scope', () => {
    expect(goalProgress(goal(), values, '2026-10-15').current).toBe(600)
    expect(goalProgress(goal({ scope: ['shared'] }), values, '2026-10-15').current).toBe(200)
    expect(goalProgress(goal({ scope: ['ophir', 'shared'] }), values, '2026-10-15').current).toBe(500)
  })

  it('computes percentage and remaining', () => {
    const p = goalProgress(goal(), values, '2026-10-15')
    expect(p.pct).toBe(60)
    expect(p.remaining).toBe(400)
    expect(p.reached).toBe(false)
  })

  it('caps at 100% once reached', () => {
    const p = goalProgress(goal({ target_amount: 500 }), values, '2026-10-15')
    expect(p.pct).toBe(100)
    expect(p.remaining).toBe(0)
    expect(p.reached).toBe(true)
  })

  it('counts days to the target date, negative when overdue', () => {
    expect(goalProgress(goal(), values, '2026-10-15').daysLeft).toBeNull()
    expect(goalProgress(goal({ target_date: '2026-10-25' }), values, '2026-10-15').daysLeft).toBe(10)
    expect(goalProgress(goal({ target_date: '2026-10-10' }), values, '2026-10-15').daysLeft).toBe(-5)
  })

  it('describes the time left', () => {
    expect(describeDaysLeft(0)).toBe('Due today')
    expect(describeDaysLeft(1)).toBe('1 day left')
    expect(describeDaysLeft(10)).toBe('10 days left')
    expect(describeDaysLeft(90)).toBe('3 months left')
    expect(describeDaysLeft(800)).toBe('2.2 years left')
    expect(describeDaysLeft(-5)).toBe('Overdue by 5 days')
  })

  it('sorts goals by target date, undated last', () => {
    const sorted = sortGoals([
      goal({ id: 'none', target_date: null, created_at: '2026-01-01T00:00:00Z' }),
      goal({ id: 'late', target_date: '2030-01-01' }),
      goal({ id: 'soon', target_date: '2027-01-01' }),
    ])
    expect(sorted.map(g => g.id)).toEqual(['soon', 'late', 'none'])
  })
})

describe('net worth series', () => {
  const items = [item('a', 'Leumi', 'ophir'), item('b', 'Brokerage', 'yael'), item('c', 'Joint', 'shared')]
  const snapshots = [
    snap('a', '2026-08-01', 100),
    snap('a', '2026-10-01', 300),
    snap('b', '2026-09-01', 25, 'usd'), // 100 ILS
    snap('b', '2026-10-01', 50, 'usd'), // 200 ILS
    snap('c', '2026-07-01', 10),
  ]

  it('carries each item forward between its updates', () => {
    expect(buildNetWorthSeries(items, snapshots, RATES, 'all')).toEqual([
      { date: '2026-07-01', total: 10 },
      { date: '2026-08-01', total: 110 }, // a=100, c=10
      { date: '2026-09-01', total: 210 }, // + b=100
      { date: '2026-10-01', total: 510 }, // a=300, b=200, c=10
    ])
  })

  it('ends on the current total', () => {
    const series = buildNetWorthSeries(items, snapshots, RATES, 'all')
    expect(series[series.length - 1].total).toBe(sumIls(itemValues(items, snapshots, RATES)))
  })

  it('filters by owner', () => {
    expect(buildNetWorthSeries(items, snapshots, RATES, 'yael')).toEqual([
      { date: '2026-09-01', total: 100 },
      { date: '2026-10-01', total: 200 },
    ])
  })

  it('skips items with no known rate, consistently', () => {
    const series = buildNetWorthSeries(items, snapshots, null, 'all')
    expect(series.map(p => p.total)).toEqual([10, 110, 110, 310])
  })

  it('returns nothing without snapshots, and handles a backfilled date', () => {
    expect(buildNetWorthSeries(items, [], RATES, 'all')).toEqual([])
    const withBackfill = [...snapshots, snap('a', '2026-07-15', 5)]
    expect(buildNetWorthSeries(items, withBackfill, RATES, 'ophir')).toEqual([
      { date: '2026-07-15', total: 5 },
      { date: '2026-08-01', total: 100 },
      { date: '2026-10-01', total: 300 },
    ])
  })
})

describe('validation', () => {
  it('needs a name and a numeric balance for an item', () => {
    expect(isItemValid({ name: 'Leumi', balance: '1,000' })).toBe(true)
    expect(isItemValid({ name: 'Loan', balance: '-500' })).toBe(true)
    expect(isItemValid({ name: '  ', balance: '10' })).toBe(false)
    expect(isItemValid({ name: 'Leumi', balance: '' })).toBe(false)
  })

  it('needs a name and a positive target for a goal', () => {
    expect(isGoalValid({ name: 'Apartment', target: '1,000,000' })).toBe(true)
    expect(isGoalValid({ name: 'Apartment', target: '0' })).toBe(false)
    expect(isGoalValid({ name: 'Apartment', target: '-5' })).toBe(false)
    expect(isGoalValid({ name: '', target: '5' })).toBe(false)
  })
})
