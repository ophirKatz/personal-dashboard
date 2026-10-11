import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import type { MealTag } from '../../supabase'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
import { haptic } from '../../lib/haptics'
import MealTagPicker from './MealTagPicker'

type Props = {
  open: boolean
  onClose: () => void
  userId: string
  /** Prefilled from the list's active tag filter, so the new meal shows up where you are. */
  defaultTags: MealTag[]
}

// Quick add: a name and tags. The new meal's profile page opens next, where the
// photo, description and recipe link are filled in.
export default function AddMealDrawer({ open, onClose, userId, defaultTags }: Props) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [tags, setTags] = useState<MealTag[]>(defaultTags)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    setError(null)
    const { data, error } = await supabase
      .from('meals')
      .insert({ user_id: userId, name: name.trim(), tags })
      .select('id')
      .single()
    setSaving(false)
    if (error || !data) {
      setError(error?.message ?? 'Could not add the meal.')
      return
    }
    haptic('success')
    onClose()
    navigate(`/meals/${data.id}`)
  }

  return (
    <Drawer open={open} onOpenChange={v => !v && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>New meal</DrawerTitle>
        </DrawerHeader>
        <form onSubmit={handleSubmit}>
          <DrawerBody className="space-y-4">
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="What do you make?"
              autoFocus
              className="h-12 rounded-xl text-base"
            />
            <div className="space-y-2">
              <p className="px-1 text-xs font-medium text-muted-foreground">Good for</p>
              <MealTagPicker value={tags} onChange={setTags} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="submit"
              disabled={saving || !name.trim()}
              onMouseDown={e => e.preventDefault()}
              className="h-12 w-full rounded-xl text-base font-semibold"
            >
              {saving ? 'Adding…' : 'Add meal'}
            </Button>
          </DrawerBody>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
