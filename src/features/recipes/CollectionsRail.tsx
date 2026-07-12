import { useState } from 'react'
import { Plus, Edit2, Trash2 } from 'lucide-react'
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🍽️')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

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

  async function updateCollection(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId || !name.trim()) return
    setSaving(true)
    await supabase.from('recipe_collections').update({
      name: name.trim(),
      emoji: emoji.trim() || '🍽️',
    }).eq('id', editingId)
    setSaving(false)
    setEditingId(null)
    setName('')
    setEmoji('🍽️')
    onCreated()
  }

  async function deleteCollection(id: string) {
    setDeleting(id)
    await supabase.from('recipe_collections').delete().eq('id', id)
    setDeleting(null)
    onCreated()
  }

  function openEditDialog(collection: RecipeCollection) {
    setEditingId(collection.id)
    setName(collection.name)
    setEmoji(collection.emoji)
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4">
      {collections.map(collection => (
        <div key={collection.id} className="relative shrink-0 group">
          <button
            onClick={() => onSelect(selectedId === collection.id ? null : collection.id)}
            className={`flex flex-col items-center justify-center gap-1.5 w-24 h-24 rounded-2xl border transition-colors ${
              selectedId === collection.id ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-accent'
            }`}
          >
            <span className="text-2xl">{collection.emoji}</span>
            <span className="text-xs font-medium truncate max-w-[5rem]">{collection.name}</span>
          </button>
          <div className="absolute top-1 right-1 gap-1 hidden group-hover:flex">
            <button
              onClick={() => openEditDialog(collection)}
              className="p-1 bg-white dark:bg-slate-900 rounded border border-border hover:bg-accent"
              aria-label="Edit collection"
            >
              <Edit2 className="h-3 w-3" />
            </button>
            <button
              onClick={() => deleteCollection(collection.id)}
              disabled={deleting === collection.id}
              className="p-1 bg-white dark:bg-slate-900 rounded border border-border hover:bg-destructive/20 hover:text-destructive"
              aria-label="Delete collection"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      ))}
      <button
        onClick={() => {
          setEditingId(null)
          setName('')
          setEmoji('🍽️')
          setNewOpen(true)
        }}
        className="flex flex-col items-center justify-center gap-1.5 shrink-0 w-24 h-24 rounded-2xl border border-dashed border-border text-muted-foreground hover:bg-accent"
      >
        <Plus className="h-5 w-5" />
        <span className="text-xs font-medium">New</span>
      </button>

      <Dialog open={newOpen || editingId !== null} onOpenChange={(open) => {
        if (!open) {
          setNewOpen(false)
          setEditingId(null)
          setName('')
          setEmoji('🍽️')
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit collection' : 'New collection'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={editingId ? updateCollection : createCollection}>
            <DialogBody className="flex gap-3">
              <Input value={emoji} onChange={e => setEmoji(e.target.value)} className="w-16 text-center text-lg" maxLength={4} />
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Baking" autoFocus className="flex-1" />
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setNewOpen(false)
                setEditingId(null)
                setName('')
                setEmoji('🍽️')
              }}>Cancel</Button>
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving ? 'Saving…' : editingId ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
