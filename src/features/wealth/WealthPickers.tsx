import { Banknote, Bitcoin, GraduationCap, Hourglass, House, Landmark, PiggyBank, TrendingUp, Vault, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { WealthOwner } from '../../supabase'
import { cn } from '../../utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { CURRENCIES } from '../finance/currency'
import { OWNER_LABELS, WEALTH_CATEGORIES, WEALTH_OWNERS, categoryOf } from './wealth'

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  bank: Landmark,
  savings: PiggyBank,
  investment: TrendingUp,
  pension: Hourglass,
  study_fund: GraduationCap,
  provident_fund: Vault,
  crypto: Bitcoin,
  real_estate: House,
  cash: Banknote,
  other: Wallet,
}

export function categoryIcon(key: string): LucideIcon {
  return CATEGORY_ICONS[categoryOf(key).key]
}

const OWNER_STYLES: Record<WealthOwner, string> = {
  ophir: 'bg-sky-100 text-sky-700',
  yael: 'bg-rose-100 text-rose-700',
  shared: 'bg-emerald-100 text-emerald-700',
}

/** The Ophir / Yael / Shared tag shown on a card. */
export function OwnerChip({ owner, className }: { owner: WealthOwner; className?: string }) {
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium leading-none', OWNER_STYLES[owner], className)}>
      {OWNER_LABELS[owner]}
    </span>
  )
}

function pillClass(on: boolean) {
  return cn(
    'h-10 rounded-full border px-3 text-sm font-medium transition-colors',
    on
      ? 'border-primary bg-primary text-primary-foreground'
      : 'border-input bg-background text-muted-foreground hover:bg-accent',
  )
}

/** Pick exactly one owner (an account belongs to one of Ophir / Yael / Shared). */
export function OwnerPicker({ value, onChange }: { value: WealthOwner; onChange: (owner: WealthOwner) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Owner">
      {WEALTH_OWNERS.map(owner => (
        <button
          key={owner}
          type="button"
          aria-pressed={value === owner}
          onClick={() => onChange(owner)}
          className={pillClass(value === owner)}
        >
          {OWNER_LABELS[owner]}
        </button>
      ))}
    </div>
  )
}

/** Pick one or more owners (a goal counts wealth from every owner selected). */
export function ScopePicker({ value, onToggle }: { value: WealthOwner[]; onToggle: (owner: WealthOwner) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Whose wealth counts">
      {WEALTH_OWNERS.map(owner => (
        <button
          key={owner}
          type="button"
          aria-pressed={value.includes(owner)}
          onClick={() => onToggle(owner)}
          className={pillClass(value.includes(owner))}
        >
          {OWNER_LABELS[owner]}
        </button>
      ))}
    </div>
  )
}

/** The built-in account types. */
export function CategoryPicker({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Account type">
      {WEALTH_CATEGORIES.map(category => {
        const Icon = categoryIcon(category.key)
        const on = categoryOf(value).key === category.key
        return (
          <button
            key={category.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(category.key)}
            className={cn(pillClass(on), 'inline-flex items-center gap-1.5')}
          >
            <Icon className="h-3.5 w-3.5" />
            {category.label}
          </button>
        )
      })}
    </div>
  )
}

// Shekel first: it's the default and by far the most used.
const CURRENCY_OPTIONS = [...CURRENCIES].sort((a, b) => (a.code === 'ils' ? -1 : b.code === 'ils' ? 1 : 0))

export function CurrencySelect({ value, onChange, className }: { value: string; onChange: (code: string) => void; className?: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn('w-28 shrink-0', className)} aria-label="Currency">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {CURRENCY_OPTIONS.map(c => (
          <SelectItem key={c.code} value={c.code}>
            {c.flag} {c.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
