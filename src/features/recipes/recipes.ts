import { supabase } from '../../supabase'

export type RecipeDraft = {
  title: string
  description: string | null
  servings: number
  ingredients: Array<{ quantity: number | null; unit: string | null; name: string; note: string | null }>
  steps: string[]
  suggested_collections: string[]
}

export const ALLOWED_RECIPE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
export const MAX_RECIPE_IMAGE_BYTES = 8 * 1024 * 1024

const RECIPE_IMAGE_PREFIX = supabase.storage.from('recipe-images').getPublicUrl('').data.publicUrl

export async function uploadRecipeImage(userId: string, recipeId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${userId}/${recipeId}.${ext}`
  const { error } = await supabase.storage.from('recipe-images').upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from('recipe-images').getPublicUrl(path)
  return data.publicUrl
}

// Only removes from storage when the URL is one of our own uploads (as opposed
// to a pasted external image URL, which we must never attempt to delete).
export async function deleteOwnedRecipeImage(imageUrl: string | null): Promise<void> {
  if (!imageUrl || !imageUrl.startsWith(RECIPE_IMAGE_PREFIX)) return
  const path = imageUrl.slice(RECIPE_IMAGE_PREFIX.length)
  await supabase.storage.from('recipe-images').remove([path])
}

const FRACTION_GLYPHS: Array<[number, string]> = [
  [0.5, '½'],
  [0.25, '¼'],
  [0.75, '¾'],
  [1 / 3, '⅓'],
  [2 / 3, '⅔'],
]
const FRACTION_EPSILON = 0.02

// Cosmetic decimal -> unicode fraction formatter for display only, not general
// fraction arithmetic (e.g. 1.5 -> "1½", 0.333 -> "⅓", 2 -> "2").
export function formatQuantity(quantity: number | null): string {
  if (quantity === null) return ''
  const whole = Math.floor(quantity)
  const frac = quantity - whole

  if (frac < FRACTION_EPSILON) return String(whole)

  const glyph = FRACTION_GLYPHS.find(([value]) => Math.abs(frac - value) < FRACTION_EPSILON)
  if (glyph) return whole > 0 ? `${whole}${glyph[1]}` : glyph[1]

  return String(Math.round(quantity * 100) / 100)
}
