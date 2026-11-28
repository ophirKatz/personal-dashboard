// The home page greeting. Pure (no React, no Supabase), so it can be unit-tested.

export const MAX_DISPLAY_NAME_LENGTH = 40

/**
 * What to store for a typed name: whitespace trimmed and collapsed, cut to the length the
 * database allows (counting characters, so an emoji isn't split), and null when nothing is left.
 */
export function normalizeDisplayName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.trim().replace(/\s+/g, ' ')
  if (!name) return null
  return Array.from(name).slice(0, MAX_DISPLAY_NAME_LENGTH).join('').trim() || null
}

/** "Good morning, Sam 👋", or "Good morning 👋" when no name is set. */
export function greetingText(name: string | null | undefined, hour: number): string {
  const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const who = normalizeDisplayName(name)
  return who ? `${part}, ${who} 👋` : `${part} 👋`
}
