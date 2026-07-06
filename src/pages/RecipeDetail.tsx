import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ChevronLeft, Pencil, Trash2, ChefHat } from 'lucide-react'
import { supabase } from '../supabase'
import type { Recipe, RecipeIngredient, RecipeStep, RecipeCollection } from '../supabase'
import { Badge } from '../components/ui/badge'
import ServingsScaler from '../features/recipes/ServingsScaler'
import { deleteOwnedRecipeImage, formatQuantity } from '../features/recipes/recipes'

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([])
  const [steps, setSteps] = useState<RecipeStep[]>([])
  const [collections, setCollections] = useState<RecipeCollection[]>([])
  const [servings, setServings] = useState(4)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    async function load() {
      const [recipeRes, ingredientsRes, stepsRes, itemsRes, collectionsRes] = await Promise.all([
        supabase.from('recipes').select('*').eq('id', id).single(),
        supabase.from('recipe_ingredients').select('*').eq('recipe_id', id).order('position'),
        supabase.from('recipe_steps').select('*').eq('recipe_id', id).order('position'),
        supabase.from('recipe_collection_items').select('collection_id').eq('recipe_id', id),
        supabase.from('recipe_collections').select('*'),
      ])
      if (recipeRes.data) {
        setRecipe(recipeRes.data)
        setServings(recipeRes.data.servings)
        supabase.from('recipes').update({ last_viewed_at: new Date().toISOString() }).eq('id', id).then(() => {})
      }
      setIngredients(ingredientsRes.data ?? [])
      setSteps(stepsRes.data ?? [])
      const collectionIds = new Set((itemsRes.data ?? []).map(i => i.collection_id))
      setCollections((collectionsRes.data ?? []).filter(c => collectionIds.has(c.id)))
      setLoading(false)
    }
    load()
  }, [id])

  async function handleDelete() {
    if (!recipe || !confirm(`Delete "${recipe.title}"?`)) return
    await deleteOwnedRecipeImage(recipe.image_url)
    await supabase.from('recipes').delete().eq('id', recipe.id)
    navigate('/recipes')
  }

  if (loading || !recipe) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const multiplier = recipe.servings > 0 ? servings / recipe.servings : 1

  return (
    <div className="max-w-2xl mx-auto pb-8">
      <div className="relative aspect-video w-full bg-muted flex items-center justify-center overflow-hidden">
        {recipe.image_url ? (
          <img src={recipe.image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <ChefHat className="h-12 w-12 text-muted-foreground" />
        )}
        <Link to="/recipes" className="absolute top-3 left-3 p-2 rounded-full bg-background/80 backdrop-blur hover:bg-background">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="absolute top-3 right-3 flex gap-2">
          <Link to={`/recipes/${recipe.id}/edit`} className="p-2 rounded-full bg-background/80 backdrop-blur hover:bg-background">
            <Pencil className="h-4 w-4" />
          </Link>
          <button onClick={handleDelete} className="p-2 rounded-full bg-background/80 backdrop-blur hover:bg-background hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-5">
        <div>
          <h1 className="text-2xl font-bold">{recipe.title}</h1>
          {recipe.description && <p className="text-muted-foreground mt-1">{recipe.description}</p>}
        </div>

        {collections.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {collections.map(c => (
              <Badge key={c.id} variant="secondary">{c.emoji} {c.name}</Badge>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Ingredients</h2>
          <ServingsScaler baseServings={recipe.servings} value={servings} onChange={setServings} />
        </div>
        <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
          {ingredients.map(ingredient => (
            <div key={ingredient.id} className="flex items-baseline gap-1.5 p-3">
              {ingredient.quantity !== null && (
                <span className="font-medium">{formatQuantity(ingredient.quantity * multiplier)}</span>
              )}
              {ingredient.unit && <span>{ingredient.unit}</span>}
              <span className="font-semibold">{ingredient.name}</span>
              {ingredient.note && <span className="text-muted-foreground">, {ingredient.note}</span>}
            </div>
          ))}
          {ingredients.length === 0 && <p className="p-3 text-sm text-muted-foreground">No ingredients listed.</p>}
        </div>

        <h2 className="font-semibold">Directions</h2>
        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li key={step.id} className="flex gap-3">
              <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">{i + 1}</span>
              <p className="pt-0.5">{step.instruction}</p>
            </li>
          ))}
          {steps.length === 0 && <p className="text-sm text-muted-foreground">No directions listed.</p>}
        </ol>
      </div>
    </div>
  )
}
