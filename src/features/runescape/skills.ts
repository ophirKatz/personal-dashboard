import {
  Sword, Shield, Dumbbell, Heart, Crosshair, Sparkles, Wand2, CookingPot, TreePine, Feather,
  Fish, Flame, Scissors, Hammer, Pickaxe, FlaskConical, Footprints, Hand, Skull, Sprout,
  Orbit, PawPrint, Home, Bird, Castle, Eye, Lightbulb, Shovel, Ghost,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type Skill = {
  /** RuneMetrics skill id (0-based, Attack = 0). */
  id: number
  name: string
  icon: LucideIcon
  maxLevel: number
  /** Elite XP table (Invention); the standard table doesn't apply. */
  elite?: boolean
}

export const SKILLS: Skill[] = [
  { id: 0, name: 'Attack', icon: Sword, maxLevel: 99 },
  { id: 1, name: 'Defence', icon: Shield, maxLevel: 99 },
  { id: 2, name: 'Strength', icon: Dumbbell, maxLevel: 99 },
  { id: 3, name: 'Constitution', icon: Heart, maxLevel: 99 },
  { id: 4, name: 'Ranged', icon: Crosshair, maxLevel: 99 },
  { id: 5, name: 'Prayer', icon: Sparkles, maxLevel: 99 },
  { id: 6, name: 'Magic', icon: Wand2, maxLevel: 99 },
  { id: 7, name: 'Cooking', icon: CookingPot, maxLevel: 99 },
  { id: 8, name: 'Woodcutting', icon: TreePine, maxLevel: 99 },
  { id: 9, name: 'Fletching', icon: Feather, maxLevel: 99 },
  { id: 10, name: 'Fishing', icon: Fish, maxLevel: 99 },
  { id: 11, name: 'Firemaking', icon: Flame, maxLevel: 99 },
  { id: 12, name: 'Crafting', icon: Scissors, maxLevel: 99 },
  { id: 13, name: 'Smithing', icon: Hammer, maxLevel: 99 },
  { id: 14, name: 'Mining', icon: Pickaxe, maxLevel: 99 },
  { id: 15, name: 'Herblore', icon: FlaskConical, maxLevel: 120 },
  { id: 16, name: 'Agility', icon: Footprints, maxLevel: 99 },
  { id: 17, name: 'Thieving', icon: Hand, maxLevel: 99 },
  { id: 18, name: 'Slayer', icon: Skull, maxLevel: 120 },
  { id: 19, name: 'Farming', icon: Sprout, maxLevel: 120 },
  { id: 20, name: 'Runecrafting', icon: Orbit, maxLevel: 99 },
  { id: 21, name: 'Hunter', icon: PawPrint, maxLevel: 99 },
  { id: 22, name: 'Construction', icon: Home, maxLevel: 99 },
  { id: 23, name: 'Summoning', icon: Bird, maxLevel: 99 },
  { id: 24, name: 'Dungeoneering', icon: Castle, maxLevel: 120 },
  { id: 25, name: 'Divination', icon: Eye, maxLevel: 99 },
  { id: 26, name: 'Invention', icon: Lightbulb, maxLevel: 120, elite: true },
  { id: 27, name: 'Archaeology', icon: Shovel, maxLevel: 120 },
  { id: 28, name: 'Necromancy', icon: Ghost, maxLevel: 120 },
]

export const SKILL_BY_ID = new Map(SKILLS.map(s => [s.id, s]))
export const SKILL_BY_NAME = new Map(SKILLS.map(s => [s.name.toLowerCase(), s]))

const MAX_TABLE_LEVEL = 126

// Standard RS3 table: xp to reach level L = floor(sum_{l=1}^{L-1} floor(l + 300 * 2^(l/7)) / 4)
const XP_TABLE: number[] = (() => {
  const table = [0, 0] // index = level; level 1 = 0 xp
  let points = 0
  for (let level = 1; level < MAX_TABLE_LEVEL; level++) {
    points += Math.floor(level + 300 * Math.pow(2, level / 7))
    table[level + 1] = Math.floor(points / 4)
  }
  return table
})()

export function xpForLevel(level: number): number {
  if (level <= 1) return 0
  return XP_TABLE[Math.min(level, MAX_TABLE_LEVEL)]
}

export function levelForXp(xp: number, maxLevel = 99): number {
  let level = 1
  while (level < maxLevel && xp >= XP_TABLE[level + 1]) level++
  return level
}

/** 0..1 progress through the current level toward the next; 1 when at the cap. */
export function progressToNext(xp: number, level: number, maxLevel: number): number {
  if (level >= maxLevel) return 1
  const start = xpForLevel(level)
  const end = xpForLevel(level + 1)
  if (end <= start) return 0
  return Math.min(1, Math.max(0, (xp - start) / (end - start)))
}

export function formatXp(xp: number): string {
  return Math.floor(xp).toLocaleString('en-US')
}
