// Keep in sync by hand with UNIT_VOCABULARY in
// supabase/functions/import-recipe/index.ts — the Deno edge function can't
// import from src/, so this list is duplicated there.
export const UNIT_OPTIONS = [
  'cup', 'tablespoon', 'teaspoon', 'pinch', 'milliliter', 'liter', 'gram', 'kilogram',
  'ounce', 'pound', 'clove', 'whole', 'slice', 'can', 'pack',
] as const

export const FRACTION_OPTIONS: Array<{ label: string; value: number }> = [
  { label: '¼', value: 0.25 },
  { label: '⅓', value: 1 / 3 },
  { label: '½', value: 0.5 },
  { label: '⅔', value: 2 / 3 },
  { label: '¾', value: 0.75 },
]
