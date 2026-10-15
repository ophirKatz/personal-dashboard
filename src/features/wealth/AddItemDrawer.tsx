import { useState } from 'react'
import { supabase } from '../../supabase'
import type { WealthOwner } from '../../supabase'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
import { haptic } from '../../lib/haptics'
import { today } from '../../utils'
import { CategoryPicker, CurrencySelect, OwnerPicker } from './WealthPickers'
import { categoryOf, isItemValid, parseAmount } from './wealth'

type Props = {
  open: boolean
  onClose: () => void
  userId: string
  /** The owner filter currently on screen, so the new account lands where you're looking. */
  defaultOwner: WealthOwner
  /** `warning` is set when the account was saved but its first balance wasn't. */
  onSaved: (warning?: string) => void
}

export default function AddItemDrawer({ open, onClose, userId, defaultOwner, onSaved }: Props) {
  const [category, setCategory] = useState('bank')
  const [name, setName] = useState('')
  const [owner, setOwner] = useState<WealthOwner>(defaultOwner)
  const [balance, setBalance] = useState('')
  const [currency, setCurrency] = useState('ils')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const valid = isItemValid({ name, balance })

  // Tapping a built-in type prefills the name - but never clobbers one you typed.
  function pickCategory(key: string) {
    const prevDefault = categoryOf(category).defaultName
    setCategory(key)
    if (name.trim() === '' || name === prevDefault) setName(categoryOf(key).defaultName)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseAmount(balance)
    if (!valid || amount === null || saving) return
    setSaving(true)
    setError(null)

    const { data: created, error: itemError } = await supabase
      .from('wealth_items')
      .insert({ user_id: userId, name: name.trim(), category, owner, notes: notes.trim() || null })
      .select()
      .single()
    if (itemError || !created) {
      setSaving(false)
      setError(itemError?.message ?? 'Could not save the account')
      return
    }

    const { error: snapshotError } = await supabase
      .from('wealth_snapshots')
      .insert({ user_id: userId, item_id: created.id, recorded_on: today(), balance: amount, currency })
    setSaving(false)
    haptic('success')
    onClose()
    // The account exists either way; if only the balance failed it can be set from the account's own drawer.
    onSaved(snapshotError ? `Saved "${created.name}", but couldn't record its balance. Open it and use Update balance.` : undefined)
  }

  return (
    <Drawer open={open} onOpenChange={v => !v && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>New account</DrawerTitle>
        </DrawerHeader>
        <form onSubmit={handleSubmit}>
          <DrawerBody className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <CategoryPicker value={category} onChange={pickCategory} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wealth-name">Name</Label>
              <Input
                id="wealth-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Leumi checking, Migdal pension"
                maxLength={120}
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label>Owner</Label>
              <OwnerPicker value={owner} onChange={setOwner} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wealth-balance">Current balance</Label>
              <div className="flex gap-2">
                <Input
                  id="wealth-balance"
                  inputMode="decimal"
                  value={balance}
                  onChange={e => setBalance(e.target.value)}
                  placeholder="0"
                  className="h-11 flex-1 rounded-xl"
                />
                <CurrencySelect value={currency} onChange={setCurrency} className="h-11 rounded-xl" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wealth-notes">Notes (optional)</Label>
              <Textarea
                id="wealth-notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Fund track, account number, anything worth remembering"
                rows={3}
                className="rounded-xl"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="submit"
              disabled={saving || !valid}
              onMouseDown={e => e.preventDefault()}
              className="h-12 w-full rounded-xl text-base font-semibold"
            >
              {saving ? 'Adding…' : 'Add account'}
            </Button>
          </DrawerBody>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
