import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import type { FriendInteraction } from '../../supabase'
import { today } from '../../utils'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
import { haptic } from '../../lib/haptics'

type Props = {
  open: boolean
  onClose: () => void
  onSave: () => void
  friendId: string
  userId: string
  interaction?: FriendInteraction
}

export default function LogInteractionDrawer({ open, onClose, onSave, friendId, userId, interaction }: Props) {
  const [date, setDate] = useState(interaction?.interaction_date ?? today())
  const [note, setNote] = useState(interaction?.note ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setDate(interaction?.interaction_date ?? today())
      setNote(interaction?.note ?? '')
    }
  }, [open, interaction])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      friend_id: friendId,
      user_id: userId,
      interaction_date: date,
      note: note.trim() || null,
    }
    if (interaction) {
      await supabase.from('friend_interactions').update(payload).eq('id', interaction.id).eq('user_id', userId)
    } else {
      await supabase.from('friend_interactions').insert(payload)
    }
    haptic('success')
    setSaving(false)
    onSave()
    onClose()
  }

  return (
    <Drawer open={open} onOpenChange={onClose}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{interaction ? 'Edit Interaction' : 'Log Interaction'}</DrawerTitle>
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
              <Textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Optional"
                rows={3}
              />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? 'Saving…' : interaction ? 'Save' : 'Log'}
            </Button>
          </DrawerBody>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
