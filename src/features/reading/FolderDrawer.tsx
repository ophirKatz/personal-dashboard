import { useState } from 'react'
import { supabase } from '../../supabase'
import type { ReadingFolder } from '../../supabase'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
import { haptic } from '../../lib/haptics'

type Props = {
  open: boolean
  onClose: () => void
  onSave: () => void
  /** Existing folder to rename; omit to create. */
  folder?: ReadingFolder
  parentId: string | null
  userId: string
}

export default function FolderDrawer({ open, onClose, onSave, folder, parentId, userId }: Props) {
  const [name, setName] = useState(folder?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    const { error } = folder
      ? await supabase.from('reading_folders').update({ name: name.trim() }).eq('id', folder.id)
      : await supabase.from('reading_folders').insert({ name: name.trim(), parent_id: parentId, user_id: userId })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    haptic('success')
    onSave()
    onClose()
  }

  return (
    <Drawer open={open} onOpenChange={v => !v && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{folder ? 'Rename folder' : 'New folder'}</DrawerTitle>
        </DrawerHeader>
        <form onSubmit={handleSubmit}>
          <DrawerBody className="space-y-4">
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Folder name"
              autoFocus
              className="h-12 rounded-xl text-base"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="submit"
              disabled={saving || !name.trim()}
              onMouseDown={e => e.preventDefault()}
              className="h-12 w-full rounded-xl text-base font-semibold"
            >
              {saving ? 'Saving…' : folder ? 'Save' : 'Create folder'}
            </Button>
          </DrawerBody>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
