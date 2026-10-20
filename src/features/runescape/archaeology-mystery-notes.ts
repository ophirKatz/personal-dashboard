import type { ArchaeologyMysteryNote } from './archaeology'

// Written by hand from each mystery's page on the RuneScape Wiki (https://runescape.wiki/w/Mysteries), keyed like
// archaeology-mysteries-data.ts. The structured facts (level, requirements, dig site, items, rewards) are generated;
// this is only the short summary and where to start. Details such as puzzle solutions are left to the wiki page.
export const ARCHAEOLOGY_MYSTERY_NOTES: Record<string, ArchaeologyMysteryNote> = {
  'breaking-the-seal': {
    about: 'Find out how to open the fortress doors and get into the ruins at Kharid-et.',
    start:
      "Speak to Dr Nabanik by the winch (twice) to get a damaged centurion's seal, then excavate the fort debris until the entrance is revealed and restore the seal.",
  },
  'prison-break': {
    about: 'Work out how to unlock the doors to the prison block under the Kharid-et fortress.',
    start:
      "Collect custodian's log pages 1 and 2 from legionary remains, castra debris or administratum debris, then talk to Liam for the broken prison dial. Only members can enter the prison block.",
  },
  'eyes-in-their-stars': {
    about: 'Learn the true history of the Star Lodge and open the way to the Dungeon of Disorder.',
    start:
      "Interact with the gutted fireplace in the Star Lodge cellar, then excavate lodge art storage or lodge bar storage for the four founder's journal pages. Three crests of Dagon open the passage.",
  },
  'embrace-the-chaos': {
    about: "Perform an incantation to open a portal to the Infernal Source's Vestibule of Futility.",
    start:
      "Excavate the Dungeon of Disorder for the four cultist's diary pages (finding any page starts it), then use chalk and three red candles at the ritual circle in the northeast chamber.",
  },
  'contract-claws': {
    about: 'Placate the 13 guardian gargoyles (the Malebranche) of the Infernal Source.',
    start:
      'Speak to Ophiuchus the gargoyle in the Vestibule of Futility, beside the portal to the Dungeon of Disorder. The others each want a specific item or emote, and the cows, bacon, red dye, frog spawn and bones are consumed, so prepare first.',
  },
  'secrets-of-the-monolith': {
    about: 'A short Archaeology Guild mystery about the mysterious monolith.',
    start:
      'Once you meet the requirements for the Assistant qualification, talk to Acting Guildmaster Reiniger. A cutscene at the monolith starts the mystery; follow the mini-tutorial to finish it.',
  },
  'fallen-angels': {
    about: 'Rebury the remains of an ancient Icyene in a proper manner.',
    start:
      'Excavate prodromoi remains, monoceros remains or keramos material caches at Everlight until you find the icyene remains, then speak to site manager Vanescula Drakan.',
  },
  'queen-of-the-icyene': {
    about: "Track down the four lost pages of Queen Efaritay's journal.",
    start:
      'Excavate prodromoi remains or monoceros remains at the Everlight Dig Site until you have all four pages, then speak to Vanescula Drakan and pick the “more” option to complete it.',
  },
  'time-served': {
    about: "Unseal an inner vault hidden in Kharid-et's prison block.",
    start:
      'Excavate the praesidio remains in the prison block for a damaged ancient timepiece, restore it, then insert it into the ancient mechanism.',
  },
  'shadows-of-the-colossi': {
    about: 'Collect four ancient tablets and talk to Utu.',
    start:
      "Excavate the tablets, in any order, from lunar wheel debris (52), arbour rubble (59), weaver's hut debris (66) or shrine debris (75), then talk to Utu at the Moonrise Dig Site.",
  },
  'fall-and-rise': {
    about: "Gather five athlete's journal pages from the Dominion Games stadium.",
    start:
      'Excavate stadio debris, Dominion Games podium or icyene weapon racks; finding the first page starts it. Hand all five pages to Vanescula Drakan.',
  },
  'empty-children': {
    about: 'Collect six notes and messages around Senntisten.',
    start:
      'Excavate a warning letter (marketplace debris, 63) and a scrawled note (gladiator remains, 66), then study the table in the house at the far south end of the Nodon Front.',
  },
  'night-theatre': {
    about: "Collect five critic's review articles and talk to Jimmy.",
    start:
      'The articles drop randomly from several Senntisten hotspots, starting with cathedral debris (62). Once you have all five, talk to Jimmy, who stands where you arrive at Senntisten.',
  },
  'secrets-of-the-inquisition': {
    about: "Follow Inquisitors Aurelius and Kolton as they investigate Sliske's Praetorians; rewards the Aurelius's Mask relic.",
    start:
      "Start by collecting the first Inquisitor's Memoirs pages and the four elemental funerary urns: the first two pages reveal the Inquisition statues, and the urns activate them.",
  },
  'dagon-bye': {
    about: 'Unlocks the ability to make Ancient Summoning contracts and pouches.',
    start:
      'Restore a chaos star (from the Who Dis? research or Shakroth remains), then use the Infernal Source portals to reach the hydra portal pit and speak to Dagon the Gatekeeper.',
  },
  atonement: {
    about: "Recover the exile's vow page and talk to Gee'ka.",
    start: "Excavate the Ikovian memorial hotspots until you find the exile's vow page, then talk to Gee'ka.",
  },
  'leap-of-faith': {
    about: 'Earn the boots of flight and cross the gaps inside the Stormguard Citadel.',
    start:
      'Try to teleport to the Stormguard Citadel Dig Site. You need a restored Ikovian gerege (from the Ikovian memorial nearby) in your tool belt to enter; inside, excavate the Ikovian memorial for the boots of flight.',
  },
  'the-dour-of-bable': {
    about: "Gather four Archon's journal pages.",
    start:
      'Excavate Oikos studio debris (72) or Oikos fishing hut remnants (84) for the pages, then talk to Vanescula Drakan and choose the mysteries option.',
  },
  'the-cult-of-orcus': {
    about: "Find three of the pater's log pages.",
    start:
      'Excavate Kharid-et chapel debris (74), pontifex remains (81) or Orcus altar (86), then talk to Dr Nabanik near the bank.',
  },
  'a-tangled-web': {
    about: "An unlisted Moonrise mystery: it has no achievement and doesn't count towards Mystery Solver.",
    start:
      'Start at the ancient willow in Moonsylvar Wood and use your restored spider mural to pick the portal matching each moon-phase symbol. Do this eight times to unlock the Cult of the Spider.',
  },
  'path-of-the-initiate': {
    about: 'Make offerings to gain access to the Moonrise Temple.',
    start:
      'Inspect an offering bowl west of the temple doors, restore two offering bowl artefacts and place them, then offer cooked meat, a lit white candle and a jug of wine before talking to Utu.',
  },
  'the-first-commander': {
    about: 'Collect five journal pages and talk to Zanik.',
    start:
      'The pages drop randomly at Warforge hotspots such as gladiatorial goblin remains (76) and crucible stands debris (81). Turn in or transcribe all five, then talk to Zanik.',
  },
  'the-spy-who-loved-metal': {
    about: "Collect three mission reports and talk to Gee'ka.",
    start:
      "Excavate Keshik ger (76) or tailory debris (81) for the three mission report pages, turn in or transcribe them, then talk to Gee'ka.",
  },
  'wing-out': {
    about: 'Find, restore and upgrade an ancient wingsuit used to fly between the Stormguard Citadel islands.',
    start:
      'Restore wingsuit v1 (damaged) from the northern building in the Keshik memorial site and add it to your tool belt, then glide from the bridge edge in the west to collect the two upgrade parts.',
  },
  'cult-classic': {
    about: 'Collect ancient tablets V to VIII and talk to Utu.',
    start: 'Excavate cauldron debris (82) or blood altars (88) for the tablets, then talk to Utu at the Moonrise Dig Site.',
  },
  'out-of-the-crucible': {
    about: 'Clear the barricade that blocks the rest of the Warforge Dig Site.',
    start:
      'Study the huge barricade, excavate it until it is gone (level 83, boostable), then enter the revealed tunnel entrance.',
  },
  'into-the-forge': {
    about: "Collect 11 keys around the Warforge to open the doors of Thalmund's Forge.",
    start:
      "Clear the barricade from Out of the Crucible, investigate the northern door to Thalmund's Forge, then gather the keys from across the dig site. Zanik can replace keys you lose once you have started.",
  },
  'a-study-in-aether': {
    about: "Collect five project journal pages and talk to Gee'ka.",
    start:
      "The pages drop randomly from Stormguard hotspots such as weapons research debris (85) and gravitron research debris (91). Turn in or transcribe all five, then talk to Gee'ka.",
  },
  'a-new-home': {
    about: 'Gather five items for Skaldrun at the Daemonheim Dig Site.',
    start:
      "Excavate Tokshak's and Balarak's rings (castle hall rubble), Halak's ring (tunnelling equipment repository), Yorga's pipe (botanical reserve) and the tarnished plaque (communal space), then hand each to Skaldrun.",
  },
  'inside-you-there-are-two-wolves': {
    about: 'Assemble the lunar wheel from six lunar slabs, one from each Moonrise hotspot.',
    start:
      "Collect a lunar slab from each Moonrise excavation hotspot (uncommon, but guaranteed once you are 10 levels above the hotspot's requirement), place them on the wheel in lunar-phase order, then talk to Utu.",
  },
  'the-final-revolution': {
    about: 'The capstone of the Moonrise mysteries; required to create rings of Kayazu.',
    start:
      "Solve the other four Moonrise mysteries, re-enter Utu's area (for example by going into the Moonrise Temple and back out), and reflect the memorial statue that replaces Utu to receive his letter.",
  },
  'forge-war': {
    about: 'Find the Forge War! page and talk to Zanik.',
    start:
      'Excavate the Big High War God shrine (89), goblin trainee remains (97) or Warforge scrap pile (104) for the page, then talk to Zanik.',
  },
  'crypt-o-zoology': {
    about: 'Collect four research pages and report to Mr Mordaut.',
    start:
      'Excavate varanusaur remains (90), dragonkin reliquary (96) or dragonkin coffins (99), then speak to Mr Mordaut at the Anachronia base camp.',
  },
  'know-thy-measure': {
    about: 'Translate the dragonkin poem through pylon puzzles; needed to reach the Moksha ritual site.',
    start:
      'Head to the Observation outpost, go in the north door and work the dragonkin pylon until the symbols clear, then carry on to the Moksha ritual site.',
  },
  'teleport-node-on': {
    about: 'Activate every Orthen teleportation device across Anachronia.',
    start:
      'Talk to Mr Mordaut at the Anachronia base camp about the Orthen Dig Site (Teleport Node On) and activate the device east of the lodestone. Then do the Crypt of Varanus first and the rest strictly in order, since each one unlocks the research for the next.',
  },
  'the-epic-of-hebe': {
    about: 'Collect five excerpts of the Epic of Hebe.',
    start:
      'Excavate acropolis debris (92) or bibliotheke debris (109), then hand the pages to Vanescula Drakan at the Everlight camp, or just talk to her if they are transcribed.',
  },
  'howl-s-floating-workshop': {
    about: "Reach Howl's floating workshop and uncover its secrets.",
    start:
      'Add wingsuit v3 and a Stormguard gerege to your tool belt, ride the gravitational core up, then study the drafting bench to unlock the Back to the Drawing Board research (level 95, not boostable).',
  },
  'writings-on-the-walls': {
    about: 'Decode strange writings at five dig sites; a late Archaeology Guild mystery.',
    start:
      "Wear the full master archaeologist's outfit (Guildmaster qualification) and study a strange writing, such as the one in the Kharid-et prison block's solitary confinement. Each of the five unlocks a special research mission.",
  },
  'you-have-chosen': {
    about: "Open the way into Bandos's sanctum.",
    start:
      "Complete the Power Behind the Throne research, restore a 'Forged in War' sculpture and a Dorgeshuun spear, use the sculpture at Bandos's throne in the crucible arena, then work through the conversation with Zanik (she wants the spear).",
  },
  'death-watch': {
    about: 'Collect four research pages and report to Mr Mordaut.',
    start:
      'Excavate autopsy tables (101) or experiment workbenches (102), then speak to Mr Mordaut at the Anachronia base camp.',
  },
  'hallowed-be': {
    about: "Open the Everlight's underwater cave, repair its mechanism and restore the mosaic.",
    start:
      "Light the sconce under the Acropolis in southern Everlight with a dominion torch to open the door, then walk west through the tunnel to unlock the mystery. The mosaic needs 300 mosaic pieces and the 'Hallowed Be the Everlight' painting.",
  },
  'the-everlight': {
    about: 'Light the Everlight lighthouse using the four bucklers.',
    start:
      "It is uncovered by excavating any of the bucklers at Everlight. Repair the Statue of Padosan with 10 white marble and a dominion torch to get a gold Dominion medal, then take it to Padomenes at the White Knights' Castle courtyard.",
  },
  'free-your-mind': {
    about: 'Collect four pages and report to Mr Mordaut.',
    start:
      'Excavate Aughra remains (106) or Moksha devices (108), then speak to Mr Mordaut at the Anachronia base camp.',
  },
  decimation: {
    about: "Find all six pages of the commander's log.",
    start:
      'Excavate ancient magick munitions (107), praetorian remains (114) or war table debris (118), then talk to Dr Nabanik.',
  },
  'shadow-fall': {
    about: "Find all five pages of the praetorian's log.",
    start:
      'Excavate ancient magick munitions (107), praetorian remains (114) or war table debris (118), then talk to Dr Nabanik.',
  },
  'the-forgotten-prisoner': {
    about: "Talk to the strange device behind the maximum security barrier in the prison block's solitary confinement.",
    start:
      'Enter the opened solitary confinement area of the Kharid-et prison block and get past the barrier; you need the pontifex signet ring, legatus pendant and portable phylactery.',
  },
  'the-vault-of-shadows': {
    about: 'Solve four spell-scroll puzzles to open the vault hidden in the shadow realm (also a quest).',
    start:
      "Activate the four dial buttons around Kharid-et with restored spell scrolls ('Incite Fear', 'Exsanguinate', 'Smoke Cloud', 'Animate Dead'). Dr Nabanik can loan scrolls for the quest, but you need restored ones for the Archaeology reward.",
  },
  'fragmented-memories': {
    about: 'Calibrate the Moksha device and catch a tranquil yellow salamander; unlocks Mysterious City.',
    start:
      'Study the Moksha device at the Moksha ritual site to uncover the mystery, then excavate a damaged master control (Moksha device) and a damaged singing bowl (Aughra remains) and restore both.',
  },
  'heart-of-the-forge': {
    about: 'Collect five pages and report to Zanik.',
    start: 'Excavate Warforge weapon racks (110) or makeshift pie ovens (119), then talk to Zanik.',
  },
  'a-new-form': {
    about: 'Gather five items for Skaldrun at the Daemonheim Dig Site.',
    start:
      "Excavate a polished stone and 'charm plate' (projection space), a chunk of primal alloy (security booth), and a cracked totem and mangled trinket (traveller's station), then hand them to Skaldrun.",
  },
  'a-new-age': {
    about: 'The final Daemonheim mystery: investigate the mysterious engine in the Depths.',
    start:
      'First unlock the Daemonheim – Depths site (95 Dungeoneering, 103 Archaeology, Twilight of the Gods, A New Home, A New Form and the Thought Process research). Then excavate a strange token, inspect it and talk to Skaldrun.',
  },
  'i-am-become-death': {
    about: 'Collect four pages and report to Mr Mordaut.',
    start:
      'Excavate Xolo mine (113), Xolo remains (119) or Saurthen debris (120), then speak to Mr Mordaut at the Anachronia base camp.',
  },
  'mysterious-city': {
    about: "Enter Xolo City and restore its pyramid and building; rewards the mysterious monolith's additional power.",
    start:
      "After Fragmented Memories, restore a lingam stone (Moksha device hotspots) and use it on the door to Xolo City. Then restore a 'Raksha' idol and a gold dish from Saurthen debris, place them in the city and return to the mysterious monolith at the Archaeology Campus.",
  },
}
