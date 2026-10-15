// Pure helpers for the Wealth feature. Type-only Supabase imports so this file
// (and its tests) never load the Supabase client.
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import type { WealthGoal, WealthItem, WealthOwner, WealthSnapshot } from '../../supabase'
import { CURRENCIES } from '../finance/currency'

// ---------------------------------------------------------------- owners

export const WEALTH_OWNERS: WealthOwner[] = ['ophir', 'yael', 'shared']

export const OWNER_LABELS: Record<WealthOwner, string> = {
  ophir: 'Ophir',
  yael: 'Yael',
  shared: 'Shared',
}

export type OwnerFilter = WealthOwner | 'all'

export const DEFAULT_OWNER: WealthOwner = 'ophir'

export function parseOwnerFilter(raw: string | null): OwnerFilter {
  return (WEALTH_OWNERS as string[]).includes(raw ?? '') ? (raw as WealthOwner) : 'all'
}

/** Adds or removes an owner, keeping canonical (Ophir, Yael, Shared) order. */
export function toggleOwner(owners: WealthOwner[], owner: WealthOwner): WealthOwner[] {
  const next = owners.includes(owner) ? owners.filter(o => o !== owner) : [...owners, owner]
  return WEALTH_OWNERS.filter(o => next.includes(o))
}

/** Like toggleOwner, but a goal always needs at least one owner, so the last one can't be removed. */
export function toggleScope(scope: WealthOwner[], owner: WealthOwner): WealthOwner[] {
  const next = toggleOwner(scope, owner)
  return next.length === 0 ? scope : next
}

export function scopeLabel(scope: WealthOwner[]): string {
  const owners = WEALTH_OWNERS.filter(o => scope.includes(o))
  if (owners.length === WEALTH_OWNERS.length) return 'Everyone'
  return owners.map(o => OWNER_LABELS[o]).join(' + ')
}

// ------------------------------------------------------------ categories

export type WealthCategory = { key: string; label: string; defaultName: string }

// Built-ins. The name stays free-form ("Leumi checking", "Migdal pension") - the
// category just groups items and prefills a name.
export const WEALTH_CATEGORIES: WealthCategory[] = [
  { key: 'bank', label: 'Bank account', defaultName: 'Bank account' },
  { key: 'savings', label: 'Savings / deposit', defaultName: 'Savings' },
  { key: 'investment', label: 'Investment account', defaultName: 'Investment account' },
  { key: 'pension', label: 'Pension', defaultName: 'Pension' },
  { key: 'study_fund', label: 'Study fund', defaultName: 'Study fund' },
  { key: 'provident_fund', label: 'Provident fund', defaultName: 'Provident fund' },
  { key: 'crypto', label: 'Crypto', defaultName: 'Crypto' },
  { key: 'real_estate', label: 'Real estate', defaultName: 'Real estate' },
  { key: 'cash', label: 'Cash', defaultName: 'Cash' },
  { key: 'other', label: 'Other', defaultName: '' },
]

const OTHER_CATEGORY = WEALTH_CATEGORIES[WEALTH_CATEGORIES.length - 1]

/** Unknown / legacy keys read as "Other" so a stray value never hides an item. */
export function categoryOf(key: string): WealthCategory {
  return WEALTH_CATEGORIES.find(c => c.key === key) ?? OTHER_CATEGORY
}

// --------------------------------------------------------------- currency

/** Result of fetchRates('ils'): how much of each currency one shekel buys. */
export type IlsRates = Record<string, number> | null

/** How many shekels one unit of `currency` is worth; null when the rate is unknown. */
export function ilsPerUnit(rates: IlsRates, currency: string): number | null {
  const code = currency.toLowerCase()
  if (code === 'ils') return 1
  const perIls = rates?.[code]
  return perIls && perIls > 0 ? 1 / perIls : null
}

export function toIls(amount: number, currency: string, rates: IlsRates): number | null {
  const per = ilsPerUnit(rates, currency)
  return per === null ? null : amount * per
}

function currencySymbol(currency: string): string {
  const info = CURRENCIES.find(c => c.code === currency.toLowerCase())
  return info ? info.symbol : `${currency.toUpperCase()} `
}

/**
 * An amount as entered: "₪1,234.50", "-$300", "€12". Decimals only when there
 * are any. Fixed locale so output doesn't vary by device.
 */
export function formatMoney(amount: number, currency = 'ils'): string {
  if (!Number.isFinite(amount)) return '—'
  const cents = Math.round(Math.abs(amount) * 100)
  const text = (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
  return `${amount < 0 && cents !== 0 ? '-' : ''}${currencySymbol(currency)}${text}`
}

/** A computed value (totals, conversions) in whole units - cents would be false precision there. */
export function formatMoneyRounded(amount: number, currency = 'ils'): string {
  if (!Number.isFinite(amount)) return '—'
  const whole = Math.round(Math.abs(amount))
  return `${amount < 0 && whole !== 0 ? '-' : ''}${currencySymbol(currency)}${whole.toLocaleString('en-US')}`
}

/** Compact form for chart axes: ₪1.2M, ₪350K. */
export function formatMoneyCompact(amount: number): string {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}₪${trimZero((abs / 1_000_000).toFixed(2))}M`
  if (abs >= 1_000) return `${sign}₪${trimZero((abs / 1_000).toFixed(1))}K`
  return `${sign}₪${Math.round(abs)}`
}

function trimZero(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s
}

/**
 * Parses a typed amount ("1,234.50", "-300"). Returns null for anything that
 * isn't a finite number, rounded to 2 decimals like the numeric(18,2) column.
 */
export function parseAmount(input: string): number | null {
  const cleaned = input.trim().replace(/[,\s]/g, '')
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return null
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100) / 100
}

// -------------------------------------------------------------- snapshots

/** Newest first; same-day rows (shouldn't exist - unique per item/day) fall back to created_at. */
function byNewest(a: WealthSnapshot, b: WealthSnapshot): number {
  if (a.recorded_on !== b.recorded_on) return a.recorded_on < b.recorded_on ? 1 : -1
  return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0
}

/** One item's snapshots, newest first. */
export function snapshotsForItem(snapshots: WealthSnapshot[], itemId: string): WealthSnapshot[] {
  return snapshots.filter(s => s.item_id === itemId).sort(byNewest)
}

/** The latest snapshot per item id - an item's current balance. */
export function latestSnapshots(snapshots: WealthSnapshot[]): Map<string, WealthSnapshot> {
  const latest = new Map<string, WealthSnapshot>()
  for (const s of snapshots) {
    const cur = latest.get(s.item_id)
    if (!cur || byNewest(s, cur) < 0) latest.set(s.item_id, s)
  }
  return latest
}

/** "Today", "Oct 3", or "Oct 3, 2025" when it isn't this year. */
export function formatRecordedOn(dateStr: string, todayStr: string): string {
  if (dateStr === todayStr) return 'Today'
  const date = parseISO(dateStr)
  const sameYear = dateStr.slice(0, 4) === todayStr.slice(0, 4)
  return format(date, sameYear ? 'MMM d' : 'MMM d, yyyy')
}

// ----------------------------------------------------------------- values

export type ItemValue = {
  item: WealthItem
  /** Latest snapshot; null for an item that has no balance yet. */
  snapshot: WealthSnapshot | null
  /** Current value in NIS; null when there's no snapshot or its currency's rate is unknown. */
  ils: number | null
}

export function itemValues(items: WealthItem[], snapshots: WealthSnapshot[], rates: IlsRates): ItemValue[] {
  const latest = latestSnapshots(snapshots)
  return items.map(item => {
    const snapshot = latest.get(item.id) ?? null
    return { item, snapshot, ils: snapshot ? toIls(snapshot.balance, snapshot.currency, rates) : null }
  })
}

export function filterByOwner(values: ItemValue[], owner: OwnerFilter): ItemValue[] {
  return owner === 'all' ? values : values.filter(v => v.item.owner === owner)
}

export function sumIls(values: ItemValue[]): number {
  return values.reduce((sum, v) => sum + (v.ils ?? 0), 0)
}

export function totalsByOwner(values: ItemValue[]): Record<WealthOwner, number> {
  const totals: Record<WealthOwner, number> = { ophir: 0, yael: 0, shared: 0 }
  for (const v of values) totals[v.item.owner] += v.ils ?? 0
  return totals
}

/** Items that have a balance but can't be converted to NIS (exchange rate missing). */
export function unconvertedCount(values: ItemValue[]): number {
  return values.filter(v => v.snapshot && v.ils === null).length
}

export type CategoryGroup = { category: WealthCategory; values: ItemValue[]; subtotal: number }

/** Groups by category in the built-in order (empty groups dropped); biggest first within a group. */
export function groupByCategory(values: ItemValue[]): CategoryGroup[] {
  return WEALTH_CATEGORIES
    .map(category => {
      const inGroup = values
        .filter(v => categoryOf(v.item.category).key === category.key)
        .sort((a, b) => (b.ils ?? -Infinity) - (a.ils ?? -Infinity) || a.item.name.localeCompare(b.item.name))
      return { category, values: inGroup, subtotal: sumIls(inGroup) }
    })
    .filter(g => g.values.length > 0)
}

// ------------------------------------------------------------------ goals

export type GoalProgress = {
  /** NIS wealth currently in the goal's owner scope. */
  current: number
  /** 0-100, capped. */
  pct: number
  remaining: number
  reached: boolean
  /** Calendar days until the target date (negative when overdue); null without a date. */
  daysLeft: number | null
}

export function goalProgress(goal: WealthGoal, values: ItemValue[], todayStr: string): GoalProgress {
  const current = sumIls(values.filter(v => goal.scope.includes(v.item.owner)))
  const pct = Math.min(100, Math.max(0, (current / goal.target_amount) * 100))
  return {
    current,
    pct,
    remaining: Math.max(0, goal.target_amount - current),
    reached: current >= goal.target_amount,
    daysLeft: goal.target_date ? differenceInCalendarDays(parseISO(goal.target_date), parseISO(todayStr)) : null,
  }
}

function formatSpan(days: number): string {
  if (days < 60) return `${days} day${days === 1 ? '' : 's'}`
  if (days < 730) return `${Math.round(days / 30.44)} months`
  return `${(days / 365.25).toFixed(1).replace(/\.0$/, '')} years`
}

export function describeDaysLeft(daysLeft: number): string {
  if (daysLeft < 0) return `Overdue by ${formatSpan(-daysLeft)}`
  if (daysLeft === 0) return 'Due today'
  return `${formatSpan(daysLeft)} left`
}

/** Soonest target date first; goals without a date last, oldest first. */
export function sortGoals(goals: WealthGoal[]): WealthGoal[] {
  return [...goals].sort((a, b) => {
    if (a.target_date && b.target_date) return a.target_date.localeCompare(b.target_date)
    if (a.target_date) return -1
    if (b.target_date) return 1
    return a.created_at.localeCompare(b.created_at)
  })
}

// ------------------------------------------------------------------ trend

export type NetWorthPoint = { date: string; total: number }

/**
 * Total NIS wealth at each date any in-scope item was updated: for every item,
 * its latest snapshot on or before that date (carried forward between updates).
 * Everything is converted at *today's* rates, so the series is consistent and
 * its last point equals the headline total. Items with no known rate are skipped.
 */
export function buildNetWorthSeries(
  items: WealthItem[],
  snapshots: WealthSnapshot[],
  rates: IlsRates,
  owner: OwnerFilter,
): NetWorthPoint[] {
  const inScope = new Set(items.filter(i => owner === 'all' || i.owner === owner).map(i => i.id))
  const perItem = new Map<string, WealthSnapshot[]>()
  for (const s of snapshots) {
    if (!inScope.has(s.item_id)) continue
    const list = perItem.get(s.item_id)
    if (list) list.push(s)
    else perItem.set(s.item_id, [s])
  }
  for (const list of perItem.values()) list.sort((a, b) => a.recorded_on.localeCompare(b.recorded_on))

  const dates = [...new Set([...perItem.values()].flatMap(list => list.map(s => s.recorded_on)))].sort()
  const cursor = new Map<string, number>() // index of each item's latest snapshot so far

  return dates.map(date => {
    let total = 0
    for (const [itemId, list] of perItem) {
      let idx = cursor.get(itemId) ?? -1
      while (idx + 1 < list.length && list[idx + 1].recorded_on <= date) idx++
      cursor.set(itemId, idx)
      if (idx >= 0) total += toIls(list[idx].balance, list[idx].currency, rates) ?? 0
    }
    return { date, total }
  })
}

// ------------------------------------------------------------- validation

export function isItemValid({ name, balance }: { name: string; balance: string }): boolean {
  return name.trim().length > 0 && parseAmount(balance) !== null
}

export function isGoalValid({ name, target }: { name: string; target: string }): boolean {
  const amount = parseAmount(target)
  return name.trim().length > 0 && amount !== null && amount > 0
}
