import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { supabase } from '../../supabase'
import type { WealthItem, WealthOwner, WealthSnapshot } from '../../supabase'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
import { haptic } from '../../lib/haptics'
import { today } from '../../utils'
import { CategoryPicker, CurrencySelect, OwnerChip, OwnerPicker } from './WealthPickers'
import { formatMoney, formatMoneyRounded, formatRecordedOn, parseAmount, toIls } from './wealth'
import type { IlsRates } from './wealth'

type Props = {
  open: boolean
  onClose: () => void
  userId: string
  item: WealthItem
  /** This item's snapshots, newest first. The first one is its current balance. */
  snapshots: WealthSnapshot[]
  rates: IlsRates
  /** Called after any change so the page can reload. */
  onChanged: () => void
}

export default function EditItemDrawer({ open, onClose, userId, item, snapshots, rates, onChanged }: Props) {
  const current = snapshots[0] ?? null

  // Details
  const [name, setName] = useState(item.name)
  const [category, setCategory] = useState(item.category)
  const [owner, setOwner] = useState<WealthOwner>(item.owner)
  const [notes, setNotes] = useState(item.notes ?? '')
  const [savingDetails, setSavingDetails] = useState(false)

  // New balance
  const [balance, setBalance] = useState('')
  const [currency, setCurrency] = useState(current?.currency ?? 'ils')
  const [date, setDate] = useState(today())
  const [savingBalance, setSavingBalance] = useState(false)

  // Two-step deletes: the first tap arms, the second confirms.
  const [confirming, setConfirming] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const detailsChanged =
    name.trim() !== item.name || category !== item.category || owner !== item.owner || notes.trim() !== (item.notes ?? '')
  const detailsValid = name.trim().length > 0
  const amount = parseAmount(balance)
  const balanceValid = amount !== null && date !== '' && date <= today()

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault()
    if (!detailsValid || !detailsChanged || savingDetails) return
    setSavingDetails(true)
    setError(null)
    const { error } = await supabase
      .from('wealth_items')
      .update({ name: name.trim(), category, owner, notes: notes.trim() || null })
      .eq('id', item.id)
    setSavingDetails(false)
    if (error) {
      setError(error.message)
      return
    }
    haptic('success')
    onChanged()
    onClose()
  }

  async function saveBalance(e: React.FormEvent) {
    e.preventDefault()
    if (!balanceValid || amount === null || savingBalance) return
    setSavingBalance(true)
    setError(null)
    // One row per item per day: saving twice on the same date overwrites, and a
    // past date backfills history.
    const { error } = await supabase
      .from('wealth_snapshots')
      .upsert(
        { user_id: userId, item_id: item.id, recorded_on: date, balance: amount, currency },
        { onConflict: 'item_id,recorded_on' },
      )
    setSavingBalance(false)
    if (error) {
      setError(error.message)
      return
    }
    haptic('success')
    setBalance('')
    setDate(today())
    onChanged()
  }

  async function deleteSnapshot(id: string) {
    if (confirming !== `snapshot:${id}`) {
      setConfirming(`snapshot:${id}`)
      return
    }
    setError(null)
    const { error } = await supabase.from('wealth_snapshots').delete().eq('id', id)
    setConfirming(null)
    if (error) setError(error.message)
    else onChanged()
  }

  async function deleteItem() {
    if (confirming !== 'item') {
      setConfirming('item')
      return
    }
    setError(null)
    const { error } = await supabase.from('wealth_items').delete().eq('id', item.id)
    if (error) {
      setConfirming(null)
      setError(error.message)
      return
    }
    onChanged()
    onClose()
  }

  return (
    <Drawer open={open} onOpenChange={v => !v && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <span className="truncate">{item.name}</span>
            <OwnerChip owner={item.owner} />
          </DrawerTitle>
        </DrawerHeader>
        <DrawerBody className="space-y-6">
          {/* Update balance */}
          <form onSubmit={saveBalance} className="space-y-3 rounded-xl border border-border p-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="wealth-new-balance">Update balance</Label>
              {current && (
                <span className="text-xs text-muted-foreground">
                  Now {formatMoney(current.balance, current.currency)}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                id="wealth-new-balance"
                inputMode="decimal"
                value={balance}
                onChange={e => setBalance(e.target.value)}
                placeholder="New balance"
                className="h-11 flex-1 rounded-xl"
              />
              <CurrencySelect value={currency} onChange={setCurrency} className="h-11 rounded-xl" />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="wealth-new-date" className="shrink-0 text-xs font-normal text-muted-foreground">
                As of
              </Label>
              <Input
                id="wealth-new-date"
                type="date"
                value={date}
                max={today()}
                onChange={e => setDate(e.target.value)}
                className="h-10 flex-1 rounded-xl"
              />
            </div>
            <Button type="submit" disabled={!balanceValid || savingBalance} className="h-11 w-full rounded-xl">
              {savingBalance ? 'Saving…' : 'Save balance'}
            </Button>
          </form>

          {/* Details */}
          <form onSubmit={saveDetails} className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <CategoryPicker value={category} onChange={setCategory} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wealth-edit-name">Name</Label>
              <Input
                id="wealth-edit-name"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={120}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Owner</Label>
              <OwnerPicker value={owner} onChange={setOwner} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wealth-edit-notes">Notes</Label>
              <Textarea
                id="wealth-edit-notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Fund track, account number, anything worth remembering"
                rows={3}
                className="rounded-xl"
              />
            </div>
            <Button
              type="submit"
              variant="secondary"
              disabled={!detailsValid || !detailsChanged || savingDetails}
              className="h-11 w-full rounded-xl"
            >
              {savingDetails ? 'Saving…' : 'Save details'}
            </Button>
          </form>

          {/* History */}
          {snapshots.length > 0 && (
            <div className="space-y-2">
              <Label>History</Label>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {snapshots.map(s => {
                  const ils = s.currency !== 'ils' ? toIls(s.balance, s.currency, rates) : null
                  const armed = confirming === `snapshot:${s.id}`
                  return (
                    <li key={s.id} className="flex items-center gap-2 px-3 py-2.5 text-sm">
                      <span className="w-24 shrink-0 text-muted-foreground">{formatRecordedOn(s.recorded_on, today())}</span>
                      <span className="min-w-0 flex-1 font-medium">
                        {formatMoney(s.balance, s.currency)}
                        {ils !== null && <span className="ml-1.5 text-xs font-normal text-muted-foreground">≈ {formatMoneyRounded(ils)}</span>}
                      </span>
                      {snapshots.length > 1 &&
                        (armed ? (
                          <button
                            type="button"
                            onClick={() => deleteSnapshot(s.id)}
                            onBlur={() => setConfirming(null)}
                            className="rounded-lg bg-destructive px-2.5 py-1 text-xs font-medium text-destructive-foreground"
                          >
                            Delete?
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => deleteSnapshot(s.id)}
                            aria-label={`Delete the ${formatRecordedOn(s.recorded_on, today())} entry`}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ))}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            type="button"
            variant={confirming === 'item' ? 'destructive' : 'outline'}
            onClick={deleteItem}
            onBlur={() => setConfirming(null)}
            className="h-11 w-full rounded-xl"
          >
            <Trash2 className="h-4 w-4" />
            {confirming === 'item' ? 'Tap again to delete the account and its history' : 'Delete account'}
          </Button>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
