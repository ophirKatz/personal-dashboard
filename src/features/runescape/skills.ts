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
  /** Elite XP table (Invention); the standard table doesn't apply. */
  elite?: boolean
}

export const SKILLS: Skill[] = [
  { id: 0, name: 'Attack', icon: Sword },
  { id: 1, name: 'Defence', icon: Shield },
  { id: 2, name: 'Strength', icon: Dumbbell },
  { id: 3, name: 'Constitution', icon: Heart },
  { id: 4, name: 'Ranged', icon: Crosshair },
  { id: 5, name: 'Prayer', icon: Sparkles },
  { id: 6, name: 'Magic', icon: Wand2 },
  { id: 7, name: 'Cooking', icon: CookingPot },
  { id: 8, name: 'Woodcutting', icon: TreePine },
  { id: 9, name: 'Fletching', icon: Feather },
  { id: 10, name: 'Fishing', icon: Fish },
  { id: 11, name: 'Firemaking', icon: Flame },
  { id: 12, name: 'Crafting', icon: Scissors },
  { id: 13, name: 'Smithing', icon: Hammer },
  { id: 14, name: 'Mining', icon: Pickaxe },
  { id: 15, name: 'Herblore', icon: FlaskConical },
  { id: 16, name: 'Agility', icon: Footprints },
  { id: 17, name: 'Thieving', icon: Hand },
  { id: 18, name: 'Slayer', icon: Skull },
  { id: 19, name: 'Farming', icon: Sprout },
  { id: 20, name: 'Runecrafting', icon: Orbit },
  { id: 21, name: 'Hunter', icon: PawPrint },
  { id: 22, name: 'Construction', icon: Home },
  { id: 23, name: 'Summoning', icon: Bird },
  { id: 24, name: 'Dungeoneering', icon: Castle },
  { id: 25, name: 'Divination', icon: Eye },
  { id: 26, name: 'Invention', icon: Lightbulb, elite: true },
  { id: 27, name: 'Archaeology', icon: Shovel },
  { id: 28, name: 'Necromancy', icon: Ghost },
]

export const SKILL_BY_ID = new Map(SKILLS.map(s => [s.id, s]))
export const SKILL_BY_NAME = new Map(SKILLS.map(s => [s.name.toLowerCase(), s]))

/** Every skill can be trained past 99 up to a virtual level of 120 (200M xp is the hard cap). */
export const VIRTUAL_MAX = 120

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

export function levelForXp(xp: number, maxLevel = VIRTUAL_MAX): number {
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

/**
 * Level as shown in game, including virtual levels. The APIs cap the reported level at the
 * skill's real max (e.g. Defence 99), so derive it from xp; Invention's elite table differs,
 * so trust the API there.
 */
export function skillLevel(skill: Skill, stat: { level: number; xp: number }): number {
  if (skill.elite) return stat.level
  return Math.max(stat.level, levelForXp(stat.xp, VIRTUAL_MAX))
}
