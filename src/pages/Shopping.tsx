import { useEffect, useRef, useState } from 'react'
import { Plus, Pencil, Trash2, RotateCcw, ImagePlus } from 'lucide-react'
import { supabase } from '../supabase'
import type { ShoppingItem } from '../supabase'
import type { User } from '@supabase/supabase-js'
import { Checkbox } from '../components/ui/checkbox'
import { Fab } from '../components/ui/fab'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import ShoppingItemDrawer from '../features/shopping/ShoppingItemDrawer'

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export default function Shopping() {
  const [user, setUser] = useState<User | null>(null)
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState<ShoppingItem | undefined>()
  const imageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  async function loadItems() {
    const { data } = await supabase.from('shopping_items').select('*').order('created_at')
    setItems(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadItems() }, [])

  async function toggleItem(item: ShoppingItem) {
    await supabase.from('shopping_items').update({ checked: !item.checked }).eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: !i.checked } : i))
  }

  async function deleteItem(id: string) {
    await supabase.from('shopping_items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  async function uncheckAll() {
    await supabase.from('shopping_items').update({ checked: false }).eq('user_id', user?.id)
    setItems(prev => prev.map(i => ({ ...i, checked: false })))
  }

  async function importFromImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setImportError('Please choose a JPEG, PNG, WebP, or GIF image.')
      return
    }

    setImporting(true)
    setImportError(null)
    try {
      const image = await readFileAsBase64(file)
      const { data, error } = await supabase.functions.invoke('extract-shopping-items', {
        body: { image, mediaType: file.type },
      })
      if (error) {
        const body = await error.context?.json?.().catch(() => null)
        throw new Error(body?.message ?? body?.error ?? error.message ?? 'Import failed')
      }

      const imported: ShoppingItem[] = data?.items ?? []
      if (imported.length === 0) {
        setImportError('No items found in that image.')
      } else {
        setItems(prev => [...prev, ...imported])
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const activeItems = items.filter(i => !i.checked)
  const completedItems = items.filter(i => i.checked)

  function renderItem(item: ShoppingItem) {
    return (
      <div key={item.id} className={`flex items-center gap-3 p-3.5 bg-card border border-border rounded-xl transition-opacity ${item.checked ? 'opacity-50' : ''}`}>
        <Checkbox checked={item.checked} onCheckedChange={() => toggleItem(item)} />
        <span className={`flex-1 ${item.checked ? 'line-through text-muted-foreground' : ''}`}>{item.name}</span>
        <button onClick={() => { setEditingItem(item); setShowForm(true) }} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground">
          <Pencil className="h-4 w-4" />
        </button>
        <button onClick={() => deleteItem(item.id)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Shopping List</h1>
          {items.length > 0 && <p className="text-sm text-muted-foreground">{completedItems.length}/{items.length} checked</p>}
        </div>
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={importFromImage} />
        <button
          onClick={() => imageInputRef.current?.click()}
          disabled={importing}
          className="p-2 rounded-lg hover:bg-accent text-muted-foreground disabled:opacity-50"
          title="Import from photo"
        >
          {importing ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4" />
          )}
        </button>
        {completedItems.length > 0 && (
          <button onClick={uncheckAll} className="p-2 rounded-lg hover:bg-accent text-muted-foreground" title="Uncheck all">
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
      </div>

      {importError && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center justify-between gap-2">
          <span>{importError}</span>
          <button onClick={() => setImportError(null)} className="text-destructive/70 hover:text-destructive">✕</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <Tabs defaultValue="active">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="active" className="flex-1">To buy ({activeItems.length})</TabsTrigger>
            <TabsTrigger value="completed" className="flex-1">Completed ({completedItems.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            <div className="space-y-2">
              {activeItems.map(renderItem)}
              {activeItems.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <div className="text-4xl mb-3">🛒</div>
                  <p className="font-medium">No items yet — tap + to add one</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="completed">
            <div className="space-y-2">
              {completedItems.map(renderItem)}
              {completedItems.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <p className="font-medium">Nothing completed yet</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {user && (
        <Fab onClick={() => { setEditingItem(undefined); setShowForm(true) }} aria-label="Add item">
          <Plus className="h-6 w-6" />
        </Fab>
      )}

      {user && showForm && (
        <ShoppingItemDrawer
          open={showForm}
          onClose={() => setShowForm(false)}
          onSave={loadItems}
          item={editingItem}
          userId={user.id}
        />
      )}
    </div>
  )
}
