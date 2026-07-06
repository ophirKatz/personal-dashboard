import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { Camera, Plus, ChevronLeft } from 'lucide-react'
import { supabase } from '../supabase'
import type { Recipe, RecipeCollection } from '../supabase'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Button } from '../components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import IngredientRow, { type IngredientDraft } from '../features/recipes/IngredientRow'
import CollectionPicker from '../features/recipes/CollectionPicker'
import {
  ALLOWED_RECIPE_IMAGE_TYPES,
  MAX_RECIPE_IMAGE_BYTES,
  uploadRecipeImage,
  deleteOwnedRecipeImage,
  type RecipeDraft,
} from '../features/recipes/recipes'

type StepDraft = { key: string; text: string }

function newIngredient(partial?: Partial<IngredientDraft>): IngredientDraft {
  return { key: crypto.randomUUID(), quantity: '', unit: '', name: '', note: '', ...partial }
}

function newStep(text = ''): StepDraft {
  return { key: crypto.randomUUID(), text }
}

export default function RecipeEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const draftState = location.state as { draft?: RecipeDraft; sourceUrl?: string | null; importMethod?: Recipe['import_method'] } | null

  const [user, setUser] = useState<User | null>(null)
  const [existingRecipe, setExistingRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(!!id)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [servings, setServings] = useState(4)
  const [imageUrl, setImageUrl] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([newIngredient()])
  const [steps, setSteps] = useState<StepDraft[]>([newStep()])
  const [collections, setCollections] = useState<RecipeCollection[]>([])
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<Set<string>>(new Set())
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  useEffect(() => {
    async function loadCollections(userId: string) {
      const { data } = await supabase.from('recipe_collections').select('*').order('name')
      setCollections(data ?? [])
      return data ?? []
    }

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const allCollections = await loadCollections(user.id)

      if (id) {
        const [recipeRes, ingredientsRes, stepsRes, itemsRes] = await Promise.all([
          supabase.from('recipes').select('*').eq('id', id).single(),
          supabase.from('recipe_ingredients').select('*').eq('recipe_id', id).order('position'),
          supabase.from('recipe_steps').select('*').eq('recipe_id', id).order('position'),
          supabase.from('recipe_collection_items').select('collection_id').eq('recipe_id', id),
        ])
        if (recipeRes.data) {
          const recipe = recipeRes.data
          setExistingRecipe(recipe)
          setTitle(recipe.title)
          setDescription(recipe.description ?? '')
          setServings(recipe.servings)
          setImageUrl(recipe.image_url ?? '')
          setImagePreview(recipe.image_url)
        }
        if (ingredientsRes.data?.length) {
          setIngredients(ingredientsRes.data.map(i => newIngredient({
            quantity: i.quantity === null ? '' : String(i.quantity),
            unit: i.unit ?? '',
            name: i.name,
            note: i.note ?? '',
          })))
        }
        if (stepsRes.data?.length) {
          setSteps(stepsRes.data.map(s => newStep(s.instruction)))
        }
        setSelectedCollectionIds(new Set((itemsRes.data ?? []).map(i => i.collection_id)))
        setLoading(false)
      } else if (draftState?.draft) {
        const draft = draftState.draft
        setTitle(draft.title)
        setDescription(draft.description ?? '')
        setServings(draft.servings)
        if (draft.ingredients.length) {
          setIngredients(draft.ingredients.map(i => newIngredient({
            quantity: i.quantity === null ? '' : String(i.quantity),
            unit: i.unit ?? '',
            name: i.name,
            note: i.note ?? '',
          })))
        }
        if (draft.steps.length) {
          setSteps(draft.steps.map(s => newStep(s)))
        }

        const matchedIds = new Set<string>()
        const toCreate: string[] = []
        for (const name of draft.suggested_collections) {
          const match = allCollections.find(c => c.name.toLowerCase() === name.toLowerCase())
          if (match) matchedIds.add(match.id)
          else toCreate.push(name)
        }
        if (toCreate.length > 0) {
          const { data: created } = await supabase
            .from('recipe_collections')
            .insert(toCreate.map(name => ({ user_id: user.id, name })))
            .select()
          for (const c of created ?? []) matchedIds.add(c.id)
          setCollections(prev => [...prev, ...(created ?? [])].sort((a, b) => a.name.localeCompare(b.name)))
        }
        setSelectedCollectionIds(matchedIds)
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  function handleImageFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!ALLOWED_RECIPE_IMAGE_TYPES.has(file.type)) {
      setImageError('Please choose a JPEG, PNG, WebP, or GIF image.')
      return
    }
    if (file.size > MAX_RECIPE_IMAGE_BYTES) {
      setImageError('Image must be under 8 MB.')
      return
    }
    setImageError(null)
    setImageFile(file)
    setImageUrl('')
    setImagePreview(URL.createObjectURL(file))
  }

  function handleImageUrlChange(value: string) {
    setImageUrl(value)
    setImageFile(null)
    setImagePreview(value.trim() || null)
  }

  function updateIngredient(key: string, patch: Partial<IngredientDraft>) {
    setIngredients(prev => prev.map(i => (i.key === key ? { ...i, ...patch } : i)))
  }

  function moveIngredient(index: number, direction: -1 | 1) {
    setIngredients(prev => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function moveStep(index: number, direction: -1 | 1) {
    setSteps(prev => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !title.trim()) return
    setSaving(true)
    setSaveError(null)

    const recipeId = existingRecipe?.id ?? crypto.randomUUID()
    let finalImageUrl = existingRecipe?.image_url ?? null

    if (imageFile) {
      try {
        finalImageUrl = await uploadRecipeImage(user.id, recipeId, imageFile)
      } catch {
        setImageError('Could not upload photo.')
        setSaving(false)
        return
      }
    } else {
      finalImageUrl = imageUrl.trim() || null
    }

    if (existingRecipe?.image_url && existingRecipe.image_url !== finalImageUrl) {
      deleteOwnedRecipeImage(existingRecipe.image_url).catch(() => {})
    }

    const payload = {
      id: recipeId,
      user_id: user.id,
      title: title.trim(),
      description: description.trim() || null,
      servings: Math.max(1, servings),
      image_url: finalImageUrl,
      source_url: existingRecipe?.source_url ?? draftState?.sourceUrl ?? null,
      import_method: existingRecipe?.import_method ?? draftState?.importMethod ?? 'manual',
      last_viewed_at: existingRecipe?.last_viewed_at ?? null,
    }

    const { error: recipeError } = await supabase.from('recipes').upsert(payload)
    if (recipeError) {
      setSaveError('Could not save recipe. Please try again.')
      setSaving(false)
      return
    }

    const validIngredients = ingredients.filter(i => i.name.trim())
    await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId)
    if (validIngredients.length > 0) {
      await supabase.from('recipe_ingredients').insert(validIngredients.map((i, index) => ({
        recipe_id: recipeId,
        user_id: user.id,
        quantity: i.quantity.trim() === '' ? null : Number(i.quantity),
        unit: i.unit.trim() || null,
        name: i.name.trim(),
        note: i.note.trim() || null,
        position: index,
      })))
    }

    const validSteps = steps.filter(s => s.text.trim())
    await supabase.from('recipe_steps').delete().eq('recipe_id', recipeId)
    if (validSteps.length > 0) {
      await supabase.from('recipe_steps').insert(validSteps.map((s, index) => ({
        recipe_id: recipeId,
        user_id: user.id,
        instruction: s.text.trim(),
        position: index,
      })))
    }

    await supabase.from('recipe_collection_items').delete().eq('recipe_id', recipeId)
    if (selectedCollectionIds.size > 0) {
      await supabase.from('recipe_collection_items').insert(
        [...selectedCollectionIds].map(collectionId => ({
          recipe_id: recipeId,
          collection_id: collectionId,
          user_id: user.id,
        })),
      )
    }

    setSaving(false)
    navigate(`/recipes/${recipeId}`)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Link to={existingRecipe ? `/recipes/${existingRecipe.id}` : '/recipes'} className="p-2 -ml-2 rounded-lg hover:bg-accent">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold flex-1">{existingRecipe ? 'Edit recipe' : 'New recipe'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative w-full aspect-video rounded-xl overflow-hidden border-2 border-dashed border-border flex items-center justify-center bg-muted text-muted-foreground hover:bg-accent"
          >
            {imagePreview ? (
              <img src={imagePreview} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-1">
                <Camera className="h-6 w-6" />
                <span className="text-sm">Add a photo</span>
              </div>
            )}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFileSelect} />
          <Input
            value={imageFile ? '' : imageUrl}
            onChange={e => handleImageUrlChange(e.target.value)}
            placeholder="…or paste an image URL"
            disabled={!!imageFile}
            className="w-full"
          />
          {imageError && <p className="text-xs text-destructive">{imageError}</p>}
        </div>

        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Sourdough Pizza Dough" autoFocus />
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="A short description of the recipe" />
        </div>

        <div className="space-y-2">
          <Label>Servings</Label>
          <Input
            type="number"
            min={1}
            max={100}
            value={servings}
            onChange={e => setServings(Math.max(1, Number(e.target.value) || 1))}
            className="w-24"
          />
        </div>

        <div className="space-y-2">
          <Label>Collections</Label>
          <CollectionPicker
            collections={collections}
            selectedIds={selectedCollectionIds}
            onToggle={collectionId => setSelectedCollectionIds(prev => {
              const next = new Set(prev)
              if (next.has(collectionId)) next.delete(collectionId)
              else next.add(collectionId)
              return next
            })}
            onCreated={collection => {
              setCollections(prev => [...prev, collection].sort((a, b) => a.name.localeCompare(b.name)))
              setSelectedCollectionIds(prev => new Set(prev).add(collection.id))
            }}
            userId={user?.id ?? ''}
          />
        </div>

        <Tabs defaultValue="ingredients">
          <TabsList className="w-full">
            <TabsTrigger value="ingredients" className="flex-1">Ingredients</TabsTrigger>
            <TabsTrigger value="directions" className="flex-1">Directions</TabsTrigger>
          </TabsList>

          <TabsContent value="ingredients" className="space-y-2 pt-4">
            {ingredients.map((ingredient, index) => (
              <IngredientRow
                key={ingredient.key}
                value={ingredient}
                onChange={patch => updateIngredient(ingredient.key, patch)}
                onRemove={() => setIngredients(prev => prev.filter(i => i.key !== ingredient.key))}
                onMoveUp={() => moveIngredient(index, -1)}
                onMoveDown={() => moveIngredient(index, 1)}
                canMoveUp={index > 0}
                canMoveDown={index < ingredients.length - 1}
              />
            ))}
            <Button type="button" variant="outline" className="w-full" onClick={() => setIngredients(prev => [...prev, newIngredient()])}>
              <Plus className="h-4 w-4" /> Add ingredient
            </Button>
          </TabsContent>

          <TabsContent value="directions" className="space-y-2 pt-4">
            {steps.map((step, index) => (
              <div key={step.key} className="flex items-start gap-2">
                <span className="mt-2 shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">{index + 1}</span>
                <Textarea
                  value={step.text}
                  onChange={e => setSteps(prev => prev.map(s => (s.key === step.key ? { ...s, text: e.target.value } : s)))}
                  placeholder={`Step ${index + 1}`}
                  rows={2}
                  className="flex-1"
                />
                <div className="flex flex-col gap-1 pt-1">
                  <button type="button" onClick={() => moveStep(index, -1)} disabled={index === 0} className="text-muted-foreground disabled:opacity-30 hover:text-foreground">▲</button>
                  <button type="button" onClick={() => moveStep(index, 1)} disabled={index === steps.length - 1} className="text-muted-foreground disabled:opacity-30 hover:text-foreground">▼</button>
                </div>
                <button
                  type="button"
                  onClick={() => setSteps(prev => prev.filter(s => s.key !== step.key))}
                  className="mt-2 text-muted-foreground hover:text-destructive"
                >
                  ✕
                </button>
              </div>
            ))}
            <Button type="button" variant="outline" className="w-full" onClick={() => setSteps(prev => [...prev, newStep()])}>
              <Plus className="h-4 w-4" /> Add step
            </Button>
          </TabsContent>
        </Tabs>

        {saveError && <p className="text-sm text-destructive">{saveError}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={saving || !title.trim()}>
          {saving ? 'Saving…' : 'Save recipe'}
        </Button>
      </form>
    </div>
  )
}
