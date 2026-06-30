import { useState } from 'react'
import { supabase } from '../../supabase'
import { today } from '../../utils'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
import { haptic } from '../../lib/haptics'

type Props = {
  open: boolean
  onClose: () => void
  onSave: () => void
  friendId: string
  userId: string
}

export default function LogInteractionDrawer({ open, onClose, onSave, friendId, userId }: Props) {
  const [date, setDate] = useState(today())
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('friend_interactions').insert({
      friend_id: friendId,
      user_id: userId,
      interaction_date: date,
      note: note.trim() || null,
    })
    haptic('success')
    setSaving(false)
    setNote('')
    setDate(today())
    onSave()
    onClose()
  }

  return (
    <Drawer open={open} onOpenChange={onClose}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Log Interaction</DrawerTitle>
        </DrawerHeader>
        <form onSubmit={handleSubmit}>
          <DrawerBody className="space-y-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={date}
                max={today()}
                onChange={e => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
              <Input
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? 'Saving…' : 'Log'}
            </Button>
          </DrawerBody>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
