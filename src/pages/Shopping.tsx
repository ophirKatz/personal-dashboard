import { useEffect, useState } from 'react'
import { Plus, Trash2, ArrowLeft, RotateCcw } from 'lucide-react'
import { supabase } from '../supabase'
import type { ShoppingList, ShoppingItem } from '../supabase'
import type { User } from '@supabase/supabase-js'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Checkbox } from '../components/ui/checkbox'

export default function Shopping() {
  const [user, setUser] = useState<User | null>(null)
  const [lists, setLists] = useState<ShoppingList[]>([])
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [selectedList, setSelectedList] = useState<ShoppingList | null>(null)
  const [newListName, setNewListName] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  async function loadLists() {
    const { data } = await supabase.from('shopping_lists').select('*').order('created_at')
    setLists(data ?? [])
    setLoading(false)
  }

  async function loadItems(listId: string) {
    const { data } = await supabase.from('shopping_items').select('*').eq('list_id', listId).order('created_at')
    setItems(data ?? [])
  }

  useEffect(() => { loadLists() }, [])

  useEffect(() => {
    if (selectedList) loadItems(selectedList.id)
  }, [selectedList])

  async function createList(e: React.FormEvent) {
    e.preventDefault()
    if (!newListName.trim() || !user) return
    const { data } = await supabase.from('shopping_lists').insert({ name: newListName.trim(), user_id: user.id }).select().single()
    if (data) { setLists(prev => [...prev, data]); setNewListName('') }
  }

  async function deleteList(id: string) {
    if (!confirm('Delete this list and all items?')) return
    await supabase.from('shopping_lists').delete().eq('id', id)
    setLists(prev => prev.filter(l => l.id !== id))
    if (selectedList?.id === id) setSelectedList(null)
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault()
    if (!newItemName.trim() || !selectedList || !user) return
    const { data } = await supabase.from('shopping_items').insert({
      name: newItemName.trim(), list_id: selectedList.id, user_id: user.id,
    }).select().single()
    if (data) { setItems(prev => [...prev, data]); setNewItemName('') }
  }

  async function toggleItem(item: ShoppingItem) {
    await supabase.from('shopping_items').update({ checked: !item.checked }).eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: !i.checked } : i))
  }

  async function deleteItem(id: string) {
    await supabase.from('shopping_items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  async function uncheckAll() {
    if (!selectedList) return
    await supabase.from('shopping_items').update({ checked: false }).eq('list_id', selectedList.id)
    setItems(prev => prev.map(i => ({ ...i, checked: false })))
  }

  if (selectedList) {
    const checked = items.filter(i => i.checked).length
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setSelectedList(null)} className="p-2 rounded-lg hover:bg-accent">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{selectedList.name}</h1>
            <p className="text-sm text-muted-foreground">{checked}/{items.length} checked</p>
          </div>
          {checked > 0 && (
            <button onClick={uncheckAll} className="p-2 rounded-lg hover:bg-accent text-muted-foreground" title="Uncheck all">
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
        </div>

        <form onSubmit={addItem} className="flex gap-2 mb-5">
          <Input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Add item…" className="flex-1" />
          <Button type="submit" size="icon" disabled={!newItemName.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </form>

        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className={`flex items-center gap-3 p-3.5 bg-card border border-border rounded-xl transition-opacity ${item.checked ? 'opacity-50' : ''}`}>
              <Checkbox checked={item.checked} onCheckedChange={() => toggleItem(item)} />
              <span className={`flex-1 ${item.checked ? 'line-through text-muted-foreground' : ''}`}>{item.name}</span>
              <button onClick={() => deleteItem(item.id)} className="text-muted-foreground hover:text-destructive p-1">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <p>No items yet — add one above</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Shopping Lists</h1>

      <form onSubmit={createList} className="flex gap-2 mb-5">
        <Input value={newListName} onChange={e => setNewListName(e.target.value)} placeholder="New list name…" className="flex-1" />
        <Button type="submit" size="icon" disabled={!newListName.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </form>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : lists.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-4xl mb-3">🛒</div>
          <p className="font-medium">No lists yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {lists.map(list => (
            <div key={list.id} className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl">
              <button className="flex-1 text-left font-medium" onClick={() => setSelectedList(list)}>
                {list.name}
              </button>
              <button onClick={() => deleteList(list.id)} className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-accent">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
