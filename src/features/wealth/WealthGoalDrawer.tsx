import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { supabase } from '../../supabase'
import type { WealthGoal, WealthItem, WealthOwner } from '../../supabase'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
import { haptic } from '../../lib/haptics'
import { ScopePicker } from './WealthPickers'
import { OWNER_LABELS, WEALTH_OWNERS, isGoalValid, parseAmount, toggleScope } from './wealth'

type Props = {
  open: boolean
  onClose: () => void
  userId: string
  /** null = creating a new goal. */
  goal: WealthGoal | null
  /** Scope a new goal starts with (the owner filter on screen, else everyone). */
  defaultScope: WealthOwner[]
  /** Accounts a goal can be tied to. */
  items: WealthItem[]
  onSaved: () => void
}

// Radix Select can't use an empty string as an item value.
const POOLED = 'pooled'

export default function WealthGoalDrawer({ open, onClose, userId, goal, defaultScope, items, onSaved }: Props) {
  const [name, setName] = useState(goal?.name ?? '')
  const [target, setTarget] = useState(goal ? String(goal.target_amount) : '')
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? '')
  const [scope, setScope] = useState<WealthOwner[]>(goal?.scope ?? defaultScope)
  const [itemId, setItemId] = useState<string | null>(goal?.item_id ?? null)
  const [notes, setNotes] = useState(goal?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const valid = isGoalValid({ name, target })
  const sortedItems = [...items].sort((a, b) => a.name.localeCompare(b.name))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseAmount(target)
    if (!valid || amount === null || saving) return
    setSaving(true)
    setError(null)
    const fields = {
      name: name.trim(),
      target_amount: amount,
      target_date: targetDate || null,
      scope,
      item_id: itemId,
      notes: notes.trim() || null,
    }
    const { error } = goal
      ? await supabase.from('wealth_goals').update(fields).eq('id', goal.id)
      : await supabase.from('wealth_goals').insert({ user_id: userId, ...fields })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    haptic('success')
    onSaved()
    onClose()
  }

  async function handleDelete() {
    if (!goal) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setError(null)
    const { error } = await supabase.from('wealth_goals').delete().eq('id', goal.id)
    if (error) {
      setConfirmDelete(false)
      setError(error.message)
      return
    }
    onSaved()
    onClose()
  }

  return (
    <Drawer open={open} onOpenChange={v => !v && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{goal ? 'Edit goal' : 'New goal'}</DrawerTitle>
        </DrawerHeader>
        <form onSubmit={handleSubmit}>
          <DrawerBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="goal-name">Goal</Label>
              <Input
                id="goal-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Apartment down payment"
                maxLength={120}
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="goal-target">Target (₪)</Label>
              <Input
                id="goal-target"
                inputMode="decimal"
                value={target}
                onChange={e => setTarget(e.target.value)}
                placeholder="1,000,000"
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label>Track progress from</Label>
              <Select value={itemId ?? POOLED} onValueChange={v => setItemId(v === POOLED ? null : v)}>
                <SelectTrigger className="h-11 rounded-xl" aria-label="Account to track">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value={POOLED}>All wealth, by owner</SelectItem>
                  {sortedItems.map(i => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name} · {OWNER_LABELS[i.owner]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {itemId ? (
                <p className="text-xs text-muted-foreground">Progress follows this account's balance, converted to ₪.</p>
              ) : (
                <>
                  <ScopePicker value={scope} onToggle={owner => setScope(s => toggleScope(s, owner))} />
                  <p className="text-xs text-muted-foreground">
                    Progress is your total wealth for the owners selected
                    {scope.length === WEALTH_OWNERS.length ? ' (everyone)' : ''}.
                  </p>
                </>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="goal-date">Target date (optional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="goal-date"
                  type="date"
                  value={targetDate}
                  onChange={e => setTargetDate(e.target.value)}
                  className="h-11 flex-1 rounded-xl"
                />
                {targetDate && (
                  <Button type="button" variant="ghost" onClick={() => setTargetDate('')}>
                    Clear
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="goal-notes">Notes (optional)</Label>
              <Textarea
                id="goal-notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
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
              {saving ? 'Saving…' : goal ? 'Save goal' : 'Add goal'}
            </Button>

            {goal && (
              <Button
                type="button"
                variant={confirmDelete ? 'destructive' : 'outline'}
                onClick={handleDelete}
                onBlur={() => setConfirmDelete(false)}
                className="h-11 w-full rounded-xl"
              >
                <Trash2 className="h-4 w-4" />
                {confirmDelete ? 'Tap again to delete this goal' : 'Delete goal'}
              </Button>
            )}
          </DrawerBody>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
