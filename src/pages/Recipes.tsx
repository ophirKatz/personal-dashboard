import { useEffect, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { Recipe, RecipeCollection, RecipeCollectionItem } from '../supabase'
import { Input } from '../components/ui/input'
import { Fab } from '../components/ui/fab'
import RecipeCard from '../features/recipes/RecipeCard'
import CollectionsRail from '../features/recipes/CollectionsRail'
import AddRecipeSheet from '../features/recipes/AddRecipeSheet'

export default function Recipes() {
  const [user, setUser] = useState<User | null>(null)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [collections, setCollections] = useState<RecipeCollection[]>([])
  const [collectionItems, setCollectionItems] = useState<RecipeCollectionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
  const [showAddSheet, setShowAddSheet] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  async function load() {
    const [recipesRes, collectionsRes, itemsRes] = await Promise.all([
      supabase.from('recipes').select('*').order('created_at', { ascending: false }),
      supabase.from('recipe_collections').select('*').order('name'),
      supabase.from('recipe_collection_items').select('*'),
    ])
    setRecipes(recipesRes.data ?? [])
    setCollections(collectionsRes.data ?? [])
    setCollectionItems(itemsRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const collectionNamesByRecipe = new Map<string, string[]>()
  for (const item of collectionItems) {
    const collection = collections.find(c => c.id === item.collection_id)
    if (!collection) continue
    const names = collectionNamesByRecipe.get(item.recipe_id) ?? []
    names.push(collection.name)
    collectionNamesByRecipe.set(item.recipe_id, names)
  }

  const recentlyViewed = recipes
    .filter(r => r.last_viewed_at)
    .sort((a, b) => (b.last_viewed_at! > a.last_viewed_at! ? 1 : -1))
    .slice(0, 6)

  const filteredRecipes = recipes.filter(recipe => {
    if (selectedCollectionId) {
      const recipeCollectionIds = collectionItems.filter(i => i.recipe_id === recipe.id).map(i => i.collection_id)
      if (!recipeCollectionIds.includes(selectedCollectionId)) return false
    }
    if (search.trim() && !recipe.title.toLowerCase().includes(search.trim().toLowerCase())) return false
    return true
  })

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold flex-1">Recipes</h1>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search recipes…" className="pl-9" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          <CollectionsRail
            collections={collections}
            selectedId={selectedCollectionId}
            onSelect={setSelectedCollectionId}
            onCreated={load}
            userId={user?.id ?? ''}
          />

          {recentlyViewed.length > 0 && !search.trim() && !selectedCollectionId && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">Recently viewed</h2>
              <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4">
                {recentlyViewed.map(recipe => (
                  <div key={recipe.id} className="w-32 shrink-0">
                    <RecipeCard recipe={recipe} collectionNames={collectionNamesByRecipe.get(recipe.id)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {selectedCollectionId ? collections.find(c => c.id === selectedCollectionId)?.name : 'All recipes'}
            </h2>
            {filteredRecipes.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <div className="text-4xl mb-3">🍽️</div>
                <p className="font-medium">No recipes yet — tap + to add one</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredRecipes.map(recipe => (
                  <RecipeCard key={recipe.id} recipe={recipe} collectionNames={collectionNamesByRecipe.get(recipe.id)} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {user && (
        <Fab onClick={() => setShowAddSheet(true)} aria-label="Add recipe">
          <Plus className="h-6 w-6" />
        </Fab>
      )}

      <AddRecipeSheet open={showAddSheet} onClose={() => setShowAddSheet(false)} />
    </div>
  )
}
