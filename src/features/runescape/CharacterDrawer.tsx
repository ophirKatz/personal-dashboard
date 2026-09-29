import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import type { RsCharacter } from '../../supabase'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'

type Props = {
  open: boolean
  onClose: () => void
  onSaved: (id?: string) => void
  userId: string
  /** Existing character to rename/remove; omitted when adding. */
  character?: RsCharacter
  canDelete: boolean
}

// RuneScape display names: 1-12 letters, digits, spaces, hyphens, underscores.
const NAME_RE = /^[A-Za-z0-9 _-]{1,12}$/

export default function CharacterDrawer({ open, onClose, onSaved, userId, character, canDelete }: Props) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) { setName(character?.name ?? ''); setError(null) }
  }, [open, character])

  const trimmed = name.trim()
  const valid = NAME_RE.test(trimmed)

  async function save() {
    if (!valid) return
    setSaving(true)
    setError(null)
    const res = character
      ? await supabase.from('rs_characters').update({ name: trimmed }).eq('id', character.id).select('id').single()
      : await supabase.from('rs_characters').insert({ name: trimmed, user_id: userId }).select('id').single()
    setSaving(false)
    if (res.error) {
      setError(res.error.code === '23505' ? 'You already track a character with that name.' : 'Could not save the character.')
      return
    }
    onSaved(res.data.id)
    onClose()
  }

  async function remove() {
    if (!character) return
    if (!confirm(`Remove ${character.name} and all of its goals?`)) return
    const { error } = await supabase.from('rs_characters').delete().eq('id', character.id)
    if (error) { setError('Could not remove the character.'); return }
    onSaved()
    onClose()
  }

  return (
    <Drawer open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DrawerContent>
        <DrawerHeader><DrawerTitle>{character ? 'Edit character' : 'Add character'}</DrawerTitle></DrawerHeader>
        <DrawerBody className="space-y-4">
          <div className="space-y-1.5">
            <Label>RuneScape 3 display name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} maxLength={12} autoCapitalize="off" autoCorrect="off" />
            {trimmed && !valid && <p className="text-xs text-destructive">Up to 12 letters, numbers, spaces, hyphens or underscores.</p>}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full h-11 rounded-xl" onClick={save} disabled={!valid || saving}>
            {saving ? 'Saving…' : character ? 'Save' : 'Add character'}
          </Button>
          {character && canDelete && (
            <Button variant="ghost" className="w-full text-destructive hover:text-destructive" onClick={remove}>
              Remove character
            </Button>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
