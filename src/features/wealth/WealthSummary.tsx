import { OWNER_LABELS, WEALTH_OWNERS, formatMoneyRounded } from './wealth'
import type { OwnerFilter } from './wealth'
import type { WealthOwner } from '../../supabase'
import { cn } from '../../utils'

type Props = {
  owner: OwnerFilter
  total: number
  byOwner: Record<WealthOwner, number>
  /** False while exchange rates are still loading and foreign balances can't be totalled yet. */
  ready: boolean
}

export default function WealthSummary({ owner, total, byOwner, ready }: Props) {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div>
        <p className="text-xs font-medium text-muted-foreground">
          {owner === 'all' ? 'Total wealth' : `${OWNER_LABELS[owner]}'s wealth`}
        </p>
        {ready ? (
          <p className="text-3xl font-bold tabular-nums">{formatMoneyRounded(total)}</p>
        ) : (
          <div className="mt-1 h-9 w-40 animate-pulse rounded bg-muted" />
        )}
      </div>

      {owner === 'all' && (
        <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
          {WEALTH_OWNERS.map(o => (
            <div key={o} className="min-w-0">
              <p className="text-xs text-muted-foreground">{OWNER_LABELS[o]}</p>
              <p className={cn('truncate text-sm font-semibold tabular-nums', !ready && 'text-muted-foreground')}>
                {ready ? formatMoneyRounded(byOwner[o]) : '—'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
