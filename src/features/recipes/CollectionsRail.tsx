import { useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '../../supabase'
import type { RecipeCollection } from '../../supabase'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../../components/ui/dialog'

type Props = {
  collections: RecipeCollection[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onCreated: () => void
  userId: string
}

export default function CollectionsRail({ collections, selectedId, onSelect, onCreated, userId }: Props) {
  const [newOpen, setNewOpen] = useState(false)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🍽️')
  const [saving, setSaving] = useState(false)

  async function createCollection(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await supabase.from('recipe_collections').insert({
      user_id: userId,
      name: name.trim(),
      emoji: emoji.trim() || '🍽️',
    })
    setSaving(false)
    setName('')
    setEmoji('🍽️')
    setNewOpen(false)
    onCreated()
  }

  if (collections.length === 0) return null

  return (
    <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4">
      {collections.map(collection => (
        <button
          key={collection.id}
          onClick={() => onSelect(selectedId === collection.id ? null : collection.id)}
          className={`flex flex-col items-center justify-center gap-1.5 shrink-0 w-24 h-24 rounded-2xl border transition-colors ${
            selectedId === collection.id ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-accent'
          }`}
        >
          <span className="text-2xl">{collection.emoji}</span>
          <span className="text-xs font-medium truncate max-w-[5rem]">{collection.name}</span>
        </button>
      ))}
      <button
        onClick={() => setNewOpen(true)}
        className="flex flex-col items-center justify-center gap-1.5 shrink-0 w-24 h-24 rounded-2xl border border-dashed border-border text-muted-foreground hover:bg-accent"
      >
        <Plus className="h-5 w-5" />
        <span className="text-xs font-medium">New</span>
      </button>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New collection</DialogTitle></DialogHeader>
          <form onSubmit={createCollection}>
            <DialogBody className="flex gap-3">
              <Input value={emoji} onChange={e => setEmoji(e.target.value)} className="w-16 text-center text-lg" maxLength={4} />
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Baking" autoFocus className="flex-1" />
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || !name.trim()}>{saving ? 'Saving…' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
