/**
 * The PVME "Bossing Path" guide (https://pvme.io/pvme-guides/new-to-bossing/bossing-path/), RS3 PvM.
 * Wording follows the guide; Discord emoji, channel and role mentions are replaced with plain names.
 * Goal keys are saved with a character's progress, so never rename or renumber them.
 */

export type PvmStageId = 'introductory' | 'intermediate' | 'advanced'

export type PvmGoal = {
  key: string
  text: string
  /** Extra detail shown under the goal. */
  note?: string
}

/** `path` is the guide's location on pvme.io, e.g. 'basic-guides/araxxor-basic'. */
export type PvmGuideLink = { label: string; path: string }

export type PvmBoss = {
  key: string
  name: string
  summary: string[]
  /** The guide's "Learning Opportunities". */
  learn: string[]
  /** The guide's "Introductory Milestones" and "Advanced Milestones". */
  introductory: PvmGoal[]
  advanced: PvmGoal[]
  guides: PvmGuideLink[]
}

export type PvmStage = {
  id: PvmStageId
  label: string
  blurb: string
  bosses: PvmBoss[]
}

export const PVME_GUIDES_URL = 'https://pvme.io/pvme-guides/'
export const BOSSING_PATH_GUIDE = 'new-to-bossing/bossing-path'

const MASTERY: PvmGuideLink = { label: 'Mastery roles', path: 'get-involved/mastery' }

export const PVM_STAGES: PvmStage[] = [
  {
    id: 'introductory',
    label: 'Introductory',
    blurb:
      'Bosses in this category serve as a great place to start in your journey to learn more about the combat system and engage in harder PvM content. While not as rewarding in terms of loot, they will provide you with many opportunities to improve your skillset.',
    bosses: [
      {
        key: 'arch-glacor',
        name: 'Arch-Glacor',
        summary: [
          'Arguably the best boss for overall learning, Arch-Glacor provides a customisable bossing experience. In normal mode, the player may turn mechanics on and off to learn them at their own pace. Once comfortable with a few mechanics, the player can turn many mechanics on at once to test their knowledge. In hard mode, all mechanics are enabled, with a few changes, and survivability becomes more of a challenge.',
          'In general, it is recommended to start on normal mode, progress through the mechanics, and work up to unlocking & successfully completing a hard mode kill.',
        ],
        learn: [
          'Build familiarity with defensive abilities, like Anticipate and Devotion.',
          'Practice precise movement across a large arena.',
          'Learn basic prayer flicking, and eventually Soul Split flicking.',
        ],
        introductory: [
          { key: 'arch-glacor:intro-1', text: 'Complete a normal mode kill with no mechanics enabled.' },
          { key: 'arch-glacor:intro-2', text: 'Complete five normal mode kills, each one with a different single mechanic enabled.' },
          { key: 'arch-glacor:intro-3', text: 'Complete a normal mode kill with all mechanics enabled.' },
          { key: 'arch-glacor:intro-4', text: 'Complete a hard mode kill.' },
        ],
        advanced: [
          {
            key: 'arch-glacor:adv-1',
            text: 'Complete a hard mode kill using no food, at any enrage, by using Soul Split flicking.',
            note: "Try to keep Soul Split active as much as possible, while flicking to Deflect Magic, Deflect Melee or Deflect Missiles for Arch-Glacor's auto attacks.",
          },
          { key: 'arch-glacor:adv-2', text: 'Complete a 25 kill streak or a 250% enrage kill, in hard mode.' },
        ],
        guides: [{ label: 'Basic guide', path: 'basic-guides/arch-glacor-basic' }],
      },
      {
        key: 'gwd2',
        name: 'GWD2: the Heart of Gielinor',
        summary: [
          'While not providing as flexible of an experience as Arch-Glacor, these four bosses (Vindicta & Gorvek, Helwyr, Gregorovic and the Twin Furies) can provide a host of learning opportunities. They offer their own lessons and can help keep the learning process fresh, rather than just camping Arch-Glacor.',
          'In general, the difficulty of the bosses making up the GWD2 area are (approximately) equal with Gregorovic an exception (slightly harder).',
        ],
        learn: [
          'Practice movement to avoid area of denial mechanics.',
          'Build familiarity with defensive abilities: Resonance (Vindicta/Helwyr), Freedom (Helwyr), Debilitate and Devotion (Helwyr).',
          "Become more comfortable with effectively using damage-boosting ultimates (Berserk / Death's Swiftness / Sunshine / Living Death) to defeat the bosses more quickly.",
          'Learn basic prayer flicking.',
        ],
        introductory: [
          { key: 'gwd2:intro-1', text: 'Kill each one of the GWD2 bosses.' },
          { key: 'gwd2:intro-2', text: 'Get three kills in a row at any GWD2 boss without banking for food.' },
        ],
        advanced: [{ key: 'gwd2:adv-1', text: 'Complete a no-food kill at Vindicta or Helwyr, by making good use of defensive abilities.' }],
        guides: [
          { label: 'Vindicta', path: 'basic-guides/vindicta-basic' },
          { label: 'Helwyr', path: 'basic-guides/helwyr-basic' },
          { label: 'Gregorovic', path: 'basic-guides/gregorovic-basic' },
          { label: 'Twin Furies', path: 'basic-guides/twin-furies-basic' },
        ],
      },
      {
        key: 'osseous',
        name: 'Osseous',
        summary: [
          "Osseous provides a gentle introduction to Necromancy in an environment that fights back. There are some punishing mechanics for the uninitiated but these are quick to learn and mitigate when done correctly. Once you are comfortable with the mechanics, Osseous is a great boss to practice any damage rotation you've learned.",
        ],
        learn: [
          'Build familiarity with defensive abilities like Resonance, Devotion and Reflect.',
          'Become more comfortable using Area-of-Effect abilities at the right time.',
          'Become more comfortable with effectively using your damage-boosting ultimate and adrenaline management for rotations (Living Death) to defeat the boss more quickly.',
          'Learn basic prayer flicking.',
        ],
        introductory: [
          { key: 'osseous:intro-1', text: 'Kill Osseous without signing or activating the Ring of Death effects.' },
          { key: 'osseous:intro-2', text: 'Get three kills in a row without banking for food.' },
        ],
        advanced: [
          { key: 'osseous:adv-1', text: 'Complete a no-food kill at Osseous, by making good use of defensive abilities.' },
          { key: 'osseous:adv-2', text: 'Complete three no-food kills at Osseous in a row, by making good use of defensive abilities and damage rotations.' },
        ],
        guides: [{ label: 'Basic guide', path: 'rs3-full-boss-guides/rex-matriarchs/osseous-basic' }],
      },
    ],
  },
  {
    id: 'intermediate',
    label: 'Intermediate',
    blurb:
      'These bosses will force you to build upon your foundations. Expect more complex mechanics, higher required damage output, and decreased survivability. Bosses are listed in approximate order of difficulty; however, you are free to pick and choose as you like. In general, all styles will be viable for each encounter, though some encounters may be easier using a specific style for the first few attempts. When in doubt, reference their associated guide for recommendations.',
    bosses: [
      {
        key: 'araxxor',
        name: 'Araxxor',
        summary: [
          'A very common milestone for those looking to advance into higher-tier PvM. With more complex mechanics, it will tend to punish players who are unaware of their surroundings or ability usage.',
          'It is highly discouraged to learn Araxxor in duo - it is significantly harder in a duo, and not worth doing.',
        ],
        learn: [
          'Become more comfortable with tracking attack patterns.',
          'Build awareness and confidence in dealing with more complex mechanics.',
          'Prayer flicking (especially in P4).',
        ],
        introductory: [
          { key: 'araxxor:intro-1', text: 'Complete a 0%+ enrage kill on each of three paths.' },
          { key: 'araxxor:intro-2', text: 'Complete a kill at 100% enrage, on any path.' },
        ],
        advanced: [
          { key: 'araxxor:adv-1', text: 'Complete a successful kill on top path (minions) at 160%+ enrage.' },
          { key: 'araxxor:adv-2', text: "At any enrage, complete phase 4 having correctly prayer-flicked each one of Araxxi's auto-attacks." },
        ],
        guides: [{ label: 'Basic guide', path: 'basic-guides/araxxor-basic' }],
      },
      {
        key: 'ed2',
        name: 'Elite Dungeon 2: Dragonkin Laboratory',
        summary: [
          'Generally considered the easiest of the three elite dungeons, ED2 provides a new kind of PvM experience: a large maze-like arena with lots of mobs, and three unique bosses. ED2 can be enjoyed alone or with friends. Due to the nature of the scaling of the dungeon, solo is considered more challenging. However, it is perfectly viable to learn in solo, as well. Players can challenge themselves to complete the dungeon faster and faster as they get more comfortable, through efficient pathing and effective usage of area-of-effect (AoE) abilities and equipment.',
          "Other elite dungeons make for good options as well. After getting comfortable in ED2, feel free to explore the other two dungeons. In general, ED2 < ED1 < ED3 in terms of absolute difficulty; though, ED3's main difficulty lies in the Ambassador, its final boss. The dungeon itself is relatively straightforward compared to ED1.",
        ],
        learn: [
          'Learn how to effectively clear mobs using AoE damage.',
          'Reduce food usage to eliminate frequent banking.',
          'Improve pathing and efficiency of movement across large spaces.',
        ],
        introductory: [
          { key: 'ed2:intro-1', text: 'Complete a duo or trio run through the dungeon, surviving each boss encounter.' },
          { key: 'ed2:intro-2', text: 'Complete a solo run, with no deaths.' },
          { key: 'ed2:intro-3', text: 'Complete a solo run, having banked at most twice.' },
        ],
        advanced: [
          { key: 'ed2:adv-1', text: 'Complete a solo run, having banked only once (or not at all).' },
          { key: 'ed2:adv-2', text: 'Complete a solo run in under 40 minutes.' },
          {
            key: 'ed2:adv-3',
            text: 'Earn the Initiate role in the PvME Mastery system.',
            note: 'ED2 (solo): ≤ 1:00 Astellarn, ≤ 2:00 Verak Lith and ≤ 3:40 Blackstone Dragon.',
          },
        ],
        guides: [{ label: 'Basic guide', path: 'basic-guides/ed2-basic' }, MASTERY],
      },
      {
        key: 'zuk-normal',
        name: 'TzKal-Zuk (Normal Mode)',
        summary: [
          'Similar to an elite dungeon, the TzKal-Zuk encounter is comprised of more than just one boss. In this case, you will face multiple waves of enemies, before facing Zuk himself at the end.',
          'After accomplishing the suggested advanced milestones, if you like, you can freely pursue hard mode for a sizeable step up in difficulty.',
        ],
        learn: [
          'Using precise positioning and defensive abilities to manage damage intake from large mobs and deadly mechanics.',
          'Utilise different kinds of abilities in specific sequences to complete challenge waves.',
          'Become an expert in area-of-effect ability usage to clear mobs efficiently.',
        ],
        introductory: [
          { key: 'zuk-normal:intro-1', text: 'Complete a normal mode run.' },
          { key: 'zuk-normal:intro-2', text: 'Complete a normal mode run with no deaths or teleporting out.' },
        ],
        advanced: [
          { key: 'zuk-normal:adv-1', text: 'Complete a normal mode run in under 30 minutes.' },
          { key: 'zuk-normal:adv-2', text: 'Complete a flawless normal mode run, to unlock hard mode.' },
        ],
        guides: [{ label: 'Basic guide', path: 'basic-guides/tzkal-zuk-basic' }],
      },
    ],
  },
  {
    id: 'advanced',
    label: 'Advanced',
    blurb:
      'At this stage of your learning, there are a lot of options to further your experience and refine your skills. You can revisit previous encounters and try to push farther & faster, or, attempt to learn something harder. The following encounters are ones that we suggest you start with to make a meaningful step into becoming a high-level PvMer.',
    bosses: [
      {
        key: 'raksha',
        name: 'Raksha',
        summary: [
          'This higher-tier boss encounter provides a good challenge along with the prospect of decent rewards. Raksha provides the player with the opportunity to improve multiple aspects of their PvMing skillset. It can be fought alone, or with a friend in a duo.',
          'In general, the easiest way to get your first few kills is to duo in the DPS role. After a handful of kills and becoming more familiar, it is encouraged to either start tanking in a duo or soloing. Soloing from the get-go is also perfectly viable.',
        ],
        learn: [
          'Become proficient in Soul Split flicking.',
          'Learning to maintain high damage output while dealing with moderately involved mechanics.',
        ],
        introductory: [
          { key: 'raksha:intro-1', text: 'Complete a duo kill as DPS.' },
          { key: 'raksha:intro-2', text: "Successfully Soul Split flick against Raksha's auto-attacks for a whole phase." },
          { key: 'raksha:intro-3', text: 'Complete a duo kill as a tank, or complete a solo kill.' },
        ],
        advanced: [
          { key: 'raksha:adv-1', text: 'Complete a solo kill, or duo as tank, while Soul Split flicking through the entire fight.' },
          {
            key: 'raksha:adv-2',
            text: 'Earn the Initiate role in the PvME Mastery system.',
            note: 'Raksha (solo or duo): kill in ≤ 2:10.',
          },
        ],
        guides: [{ label: 'Basic guide', path: 'basic-guides/raksha-basic' }, MASTERY],
      },
      {
        key: 'kerapac-hm',
        name: 'Kerapac: Hard Mode',
        summary: [
          "In hard mode, Kerapac can present a serious challenge for players who aren't efficient in dealing damage and using defensive abilities. Featuring the unique Warp Time mechanic, the encounter feels unique and has a lot of learning opportunities.",
          'Hard mode Kerapac can be enjoyed alone or with friends. The fewer the participants, the harder the encounter. It is recommended to either duo or solo when learning, as a trio does not provide enough of a challenge at this stage to be recommendable. Eventually, the goal is to solo.',
        ],
        learn: [
          'Adapt to unique mechanics and leverage them as part of your damage rotations.',
          'Sustain HP through efficient rotations and defensive ability usage, while under time pressure and dealing with high damage intake (phase 4).',
        ],
        introductory: [{ key: 'kerapac-hm:intro-1', text: 'Complete a duo kill in hard mode.' }],
        advanced: [
          { key: 'kerapac-hm:adv-1', text: 'Complete a solo hard mode kill in under 6 minutes, with no beast of burden familiar.' },
          {
            key: 'kerapac-hm:adv-2',
            text: 'Earn the Initiate role in the PvME Mastery system.',
            note: 'Kerapac (solo HM): kill in ≤ 3:30.',
          },
        ],
        guides: [{ label: 'Basic guide', path: 'basic-guides/kerapac-hm-basic' }, MASTERY],
      },
    ],
  },
]

/** Bosses that each teach one or two specific mechanics to players brand new to PvM. */
export const PVM_HONOURABLE_MENTIONS = [
  { name: 'Ivar', teaches: 'Teaches prayer flicking' },
  { name: 'Silverquill', teaches: 'Teaches reflect mechanics and dealing with minions' },
  { name: 'Flesh-hatcher Mhekarnahz', teaches: 'Teaches area denial and dealing with minions' },
]

export const PVM_GENERAL_INFO = [
  "The goal of this path is to guide players looking for where to start in their PvMing journey. This path isn't set in stone, because everyone learns in different ways. However, this is a decent route to follow. One thing to keep in mind is that if content starts to feel dry, or you just genuinely don't enjoy it: move on to something else. Having an enjoyable experience while learning to boss is much more important than trying to stick to a fixed list of objectives.",
  "Initial combat experience can be gained by doing general Slayer at your own pace. This can be used to get the hang of combat abilities and what they do. You can also take this chance to get used to some keybinds. Alternatively, you may practice on a dummy, though you won't gain any XP or GP, and the dummy doesn't fight back!",
]

export const PVM_LIMITED_LEARNING = {
  blurb:
    'Some encounters in the game do not generally provide a great avenue to learn and improve your skills as a PvMer. These can be done for fun as you wish, however, we do not recommend them for self-improvement.',
  bosses: [
    'Barrows Brothers', 'Chaos Elemental', 'Corporeal Beast', 'Commander Zilyana', 'Dagannoth Kings', 'General Graardor', 'Giant Mole',
    'Kalphite Queen', 'King Black Dragon', "Kree'arra", "K'ril Tsutsaroth", 'Legiones', 'Magister', 'Rex Matriarchs',
  ],
}

export const PVM_NEXT_STEPS = {
  intro: 'If you made it this far, you have all the tools you need to step into just about any encounter in the game. The skills you should have developed at this point include:',
  skills: [
    "Maintaining high damage output while dealing with involved mechanics and keeping track of a boss's attack cycle.",
    'Using defensive abilities as needed to negate specific mechanics and incoming damage.',
    'Leveraging a variety of gear and abilities to deal with different scenarios and enemies.',
    'Moving efficiently throughout arenas of various sizes.',
    'Prayer flicking to both heal yourself and reduce incoming damage.',
  ],
  outro:
    'Past this point, the content you choose to engage with is up to personal preference. When learning new content, it is important to take the same approach as this guide; that is, break your goal down into steps, and tackle them one at a time. In general, it is encouraged to try and find content that challenges you and that you genuinely enjoy doing, rather than suffering through something just to chase a drop (though, we all understand this is easier said than done).',
}

/** Related PVME guides in the same "New to Bossing" section. */
export const PVM_RELATED_GUIDES: PvmGuideLink[] = [
  { label: 'Bossing path (original guide)', path: BOSSING_PATH_GUIDE },
  { label: 'Prayer flicking', path: 'new-to-bossing/prayer-flicking' },
  { label: 'Mid-game combat', path: 'new-to-bossing/mid-game-combat' },
  { label: 'Revolution to full manual', path: 'new-to-bossing/revo-to-full-manual' },
]
