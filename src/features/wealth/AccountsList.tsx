import { StickyNote, Wallet } from 'lucide-react'
import type { WealthItem } from '../../supabase'
import { OwnerChip, categoryIcon } from './WealthPickers'
import { formatMoney, formatMoneyRounded, formatRecordedOn } from './wealth'
import type { CategoryGroup } from './wealth'

type Props = {
  groups: CategoryGroup[]
  /** Whether any account exists at all (vs. none matching the owner filter). */
  hasItems: boolean
  todayStr: string
  onOpen: (item: WealthItem) => void
}

export default function AccountsList({ groups, hasItems, todayStr, onOpen }: Props) {
  if (groups.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Wallet className="mx-auto mb-3 h-10 w-10" />
        <p className="font-medium">{hasItems ? 'Nothing here for this owner yet' : 'No accounts yet — tap + to add your first one'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {groups.map(({ category, values, subtotal }) => {
        const Icon = categoryIcon(category.key)
        // "₪0" would read as zero when really every balance here is waiting on an exchange rate.
        const withBalance = values.filter(v => v.snapshot)
        const subtotalUnknown = withBalance.length > 0 && withBalance.every(v => v.ils === null)
        return (
          <section key={category.key} className="space-y-2">
            <div className="flex items-baseline justify-between px-1">
              <h2 className="text-sm font-semibold text-muted-foreground">{category.label}</h2>
              <span className="text-sm font-medium tabular-nums text-muted-foreground">{subtotalUnknown ? '—' : formatMoneyRounded(subtotal)}</span>
            </div>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {values.map(({ item, snapshot, ils }) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(item)}
                    className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-accent/50"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium leading-tight">{item.name}</p>
                        <OwnerChip owner={item.owner} className="shrink-0" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {snapshot ? `Updated ${formatRecordedOn(snapshot.recorded_on, todayStr)}` : 'No balance yet'}
                      </p>
                      {item.notes && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <StickyNote className="h-3 w-3 shrink-0" aria-label="Has notes" />
                          <span className="truncate">{item.notes}</span>
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      {snapshot ? (
                        <>
                          <p className="font-semibold tabular-nums">{formatMoney(snapshot.balance, snapshot.currency)}</p>
                          {snapshot.currency !== 'ils' && (
                            <p className="text-xs tabular-nums text-muted-foreground">
                              {ils !== null ? `≈ ${formatMoneyRounded(ils)}` : 'rate unavailable'}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">—</p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
