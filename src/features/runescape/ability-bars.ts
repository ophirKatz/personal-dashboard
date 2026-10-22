import type { AbilityBar } from './ability-bars-data'

/** The default keybinds of the main action bar's first twelve slots; slots 13 and 14 have none. */
export const SLOT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='] as const

export type Slot = { position: number; ability: string; key: string | null }

export type BarRow = { label: string; slots: Slot[] }

export const isManualBar = (bar: AbilityBar) => bar.revolution < bar.abilities.length

/** Icon file name for an ability, e.g. "Death's Swiftness" -> "deaths-swiftness". */
export const abilitySlug = (name: string) => name.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const range = (from: number, to: number) => (from === to ? `slot ${from}` : `slots ${from}-${to}`)

/** A Revolution++ bar is one row; a manual bar splits into what Revolution fires and what you keybind. */
export function barRows(bar: AbilityBar): BarRow[] {
  const slots: Slot[] = bar.abilities.map((ability, i) => ({ position: i + 1, ability, key: SLOT_KEYS[i] ?? null }))
  if (!isManualBar(bar)) return [{ label: `Revolution, ${range(1, slots.length)}`, slots }]
  return [
    { label: `Revolution, ${range(1, bar.revolution)}`, slots: slots.slice(0, bar.revolution) },
    { label: `Keybind by hand, ${range(bar.revolution + 1, slots.length)}`, slots: slots.slice(bar.revolution) },
  ]
}
