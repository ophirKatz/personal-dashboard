import { useRef, useState } from 'react'
import { supabase } from '../../supabase'
import type { ShoppingItem } from '../../supabase'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
import { haptic } from '../../lib/haptics'

type Props = {
  open: boolean
  onClose: () => void
  onSave: () => void
  item?: ShoppingItem
  userId: string
}

export default function ShoppingItemDrawer({ open, onClose, onSave, item, userId }: Props) {
  const [name, setName] = useState(item?.name ?? '')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    if (item) {
      await supabase.from('shopping_items').update({ name: name.trim() }).eq('id', item.id)
    } else {
      await supabase.from('shopping_items').insert({ name: name.trim(), user_id: userId })
    }
    haptic('success')
    setSaving(false)
    onSave()
    if (item) {
      onClose()
    } else {
      setName('')
      inputRef.current?.focus()
    }
  }

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{item ? 'Edit item' : 'New item'}</DrawerTitle>
        </DrawerHeader>
        <form onSubmit={handleSubmit}>
          <DrawerBody className="space-y-4">
            <Input
              ref={inputRef}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="What do you need?"
              autoFocus
              className="h-12 rounded-xl text-base"
            />
            <Button type="submit" disabled={saving || !name.trim()} className="h-12 w-full rounded-xl text-base font-semibold">
              {saving ? 'Saving…' : item ? 'Save' : 'Add item'}
            </Button>
          </DrawerBody>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
