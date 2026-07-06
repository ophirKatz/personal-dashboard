import { useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '../../supabase'
import type { RecipeCollection } from '../../supabase'
import { Checkbox } from '../../components/ui/checkbox'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'

type Props = {
  collections: RecipeCollection[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onCreated: (collection: RecipeCollection) => void
  userId: string
}

export default function CollectionPicker({ collections, selectedIds, onToggle, onCreated, userId }: Props) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function createCollection(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const { data } = await supabase
      .from('recipe_collections')
      .insert({ user_id: userId, name: name.trim() })
      .select()
      .single()
    setSaving(false)
    setName('')
    setAdding(false)
    if (data) onCreated(data)
  }

  return (
    <div className="space-y-2">
      {collections.map(collection => (
        <label key={collection.id} className="flex items-center gap-2.5 py-1 cursor-pointer">
          <Checkbox checked={selectedIds.has(collection.id)} onCheckedChange={() => onToggle(collection.id)} />
          <span>{collection.emoji} {collection.name}</span>
        </label>
      ))}

      {adding ? (
        <form onSubmit={createCollection} className="flex items-center gap-2 pt-1">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Collection name" autoFocus className="flex-1" />
          <Button type="submit" size="sm" disabled={saving || !name.trim()}>Add</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => { setAdding(false); setName('') }}>Cancel</Button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground pt-1"
        >
          <Plus className="h-3.5 w-3.5" /> New collection
        </button>
      )}
    </div>
  )
}
