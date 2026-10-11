import { supabase } from '../../supabase'
import { ALLOWED_RECIPE_IMAGE_TYPES, MAX_RECIPE_IMAGE_BYTES } from '../recipes/recipes'

const BUCKET = 'meal-images'
const MEAL_IMAGE_PREFIX = supabase.storage.from(BUCKET).getPublicUrl('').data.publicUrl

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

/** Returns an error message, or null when the file is fine to upload. */
export function validateMealImage(file: File): string | null {
  if (!ALLOWED_RECIPE_IMAGE_TYPES.has(file.type)) return 'Please choose a JPEG, PNG, WebP, or GIF image.'
  if (file.size > MAX_RECIPE_IMAGE_BYTES) return 'Image must be under 8 MB.'
  return null
}

// The timestamp keeps every upload at a fresh URL, so a replaced photo is never
// served stale from the public CDN and a changed extension leaves no orphan.
export async function uploadMealImage(userId: string, mealId: string, file: File): Promise<string> {
  const ext = EXT_BY_TYPE[file.type] ?? 'jpg'
  const path = `${userId}/${mealId}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type })
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

export function isOwnedMealImage(imageUrl: string | null): imageUrl is string {
  return !!imageUrl && imageUrl.startsWith(MEAL_IMAGE_PREFIX)
}

// Only touches storage for our own uploads; never for an external image URL.
export async function deleteOwnedMealImage(imageUrl: string | null): Promise<void> {
  if (!isOwnedMealImage(imageUrl)) return
  await supabase.storage.from(BUCKET).remove([imageUrl.slice(MEAL_IMAGE_PREFIX.length)])
}
