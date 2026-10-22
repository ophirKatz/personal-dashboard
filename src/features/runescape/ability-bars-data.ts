/**
 * The RuneScape Wiki's Revolution bars (https://runescape.wiki/w/Revolution/Bars), best-in-slot section, RS3 PvM.
 * Snapshot of the wiki page as edited on 14 Oct 2026 (the single-target subpage on 31 Jul 2026); the wiki is the source of truth.
 * Abilities are listed in action bar order, slot 1 first. Names match the icon files in src/assets/abilities.
 */

export type BarStyleId = 'melee' | 'ranged' | 'magic' | 'necromancy'

export type BarFallback = {
  /** An ability the bar lists that you may not have unlocked yet. */
  missing: string
  /** What to put in its place; when absent, leave the ability out. */
  use?: string
}

export type AbilityBar = {
  key: string
  title: string
  /** How many of the bar's leading slots Revolution fires. Fewer than `abilities.length` means the rest are keybound by hand. */
  revolution: number
  abilities: string[]
  fallbacks?: BarFallback[]
  notes?: string[]
}

export type BarGroup = {
  id: 'single' | 'multi'
  label: string
  note?: string
  bars: AbilityBar[]
}

export type StyleBars = {
  id: BarStyleId
  label: string
  groups: BarGroup[]
}

export const WIKI_BARS_URL = 'https://runescape.wiki/w/Revolution/Bars'
export const WIKI_BARS_SNAPSHOT = '14 Oct 2026'

const FURY: BarFallback = { missing: 'Greater Fury', use: 'Fury' }
const DEATHS_SWIFTNESS: BarFallback = { missing: "Greater Death's Swiftness", use: "Death's Swiftness" }
const RICOCHET: BarFallback = { missing: 'Greater Ricochet', use: 'Ricochet' }
const SUNSHINE: BarFallback = { missing: 'Greater Sunshine', use: 'Sunshine' }
const CONCENTRATED_BLAST: BarFallback = { missing: 'Greater Concentrated Blast', use: 'Concentrated Blast' }
const SONIC_WAVE: BarFallback = { missing: 'Greater Sonic Wave', use: 'Sonic Wave' }
const CHAIN: BarFallback = { missing: 'Greater Chain', use: 'Chain' }

const CONJURES_NOTE = 'Conjure Undead Army needs Skeleton Warrior, Vengeful Ghost and Putrid Zombie selected. Phantom Guardian is optional but useful on harder encounters.'

export const ABILITY_BARS: StyleBars[] = [
  {
    id: 'melee',
    label: 'Melee',
    groups: [
      {
        id: 'single',
        label: 'Single target',
        bars: [
          {
            key: 'melee-single-2h-revo',
            title: 'Two-handed',
            revolution: 10,
            abilities: ['Berserk', 'Meteor Strike', 'Chaos Roar', 'Overpower', 'Rend', 'Dismember', 'Hurricane', 'Adaptive Strike', 'Greater Fury', 'Assault'],
            fallbacks: [FURY],
          },
          {
            key: 'melee-single-2h-manual',
            title: 'Two-handed',
            revolution: 5,
            abilities: ['Rend', 'Adaptive Strike', 'Greater Fury', 'Punish', 'Attack', 'Berserk', 'Overpower', 'Meteor Strike', 'Chaos Roar', 'Hurricane', 'Dismember', 'Assault'],
            fallbacks: [FURY],
          },
          {
            key: 'melee-single-dw-revo',
            title: 'Dual-wield',
            revolution: 10,
            abilities: ['Berserk', 'Meteor Strike', 'Chaos Roar', 'Overpower', 'Rend', 'Dismember', 'Flurry', 'Adaptive Strike', 'Greater Fury', 'Assault'],
            fallbacks: [FURY],
          },
          {
            key: 'melee-single-dw-manual',
            title: 'Dual-wield',
            revolution: 5,
            abilities: ['Rend', 'Adaptive Strike', 'Greater Fury', 'Punish', 'Attack', 'Berserk', 'Overpower', 'Meteor Strike', 'Chaos Roar', 'Flurry', 'Dismember', 'Assault'],
            fallbacks: [FURY],
          },
        ],
      },
      {
        id: 'multi',
        label: 'Multiple targets',
        note: "Dual-wield isn't recommended here: two-handed abilities can use halberd attack range, which greatly widens the area of effect.",
        bars: [
          {
            key: 'melee-multi-2h-damage',
            title: 'Two-handed, higher damage',
            revolution: 10,
            abilities: ['Chaos Roar', 'Meteor Strike', 'Hurricane', 'Adaptive Strike', 'Berserk', 'Overpower', 'Greater Fury', 'Rend', 'Sacrifice', 'Assault'],
            fallbacks: [{ missing: 'Chaos Roar' }, FURY],
          },
          {
            key: 'melee-multi-2h-healing',
            title: 'Two-handed, higher healing',
            revolution: 10,
            abilities: ['Chaos Roar', 'Meteor Strike', 'Hurricane', 'Sacrifice', 'Adaptive Strike', 'Berserk', 'Overpower', 'Greater Fury', 'Rend', 'Assault'],
            fallbacks: [{ missing: 'Chaos Roar' }, FURY],
          },
        ],
      },
    ],
  },
  {
    id: 'ranged',
    label: 'Ranged',
    groups: [
      {
        id: 'single',
        label: 'Single target',
        note: 'Works with bows and crossbows.',
        bars: [
          {
            key: 'ranged-single-revo',
            title: 'Bow or crossbow',
            revolution: 10,
            abilities: ["Greater Death's Swiftness", 'Greater Ricochet', 'Sacrifice', 'Imbue: Shadows', 'Shadow Tendrils', 'Galeshot', 'Rapid Fire', 'Deadshot', 'Snap Shot', 'Piercing Shot'],
            fallbacks: [DEATHS_SWIFTNESS, RICOCHET],
          },
          {
            key: 'ranged-single-manual',
            title: 'Bow or crossbow',
            revolution: 3,
            abilities: ['Greater Ricochet', 'Piercing Shot', 'Ranged attack', "Greater Death's Swiftness", 'Deadshot', 'Rapid Fire', 'Snap Shot', 'Galeshot', 'Imbue: Shadows', 'Shadow Tendrils'],
            fallbacks: [DEATHS_SWIFTNESS, RICOCHET],
          },
        ],
      },
      {
        id: 'multi',
        label: 'Multiple targets',
        note: 'With chinchompas, use the single-target Revolution++ bar instead: your attacks hit a 3x3 area around the target. Otherwise use this bar.',
        bars: [
          {
            key: 'ranged-multi-revo',
            title: 'Any ranged weapon',
            revolution: 9,
            abilities: ['Imbue: Shadows', "Greater Death's Swiftness", 'Corruption Shot', 'Bombardment', 'Greater Ricochet', 'Galeshot', 'Sacrifice', 'Piercing Shot', 'Binding Shot'],
            fallbacks: [DEATHS_SWIFTNESS, RICOCHET],
          },
        ],
      },
    ],
  },
  {
    id: 'magic',
    label: 'Magic',
    groups: [
      {
        id: 'single',
        label: 'Single target',
        note: 'Works with staves and wand/orb setups.',
        bars: [
          {
            key: 'magic-single-revo',
            title: 'Staff or wand/orb',
            revolution: 10,
            abilities: ['Greater Sunshine', 'Tsunami', 'Greater Concentrated Blast', 'Asphyxiate', 'Combust', 'Omnipower', 'Smoke Tendrils', 'Greater Sonic Wave', 'Wild Magic', 'Dragon Breath'],
            fallbacks: [SUNSHINE, CONCENTRATED_BLAST, SONIC_WAVE],
          },
          {
            key: 'magic-single-manual',
            title: 'Staff or wand/orb',
            revolution: 5,
            abilities: ['Greater Concentrated Blast', 'Dragon Breath', 'Magic attack', 'Greater Sonic Wave', 'Combust', 'Greater Sunshine', 'Tsunami', 'Omnipower', 'Asphyxiate', 'Smoke Tendrils', 'Wild Magic', 'Corruption Blast'],
            fallbacks: [SUNSHINE, CONCENTRATED_BLAST, SONIC_WAVE],
          },
        ],
      },
      {
        id: 'multi',
        label: 'Multiple targets',
        note: 'Works with staves and wand/orb setups.',
        bars: [
          {
            key: 'magic-multi-revo',
            title: 'Staff or wand/orb',
            revolution: 9,
            abilities: ['Greater Sunshine', 'Tsunami', 'Greater Chain', 'Omnipower', 'Magma Tempest', 'Corruption Blast', 'Greater Concentrated Blast', 'Dragon Breath', 'Wild Magic'],
            fallbacks: [{ missing: 'Magma Tempest' }, { missing: 'Corruption Blast' }, SUNSHINE, CHAIN, CONCENTRATED_BLAST],
          },
        ],
      },
    ],
  },
  {
    id: 'necromancy',
    label: 'Necromancy',
    groups: [
      {
        id: 'single',
        label: 'Single target',
        bars: [
          {
            key: 'necromancy-single-revo',
            title: 'With conjures',
            revolution: 11,
            abilities: ['Conjure Undead Army', 'Death Skulls', 'Conjure Vengeful Ghost', 'Living Death', 'Soul Sap', 'Conjure Skeleton Warrior', 'Touch of Death', 'Sacrifice', 'Volley of Souls', 'Finger of Death', 'Bloat'],
            notes: [CONJURES_NOTE],
          },
          {
            key: 'necromancy-single-manual',
            title: 'With conjures',
            revolution: 4,
            abilities: ['Conjure Undead Army', 'Soul Sap', 'Touch of Death', 'Necromancy attack', 'Split Soul', 'Death Skulls', 'Living Death', 'Finger of Death', 'Volley of Souls', 'Bloat', 'Spectral Scythe', 'Command Vengeful Ghost', 'Command Skeleton Warrior'],
          },
        ],
      },
      {
        id: 'multi',
        label: 'Multiple targets',
        bars: [
          {
            key: 'necromancy-multi-low-over-10k',
            title: 'Low hourly cost, no conjures: over 10K life points',
            revolution: 8,
            abilities: ['Blood Siphon', 'Spectral Scythe', 'Volley of Souls', 'Touch of Death', 'Finger of Death', 'Soul Sap', 'Sacrifice', 'Necromancy attack'],
            notes: [
              "Spectral Scythe is the main damage source, with Volley of Souls used alongside Zorgoth's soul ring.",
              'Best for Abyssal savages or harder enemies.',
              'Healing is prioritised: Blood Siphon stays first.',
            ],
          },
          {
            key: 'necromancy-multi-low-under-10k',
            title: 'Low hourly cost, no conjures: under 10K life points',
            revolution: 8,
            abilities: ['Spectral Scythe', 'Soul Strike', 'Touch of Death', 'Finger of Death', 'Soul Sap', 'Necromancy attack', 'Blood Siphon', 'Sacrifice'],
            notes: [
              "Spectral Scythe is the main damage source, with Soul Strike used alongside Zorgoth's soul ring.",
              'Best for Abyssal demons or similar-tier monsters, with Aggression potions.',
              'Damage is prioritised; Soul Strike instead of Volley of Souls saves souls against low life point enemies.',
            ],
          },
          {
            key: 'necromancy-multi-high-conjures',
            title: 'High hourly cost, with conjures',
            revolution: 9,
            abilities: ['Conjure Undead Army', 'Conjure Putrid Zombie', 'Death Skulls', 'Touch of Death', 'Spectral Scythe', 'Soul Sap', 'Soul Strike', 'Blood Siphon', 'Finger of Death'],
            notes: [
              'Spectral Scythe is the main damage source, with Finger of Death as support. Soul Strike is three times as effective here because you build more stacks.',
              'Death Skulls and Blood Siphon will rarely activate. Finger of Death only fires with Necrosis stacks; Blood Siphon works on cooldown.',
              CONJURES_NOTE,
            ],
          },
        ],
      },
    ],
  },
]
