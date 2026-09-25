import { supabase } from '../../supabase'
import diceCardImage from '../../assets/games/dice-card.svg'

export type GameUtilityKey = 'dice'

type GameUtilityDefinition = {
  key: GameUtilityKey
  path: string
  defaultName: string
  defaultDescription: string
  defaultImage: string | null
}

// Built-in utilities. Their name/description/image are user-editable; edits
// are stored as per-user overrides in `game_utilities`, keyed by `key`.
export const GAME_UTILITIES: GameUtilityDefinition[] = [
  {
    key: 'dice',
    path: '/games/dice',
    defaultName: 'Dice Roller',
    defaultDescription: 'Roll one or two dice for any board game.',
    defaultImage: diceCardImage,
  },
]

export type GameUtilityOverride = {
  user_id: string
  utility_key: string
  name: string | null
  description: string | null
  image_url: string | null
  show_image: boolean
}

export type GameUtility = {
  key: GameUtilityKey
  path: string
  name: string
  description: string
  image: string | null
  customImageUrl: string | null
  defaultImage: string | null
}

export const ALLOWED_GAME_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'])
export const MAX_GAME_IMAGE_BYTES = 8 * 1024 * 1024

const GAME_IMAGE_PREFIX = supabase.storage.from('game-images').getPublicUrl('').data.publicUrl

export function resolveGameUtilities(overrides: GameUtilityOverride[]): GameUtility[] {
  return GAME_UTILITIES.map(def => {
    const o = overrides.find(row => row.utility_key === def.key)
    const customImageUrl = o?.image_url ?? null
    return {
      key: def.key,
      path: def.path,
      name: o?.name?.trim() || def.defaultName,
      description: o?.description ?? def.defaultDescription,
      image: o?.show_image === false ? null : customImageUrl ?? def.defaultImage,
      customImageUrl,
      defaultImage: def.defaultImage,
    }
  })
}

export async function fetchGameUtilities(): Promise<GameUtility[]> {
  const { data } = await supabase.from('game_utilities').select('*')
  return resolveGameUtilities((data as GameUtilityOverride[] | null) ?? [])
}

export async function saveGameUtilityOverride(
  userId: string,
  key: GameUtilityKey,
  fields: { name: string; description: string; image_url: string | null; show_image: boolean },
): Promise<void> {
  const { error } = await supabase.from('game_utilities').upsert({
    user_id: userId,
    utility_key: key,
    ...fields,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function uploadGameImage(userId: string, key: GameUtilityKey, file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg'
  // Timestamped so a replaced image never gets served from a stale cache.
  const path = `${userId}/${key}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('game-images').upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from('game-images').getPublicUrl(path)
  return data.publicUrl
}

export async function deleteOwnedGameImage(imageUrl: string | null): Promise<void> {
  if (!imageUrl || !imageUrl.startsWith(GAME_IMAGE_PREFIX)) return
  const path = imageUrl.slice(GAME_IMAGE_PREFIX.length)
  await supabase.storage.from('game-images').remove([path])
}
