import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Camera, Check, ChefHat, ChevronLeft, ExternalLink, Trash2, X } from 'lucide-react'
import { supabase } from '../supabase'
import type { Meal, MealTag } from '../supabase'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { haptic } from '../lib/haptics'
import MealImage from '../features/meals/MealImage'
import MealTagPicker from '../features/meals/MealTagPicker'
import RecipePickerDrawer from '../features/meals/RecipePickerDrawer'
import type { RecipeSummary } from '../features/meals/RecipePickerDrawer'
import { deleteOwnedMealImage, uploadMealImage, validateMealImage } from '../features/meals/mealImages'
import { MEAL_TAGS, isMealValid } from '../features/meals/meals'

function sameTags(a: MealTag[], b: MealTag[]) {
  return MEAL_TAGS.filter(t => a.includes(t)).join() === MEAL_TAGS.filter(t => b.includes(t)).join()
}

export default function MealDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [meal, setMeal] = useState<Meal | null>(null)
  const [loading, setLoading] = useState(true)

  // Draft state - nothing is written until Save.
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<MealTag[]>([])
  const [recipe, setRecipe] = useState<RecipeSummary | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [removeImage, setRemoveImage] = useState(false)

  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)

  function resetDraft(m: Meal) {
    setName(m.name)
    setDescription(m.description ?? '')
    setTags(m.tags)
    setRecipe(m.recipe ?? null)
    setImageFile(null)
    setImagePreview(null)
    setRemoveImage(false)
  }

  useEffect(() => {
    if (!id) return
    supabase
      .from('meals')
      .select('*, recipe:recipes(id,title,image_url)')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setError(error.message)
        if (data) {
          setMeal(data as Meal)
          resetDraft(data as Meal)
        }
        setLoading(false)
      })
  }, [id])

  useEffect(() => {
    if (!imagePreview) return
    return () => URL.revokeObjectURL(imagePreview)
  }, [imagePreview])

  useEffect(() => {
    if (!justSaved) return
    const timer = setTimeout(() => setJustSaved(false), 2000)
    return () => clearTimeout(timer)
  }, [justSaved])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!meal) {
    return (
      <div className="mx-auto max-w-2xl p-4 py-16 text-center text-muted-foreground">
        <p className="font-medium">{error ?? 'Meal not found'}</p>
        <Link to="/meals" className="mt-2 inline-block text-sm font-medium text-primary">Back to meal ideas</Link>
      </div>
    )
  }

  const current = meal
  const dirty =
    name.trim() !== current.name ||
    description.trim() !== (current.description ?? '') ||
    !sameTags(tags, current.tags) ||
    (recipe?.id ?? null) !== current.recipe_id ||
    !!imageFile ||
    removeImage

  // Saving needs a name and at least one tag - not a pending change.
  const valid = isMealValid({ name, tags })

  const ownPhoto = imagePreview ?? (removeImage ? null : current.image_url)
  const shownPhoto = ownPhoto ?? recipe?.image_url ?? null
  const photoFromRecipe = !ownPhoto && !!recipe?.image_url

  // Back to wherever you came from (so the list keeps its filter + search).
  function leave() {
    if (location.key !== 'default') navigate(-1)
    else navigate('/meals')
  }

  function handleBack() {
    if (dirty && !confirm('Discard changes?')) return
    leave()
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const problem = validateMealImage(file)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setRemoveImage(false)
  }

  function handleRemovePhoto() {
    setImageFile(null)
    setImagePreview(null)
    setRemoveImage(!!current.image_url)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || saving) return
    if (!dirty) {
      // Already stored as shown - nothing to write.
      setJustSaved(true)
      return
    }
    setSaving(true)
    setError(null)

    let imageUrl = current.image_url
    let uploadedUrl: string | null = null
    try {
      if (imageFile) {
        uploadedUrl = await uploadMealImage(current.user_id, current.id, imageFile)
        imageUrl = uploadedUrl
      } else if (removeImage) {
        imageUrl = null
      }
      const { error } = await supabase
        .from('meals')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          tags,
          recipe_id: recipe?.id ?? null,
          image_url: imageUrl,
        })
        .eq('id', current.id)
      if (error) throw error
    } catch (err) {
      // Don't leave the new upload orphaned if the row never pointed at it.
      if (uploadedUrl) await deleteOwnedMealImage(uploadedUrl).catch(() => {})
      setError(err instanceof Error ? err.message : 'Could not save the meal.')
      setSaving(false)
      return
    }

    if (imageUrl !== current.image_url) await deleteOwnedMealImage(current.image_url).catch(() => {})
    const saved: Meal = {
      ...current,
      name: name.trim(),
      description: description.trim() || null,
      tags,
      recipe_id: recipe?.id ?? null,
      recipe,
      image_url: imageUrl,
    }
    setMeal(saved)
    resetDraft(saved)
    setSaving(false)
    setJustSaved(true)
    haptic('success')
  }

  async function handleDelete() {
    if (!confirm(`Delete "${current.name}"?`)) return
    const { error } = await supabase.from('meals').delete().eq('id', current.id)
    if (error) {
      setError(error.message)
      return
    }
    await deleteOwnedMealImage(current.image_url).catch(() => {})
    haptic('success')
    leave()
  }

  return (
    <div className="mx-auto max-w-2xl p-4 pb-4">
      <div className="mb-6 flex items-center gap-3">
        <button type="button" onClick={handleBack} aria-label="Back" className="-ml-2 rounded-lg p-2 hover:bg-accent">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-xl font-bold">Meal</h1>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label={ownPhoto ? 'Change photo' : 'Add photo'}
            className="relative block aspect-video w-full overflow-hidden rounded-xl"
          >
            <MealImage url={shownPhoto} className="h-full w-full" iconClassName="h-12 w-12" />
            <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-sm font-medium shadow backdrop-blur">
              <Camera className="h-4 w-4" />
              {ownPhoto ? 'Change photo' : 'Add photo'}
            </span>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          {(photoFromRecipe || ownPhoto) && (
            <div className="flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
              <span>{photoFromRecipe ? 'Photo from linked recipe' : ''}</span>
              {ownPhoto && (
                <button type="button" onClick={handleRemovePhoto} className="font-medium hover:text-destructive">
                  Remove photo
                </button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="meal-name">Name</Label>
          <Input id="meal-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Shakshuka" />
        </div>

        <div className="space-y-2">
          <Label>Good for</Label>
          <MealTagPicker value={tags} onChange={setTags} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="meal-description">Description</Label>
          <Textarea
            id="meal-description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Notes, how you like to make it…"
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label>Recipe</Label>
          {recipe ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
              <MealImage url={recipe.image_url} className="h-14 w-14 shrink-0 rounded-lg" iconClassName="h-5 w-5" />
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-tight line-clamp-2">{recipe.title}</p>
                <Link to={`/recipes/${recipe.id}`} className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-primary">
                  Open recipe <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowPicker(true)}>Change</Button>
              <button
                type="button"
                onClick={() => setRecipe(null)}
                aria-label="Unlink recipe"
                className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
            >
              <ChefHat className="h-4 w-4" />
              Link a recipe
            </button>
          )}
        </div>

        {/* Pinned to the bottom of the scroll area, just above the mobile tab bar. */}
        <div className="sticky bottom-[var(--tabbar-height,0px)] z-20 -mx-4 space-y-2 border-t border-border bg-background px-4 py-3 md:bottom-0">
          {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          {!valid && (
            <p className="px-1 text-center text-xs text-muted-foreground">
              {name.trim() ? 'Pick at least one tag to save' : 'Add a name to save'}
            </p>
          )}
          <Button
            type="submit"
            disabled={saving || !valid}
            className="h-12 w-full rounded-xl text-base font-semibold"
          >
            {saving ? 'Saving…' : justSaved && !dirty ? (<><Check className="h-4 w-4" />Saved</>) : 'Save changes'}
          </Button>
        </div>
      </form>

      <button
        type="button"
        onClick={handleDelete}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="h-4 w-4" />
        Delete meal
      </button>

      <RecipePickerDrawer
        open={showPicker}
        onClose={() => setShowPicker(false)}
        selectedId={recipe?.id}
        onPick={r => { setRecipe(r); setShowPicker(false) }}
      />
    </div>
  )
}
