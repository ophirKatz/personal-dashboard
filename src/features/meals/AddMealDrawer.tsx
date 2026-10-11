import { useState } from 'react'
import { supabase } from '../../supabase'
import type { MealTag } from '../../supabase'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
import { haptic } from '../../lib/haptics'
import MealTagPicker from './MealTagPicker'
import { isMealValid } from './meals'

type Props = {
  open: boolean
  onClose: () => void
  userId: string
  /** Prefilled from the list's active tag filter, so the new meal shows up where you are. */
  defaultTags: MealTag[]
  /** Called after the meal is saved, with what was added, so the grid can refresh. */
  onAdded: (meal: { name: string; tags: MealTag[] }) => void
}

// Quick add: a name and tags. The drawer closes back onto the grid; the photo,
// description and recipe link are filled in later from the meal's profile page.
export default function AddMealDrawer({ open, onClose, userId, defaultTags, onAdded }: Props) {
  const [name, setName] = useState('')
  const [tags, setTags] = useState<MealTag[]>(defaultTags)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const valid = isMealValid({ name, tags })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || saving) return
    setSaving(true)
    setError(null)
    const added = { name: name.trim(), tags }
    const { error } = await supabase.from('meals').insert({ user_id: userId, ...added })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    haptic('success')
    onClose()
    onAdded(added)
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
              {tags.length === 0 && <p className="px-1 text-xs text-muted-foreground">Pick at least one tag</p>}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="submit"
              disabled={saving || !valid}
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
