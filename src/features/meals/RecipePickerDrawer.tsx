import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Search } from 'lucide-react'
import { supabase } from '../../supabase'
import type { Recipe } from '../../supabase'
import { Input } from '../../components/ui/input'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
import MealImage from './MealImage'

export type RecipeSummary = Pick<Recipe, 'id' | 'title' | 'image_url'>

type Props = {
  open: boolean
  onClose: () => void
  onPick: (recipe: RecipeSummary) => void
  selectedId?: string | null
}

export default function RecipePickerDrawer({ open, onClose, onPick, selectedId }: Props) {
  const [recipes, setRecipes] = useState<RecipeSummary[] | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) return
    setQuery('')
    setRecipes(null)
    supabase
      .from('recipes')
      .select('id,title,image_url')
      .order('title')
      .then(({ data }) => setRecipes(data ?? []))
  }, [open])

  const choices = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (recipes ?? []).filter(r => !q || r.title.toLowerCase().includes(q))
  }, [recipes, query])

  return (
    <Drawer open={open} onOpenChange={v => !v && onClose()}>
      <DrawerContent>
        <DrawerHeader><DrawerTitle>Link a recipe</DrawerTitle></DrawerHeader>
        <DrawerBody className="space-y-3">
          {recipes === null ? (
            <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : recipes.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p className="text-sm">You don't have any recipes yet.</p>
              <Link to="/recipes" className="mt-2 inline-block text-sm font-medium text-primary">Add one in Recipes</Link>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search your recipes…"
                  className="h-12 rounded-xl pl-9 text-base"
                />
              </div>
              {choices.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No matches</p>}
              <div className="space-y-2">
                {choices.map(recipe => (
                  <button
                    key={recipe.id}
                    type="button"
                    onClick={() => onPick(recipe)}
                    className="w-full flex items-center gap-3 rounded-xl border border-border bg-card p-2.5 text-left transition-colors hover:bg-accent"
                  >
                    <MealImage url={recipe.image_url} className="h-14 w-14 shrink-0 rounded-lg" iconClassName="h-5 w-5" />
                    <p className="min-w-0 flex-1 font-medium leading-tight line-clamp-2">{recipe.title}</p>
                    {recipe.id === selectedId && <Check className="h-5 w-5 shrink-0 text-primary" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
