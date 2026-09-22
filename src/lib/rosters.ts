// Team Roster del Rulebook Blood Bowl 2025 (Third Season Edition), pagine 160-188.
// Trascritti così come stampati: nomi, quantità, costi, caratteristiche, skill e categorie.
// Le skill con parametro (es. "Loner (4+)") mantengono il testo del libro; per collegarle alla
// tabella skills si usa il nome base (vedi skillBaseName).

export type SpecialRule =
  | 'Brawlin Brutes'
  | 'Bribery and Corruption'
  | 'Favoured of'
  | 'Low Cost Linemen'
  | 'Masters of Undeath'
  | 'Swarming'
  | 'Team Captain';

export type TeamLeague =
  | 'Badlands Brawl'
  | 'Chaos Clash'
  | 'Elven Kingdoms League'
  | 'Halfling Thimble Cup'
  | 'Lustrian Superleague'
  | 'Old World Classic'
  | 'Sylvanian Spotlight'
  | 'Underworld Challenge'
  | 'Woodland League'
  | 'Worlds Edge Superleague';

export type SkillCategory = 'A' | 'D' | 'G' | 'M' | 'P' | 'S';

export type RosterPosition = {
  key: string;
  name: string;
  keywords: string[];
  max: number;          // QTY 0-X
  cost: number;
  ma: number;
  st: number;
  ag: string;
  pa: string;           // '-' se il giocatore non ha PA
  av: string;
  skills: string[];
  primary: SkillCategory[];
  secondary: SkillCategory[];
};

// Limite condiviso tra più posizioni (es. "may have a single Big Guy, chosen from the following")
export type PositionGroup = { label: string; max: number; positions: string[] };

export type Roster = {
  key: string;
  name: string;
  page: number;
  leagues: TeamLeague[];
  specialRules: SpecialRule[];
  // Favoured of: allineamento fisso (una sola voce) oppure a scelta
  favouredOf?: string[];
  // Norse: Favoured of Khorne solo se si sceglie Chaos Clash
  favouredIfLeague?: { league: TeamLeague; favouredOf: string };
  rerollCost: number;
  apothecary: boolean;
  positions: RosterPosition[];
  groups?: PositionGroup[];
};

// "If a team has a choice of any alignment" (p. 154)
export const ANY_ALIGNMENT = ['Hashut', 'Khorne', 'Nurgle', 'Slaanesh', 'Tzeentch', 'Undivided'];

const p = (
  key: string, name: string, keywords: string[], max: number, cost: number,
  ma: number, st: number, ag: string, pa: string, av: string,
  skills: string[], primary: string, secondary: string,
): RosterPosition => ({
  key, name, keywords, max, cost, ma, st, ag, pa, av, skills,
  primary: primary.split('').filter(Boolean) as SkillCategory[],
  secondary: secondary.split('').filter(Boolean) as SkillCategory[],
});

const TROLL_SKILLS = ['Always Hungry', 'Mighty Blow', 'Projectile Vomit', 'Really Stupid', 'Regeneration', 'Throw Team-mate'];
const TROLL_LONER_SKILLS = ['Always Hungry', 'Loner (4+)', 'Mighty Blow', 'Projectile Vomit', 'Really Stupid', 'Regeneration', 'Throw Team-mate'];
const MINOTAUR_SKILLS = ['Frenzy', 'Horns', 'Loner (4+)', 'Mighty Blow', 'Thick Skull', 'Unchannelled Fury'];
const ALTERN_TREEMAN_SKILLS = ['Mighty Blow', 'Stand Firm', 'Strong Arm', 'Take Root', 'Thick Skull', 'Throw Team-mate', 'Timmm-ber!'];
const OGRE_LONER3_SKILLS = ['Bone Head', 'Loner (3+)', 'Mighty Blow', 'Thick Skull', 'Throw Team-mate'];
const RAT_OGRE_SKILLS = ['Animal Savagery', 'Frenzy', 'Loner (4+)', 'Mighty Blow', 'Prehensile Tail'];

export const ROSTERS: Roster[] = [
  {
    key: 'amazon', name: 'Amazon', page: 160,
    leagues: ['Lustrian Superleague'], specialRules: [], rerollCost: 60000, apothecary: true,
    positions: [
      p('eagle-warrior', 'Eagle Warrior', ['Human', 'Lineman'], 16, 50000, 6, 3, '3+', '4+', '8+', ['Dodge'], 'G', 'AS'),
      p('python-warrior', 'Python Warrior', ['Human', 'Thrower'], 2, 80000, 6, 3, '3+', '3+', '8+', ['Dodge', 'On the Ball', 'Pass', 'Safe Pass'], 'GP', 'AS'),
      p('piranha-warrior', 'Piranha Warrior', ['Blitzer', 'Human'], 2, 90000, 7, 3, '3+', '4+', '8+', ['Dodge', 'Hit and Run', 'Jump Up'], 'AG', 'S'),
      p('jaguar-warrior', 'Jaguar Warrior', ['Blocker', 'Human'], 2, 110000, 6, 4, '3+', '4+', '9+', ['Defensive', 'Dodge'], 'GS', 'A'),
    ],
  },
  {
    key: 'black-orc', name: 'Black Orc', page: 161,
    leagues: ['Badlands Brawl'], specialRules: ['Brawlin Brutes', 'Bribery and Corruption'], rerollCost: 60000, apothecary: true,
    positions: [
      p('goblin-bruiser', 'Goblin Bruiser', ['Goblin', 'Lineman'], 16, 45000, 6, 2, '3+', '4+', '8+', ['Dodge', 'Right Stuff', 'Stunty', 'Thick Skull'], 'AD', 'GPS'),
      p('black-orc', 'Black Orc', ['Blocker', 'Orc'], 6, 90000, 4, 4, '4+', '5+', '10+', ['Brawler', 'Grab'], 'GS', 'AD'),
      p('trained-troll', 'Trained Troll', ['Big Guy', 'Troll'], 1, 115000, 4, 5, '5+', '5+', '10+', TROLL_SKILLS, 'S', 'AGP'),
    ],
  },
  {
    key: 'bretonnian', name: 'Bretonnian', page: 162,
    leagues: ['Old World Classic'], specialRules: [], rerollCost: 60000, apothecary: true,
    positions: [
      p('bretonnian-squire', 'Bretonnian Squire', ['Human', 'Lineman'], 16, 50000, 6, 3, '3+', '4+', '8+', ['Wrestle'], 'G', 'AS'),
      p('knight-catcher', 'Bretonnian Knight Catcher', ['Catcher', 'Human'], 2, 85000, 7, 3, '3+', '4+', '9+', ['Catch', 'Dauntless', 'Nerves of Steel'], 'AG', 'S'),
      p('knight-thrower', 'Bretonnian Knight Thrower', ['Human', 'Thrower'], 2, 80000, 6, 3, '3+', '3+', '9+', ['Dauntless', 'Nerves of Steel', 'Pass'], 'GP', 'AS'),
      p('grail-knight', 'Grail Knight', ['Blitzer', 'Human'], 2, 95000, 7, 3, '3+', '4+', '10+', ['Block', 'Dauntless', 'Steady Footing'], 'GS', 'A'),
    ],
  },
  {
    key: 'chaos-chosen', name: 'Chaos Chosen', page: 163,
    leagues: ['Chaos Clash'], specialRules: ['Favoured of'], favouredOf: ANY_ALIGNMENT, rerollCost: 50000, apothecary: true,
    positions: [
      p('beastmen-lineman', 'Beastmen Lineman', ['Beastman', 'Lineman'], 16, 55000, 6, 3, '3+', '3+', '9+', ['Horns', 'Thick Skull'], 'GM', 'ADPS'),
      p('chaos-chosen', 'Chaos Chosen', ['Blocker', 'Human'], 4, 100000, 5, 4, '3+', '5+', '10+', ['Arm Bar'], 'GMS', 'AD'),
      p('troll', 'Troll', ['Big Guy', 'Troll'], 1, 115000, 4, 5, '5+', '5+', '10+', TROLL_LONER_SKILLS, 'MS', 'AGP'),
      p('ogre', 'Ogre', ['Big Guy', 'Ogre'], 1, 140000, 5, 5, '4+', '5+', '10+', ['Bone Head', 'Loner (4+)', 'Mighty Blow', 'Thick Skull', 'Throw Team-mate'], 'MS', 'AG'),
      p('minotaur', 'Minotaur', ['Big Guy', 'Minotaur'], 1, 150000, 5, 5, '4+', '6+', '9+', MINOTAUR_SKILLS, 'MS', 'AG'),
    ],
    groups: [{ label: 'Big Guy', max: 1, positions: ['troll', 'ogre', 'minotaur'] }],
  },
  {
    key: 'chaos-dwarf', name: 'Chaos Dwarf', page: 164,
    leagues: ['Badlands Brawl', 'Chaos Clash'], specialRules: ['Favoured of'], favouredOf: ['Hashut'], rerollCost: 70000, apothecary: true,
    positions: [
      p('hobgoblin-lineman', 'Hobgoblin Lineman', ['Goblin', 'Lineman'], 16, 40000, 6, 3, '3+', '4+', '8+', [], 'D', 'AGS'),
      p('sneaky-stabba', 'Sneaky Stabba', ['Goblin', 'Special'], 2, 60000, 6, 3, '3+', '5+', '8+', ['Shadowing', 'Stab'], 'DG', 'AS'),
      p('chaos-dwarf-blocker', 'Chaos Dwarf Blocker', ['Blocker', 'Dwarf'], 4, 70000, 4, 3, '4+', '6+', '10+', ['Block', 'Iron Hard Skin', 'Thick Skull'], 'GS', 'ADM'),
      p('flamesmith', 'Flamesmith', ['Dwarf', 'Special'], 2, 80000, 5, 3, '4+', '6+', '10+', ['Brawler', 'Breathe Fire', 'Disturbing Presence', 'Thick Skull'], 'GS', 'ADM'),
      p('bull-centaur', 'Bull Centaur', ['Blitzer', 'Dwarf'], 2, 130000, 6, 4, '4+', '6+', '10+', ['Sprint', 'Sure Feet', 'Thick Skull', 'Unsteady'], 'GS', 'ADM'),
      p('minotaur', 'Minotaur', ['Big Guy', 'Minotaur'], 1, 150000, 5, 5, '4+', '6+', '9+', MINOTAUR_SKILLS, 'MS', 'AG'),
    ],
  },
  {
    key: 'chaos-renegade', name: 'Chaos Renegade', page: 165,
    leagues: ['Chaos Clash'], specialRules: ['Favoured of'], favouredOf: ['Khorne', 'Nurgle', 'Slaanesh', 'Tzeentch', 'Undivided'],
    rerollCost: 70000, apothecary: true,
    positions: [
      p('renegade-human', 'Renegade Human', ['Human', 'Lineman'], 16, 50000, 6, 3, '3+', '4+', '9+', ['Animosity (all)'], 'DGM', 'AS'),
      p('renegade-goblin', 'Renegade Goblin', ['Goblin', 'Lineman'], 1, 40000, 6, 2, '3+', '4+', '8+', ['Animosity (all)', 'Dodge', 'Right Stuff', 'Stunty'], 'ADM', 'GP'),
      p('renegade-orc', 'Renegade Orc', ['Lineman', 'Orc'], 1, 50000, 5, 3, '3+', '4+', '10+', ['Animosity (all)'], 'DGM', 'AS'),
      p('renegade-skaven', 'Renegade Skaven', ['Lineman', 'Skaven'], 1, 50000, 7, 3, '3+', '4+', '8+', ['Animosity (all)'], 'DGM', 'AS'),
      p('renegade-dark-elf', 'Renegade Dark Elf', ['Elf', 'Lineman'], 1, 65000, 6, 3, '2+', '3+', '9+', ['Animosity (all)'], 'ADGM', 'S'),
      p('renegade-human-thrower', 'Renegade Human Thrower', ['Human', 'Thrower'], 1, 75000, 6, 3, '3+', '3+', '9+', ['Animosity (all)', 'Pass', 'Sure Hands'], 'DGMP', 'AS'),
      p('troll', 'Troll', ['Big Guy', 'Troll'], 1, 115000, 4, 5, '5+', '5+', '10+', TROLL_LONER_SKILLS, 'S', 'AGMP'),
      p('ogre', 'Ogre', ['Big Guy', 'Ogre'], 1, 140000, 5, 5, '4+', '5+', '10+', ['Bone Head', 'Loner (4+)', 'Thick Skull', 'Throw Team-mate'], 'S', 'AGM'),
      p('minotaur', 'Minotaur', ['Big Guy', 'Minotaur'], 1, 150000, 5, 5, '4+', '6+', '9+', MINOTAUR_SKILLS, 'S', 'AGM'),
      p('rat-ogre', 'Rat Ogre', ['Big Guy', 'Skaven'], 1, 150000, 6, 5, '4+', '6+', '9+', RAT_OGRE_SKILLS, 'S', 'AGM'),
    ],
    groups: [{ label: 'Big Guy', max: 3, positions: ['troll', 'ogre', 'minotaur', 'rat-ogre'] }],
  },
  {
    key: 'dark-elf', name: 'Dark Elf', page: 166,
    leagues: ['Elven Kingdoms League'], specialRules: [], rerollCost: 50000, apothecary: true,
    positions: [
      p('dark-elf-lineman', 'Dark Elf Lineman', ['Elf', 'Lineman'], 16, 65000, 6, 3, '2+', '3+', '9+', [], 'AG', 'DS'),
      p('dark-elf-runner', 'Dark Elf Runner', ['Elf', 'Runner'], 2, 80000, 7, 3, '2+', '3+', '8+', ['Dump-off', 'Punt'], 'AGP', 'DS'),
      p('dark-elf-assassin', 'Dark Elf Assassin', ['Elf', 'Special'], 2, 90000, 7, 3, '2+', '4+', '8+', ['Hit and Run', 'Shadowing', 'Stab'], 'AD', 'GS'),
      p('dark-elf-blitzer', 'Dark Elf Blitzer', ['Blitzer', 'Elf'], 2, 105000, 7, 3, '2+', '3+', '9+', ['Block'], 'AG', 'DPS'),
      p('witch-elf', 'Witch Elf', ['Elf', 'Special'], 2, 110000, 7, 3, '2+', '4+', '8+', ['Dodge', 'Frenzy', 'Jump Up'], 'AG', 'DS'),
    ],
  },
  {
    key: 'dwarf', name: 'Dwarf', page: 167,
    leagues: ['Worlds Edge Superleague'], specialRules: ['Brawlin Brutes', 'Bribery and Corruption'], rerollCost: 60000, apothecary: true,
    positions: [
      p('dwarf-lineman', 'Dwarf Lineman', ['Dwarf', 'Lineman'], 16, 70000, 4, 3, '4+', '5+', '10+', ['Block', 'Defensive', 'Thick Skull'], 'DG', 'S'),
      p('dwarf-runner', 'Dwarf Runner', ['Dwarf', 'Runner'], 2, 80000, 6, 3, '3+', '4+', '9+', ['Sprint', 'Sure Hands', 'Thick Skull'], 'GP', 'S'),
      p('dwarf-blitzer', 'Dwarf Blitzer', ['Blitzer', 'Dwarf'], 2, 100000, 5, 3, '4+', '4+', '10+', ['Block', 'Diving Tackle', 'Tackle', 'Thick Skull'], 'GS', 'P'),
      p('troll-slayer', 'Troll Slayer', ['Dwarf', 'Special'], 2, 95000, 5, 3, '4+', '5+', '9+', ['Block', 'Dauntless', 'Frenzy', 'Hatred (Troll)', 'Thick Skull'], 'GS', 'D'),
      p('deathroller', 'Deathroller', ['Big Guy', 'Dwarf', 'Special'], 1, 170000, 5, 7, '5+', '-', '11+', ['Break Tackle', 'Dirty Player', 'Juggernaut', 'Loner (4+)', 'Mighty Blow', 'No Ball', 'Secret Weapon', 'Stand Firm'], 'DS', 'G'),
    ],
  },
  {
    key: 'elven-union', name: 'Elven Union', page: 168,
    leagues: ['Elven Kingdoms League'], specialRules: [], rerollCost: 50000, apothecary: true,
    positions: [
      p('elf-lineman', 'Elf Lineman', ['Elf', 'Lineman'], 16, 65000, 6, 3, '2+', '3+', '8+', ['Fumblerooski'], 'AG', 'S'),
      p('elf-thrower', 'Elf Thrower', ['Elf', 'Thrower'], 2, 75000, 6, 3, '2+', '2+', '8+', ['Hail Mary Pass', 'Pass'], 'AGP', 'S'),
      p('elf-catcher', 'Elf Catcher', ['Catcher', 'Elf'], 2, 100000, 8, 3, '2+', '4+', '8+', ['Catch', 'Diving Catch', 'Nerves of Steel'], 'AG', 'S'),
      p('elf-blitzer', 'Elf Blitzer', ['Blitzer', 'Elf'], 2, 115000, 7, 3, '2+', '3+', '9+', ['Block', 'Sidestep'], 'AG', 'PS'),
    ],
  },
  {
    key: 'gnome', name: 'Gnome', page: 169,
    leagues: ['Halfling Thimble Cup', 'Woodland League'], specialRules: [], rerollCost: 50000, apothecary: true,
    positions: [
      p('gnome-lineman', 'Gnome Lineman', ['Gnome', 'Lineman'], 16, 40000, 5, 2, '3+', '4+', '7+', ['Jump Up', 'Right Stuff', 'Stunty', 'Wrestle'], 'A', 'DGS'),
      p('woodland-fox', 'Woodland Fox', ['Animal', 'Runner'], 2, 50000, 7, 2, '2+', '-', '6+', ['Dodge', 'My Ball', 'Sidestep', 'Stunty'], '', 'A'),
      p('gnome-illusionist', 'Gnome Illusionist', ['Gnome', 'Special'], 2, 50000, 5, 2, '3+', '3+', '7+', ['Jump Up', 'Stunty', 'Trickster', 'Wrestle'], 'AP', 'DG'),
      p('gnome-beastmaster', 'Gnome Beastmaster', ['Blocker', 'Gnome'], 2, 55000, 5, 2, '3+', '4+', '8+', ['Guard', 'Jump Up', 'Stunty', 'Wrestle'], 'A', 'DGS'),
      p('altern-forest-treeman', 'Altern Forest Treeman', ['Big Guy', 'Treeman'], 2, 120000, 2, 6, '5+', '5+', '11+', ALTERN_TREEMAN_SKILLS, 'S', 'AGP'),
    ],
  },
  {
    key: 'goblin', name: 'Goblin', page: 170,
    leagues: ['Badlands Brawl', 'Underworld Challenge'], specialRules: ['Bribery and Corruption'], rerollCost: 60000, apothecary: true,
    positions: [
      p('goblin-lineman', 'Goblin Lineman', ['Goblin', 'Lineman'], 16, 40000, 6, 2, '3+', '4+', '8+', ['Dodge', 'Right Stuff', 'Stunty'], 'AD', 'GPS'),
      p('loony', 'Loony', ['Goblin', 'Special'], 1, 40000, 6, 2, '3+', '-', '8+', ['Chainsaw', 'No Ball', 'Secret Weapon', 'Stunty'], 'D', 'AGS'),
      p('bomma', 'Bomma', ['Goblin', 'Special'], 1, 45000, 6, 2, '3+', '4+', '8+', ['Bombardier', 'Dodge', 'Secret Weapon', 'Stunty'], 'DP', 'AGS'),
      p('ooligan', "'Ooligan", ['Goblin', 'Special'], 1, 60000, 6, 2, '3+', '5+', '8+', ['Dirty Player', 'Disturbing Presence', 'Dodge', 'Right Stuff', 'Stunty', 'Taunt'], 'AD', 'GS'),
      p('doom-diver', 'Doom Diver', ['Goblin', 'Special'], 1, 65000, 6, 2, '3+', '6+', '8+', ['Dodge', 'Right Stuff', 'Stunty', 'Swoop'], 'A', 'DGS'),
      p('fanatic', 'Fanatic', ['Goblin', 'Special'], 1, 70000, 3, 7, '3+', '-', '8+', ['Ball & Chain', 'No Ball', 'Secret Weapon', 'Stunty'], 'DS', 'AG'),
      p('pogoer', 'Pogoer', ['Goblin', 'Special'], 1, 75000, 7, 2, '3+', '4+', '8+', ['Dodge', 'Pogo', 'Stunty'], 'A', 'DGS'),
      p('trained-troll', 'Trained Troll', ['Big Guy', 'Troll'], 2, 115000, 4, 5, '5+', '5+', '10+', TROLL_SKILLS, 'S', 'AGP'),
    ],
  },
  {
    key: 'halfling', name: 'Halfling', page: 171,
    leagues: ['Halfling Thimble Cup', 'Woodland League'], specialRules: [], rerollCost: 60000, apothecary: true,
    positions: [
      p('halfling-hopeful', 'Halfling Hopeful', ['Halfling', 'Lineman'], 16, 30000, 5, 2, '3+', '4+', '7+', ['Dodge', 'Right Stuff', 'Stunty'], 'A', 'DGS'),
      p('halfling-hefty', 'Halfling Hefty', ['Blocker', 'Halfling'], 2, 50000, 5, 2, '3+', '3+', '8+', ['Dodge', 'Fend', 'Stunty'], 'AP', 'DGS'),
      p('halfling-catcher', 'Halfling Catcher', ['Catcher', 'Halfling'], 2, 55000, 5, 2, '3+', '4+', '7+', ['Catch', 'Dodge', 'Right Stuff', 'Sprint', 'Stunty'], 'A', 'DGS'),
      p('altern-forest-treeman', 'Altern Forest Treeman', ['Big Guy', 'Treeman'], 2, 120000, 2, 6, '5+', '5+', '11+', ALTERN_TREEMAN_SKILLS, 'S', 'AGP'),
    ],
  },
  {
    key: 'human', name: 'Human', page: 172,
    leagues: ['Old World Classic'], specialRules: ['Team Captain'], rerollCost: 50000, apothecary: true,
    positions: [
      p('human-lineman', 'Human Lineman', ['Human', 'Lineman'], 16, 50000, 6, 3, '3+', '4+', '9+', [], 'G', 'ADS'),
      p('halfling-hopeful', 'Halfling Hopeful', ['Halfling', 'Lineman'], 3, 30000, 5, 2, '3+', '4+', '7+', ['Dodge', 'Right Stuff', 'Stunty'], 'A', 'DGS'),
      p('human-catcher', 'Human Catcher', ['Catcher', 'Human'], 2, 75000, 8, 3, '3+', '4+', '8+', ['Catch', 'Dodge'], 'AG', 'DPS'),
      p('human-thrower', 'Human Thrower', ['Human', 'Thrower'], 2, 75000, 6, 3, '3+', '3+', '9+', ['Pass', 'Sure Hands'], 'GP', 'ADS'),
      p('human-blitzer', 'Human Blitzer', ['Blitzer', 'Human'], 2, 85000, 7, 3, '3+', '4+', '9+', ['Block', 'Tackle'], 'GS', 'AD'),
      p('ogre', 'Ogre', ['Big Guy', 'Ogre'], 1, 140000, 5, 5, '4+', '5+', '10+', OGRE_LONER3_SKILLS, 'S', 'AGM'),
    ],
  },
  {
    key: 'imperial-nobility', name: 'Imperial Nobility', page: 173,
    leagues: ['Old World Classic'], specialRules: [], rerollCost: 60000, apothecary: true,
    positions: [
      p('imperial-retainer', 'Imperial Retainer', ['Human', 'Lineman'], 16, 45000, 6, 3, '3+', '4+', '8+', ['Fend'], 'G', 'AS'),
      p('imperial-thrower', 'Imperial Thrower', ['Human', 'Thrower'], 2, 75000, 6, 3, '3+', '2+', '9+', ['Give and Go', 'Pass', 'Pro'], 'GP', 'AS'),
      p('bodyguard', 'Bodyguard', ['Blocker', 'Human'], 4, 85000, 5, 3, '3+', '4+', '9+', ['Stand Firm', 'Wrestle'], 'GS', 'A'),
      p('noble-blitzer', 'Noble Blitzer', ['Blitzer', 'Human'], 2, 90000, 7, 3, '3+', '4+', '9+', ['Block', 'Catch', 'Pro'], 'AG', 'PS'),
      p('ogre', 'Ogre', ['Big Guy', 'Ogre'], 1, 140000, 5, 5, '4+', '5+', '10+', OGRE_LONER3_SKILLS, 'S', 'AGM'),
    ],
  },
  {
    key: 'khorne', name: 'Khorne', page: 174,
    leagues: ['Chaos Clash'], specialRules: ['Brawlin Brutes', 'Favoured of'], favouredOf: ['Khorne'], rerollCost: 60000, apothecary: true,
    positions: [
      p('bloodborn-marauder', 'Bloodborn Marauder', ['Human', 'Lineman'], 16, 50000, 6, 3, '3+', '4+', '8+', ['Frenzy'], 'GM', 'ADS'),
      p('khorngor', 'Khorngor', ['Beastman', 'Runner'], 2, 70000, 6, 3, '3+', '4+', '9+', ['Horns', 'Juggernaut', 'Jump Up', 'Thick Skull'], 'GMS', 'ADP'),
      p('bloodseeker', 'Bloodseeker', ['Blocker', 'Human'], 4, 105000, 5, 4, '4+', '6+', '10+', ['Frenzy'], 'GMS', 'AD'),
      p('bloodspawn', 'Bloodspawn', ['Big Guy', 'Spawn'], 1, 160000, 5, 5, '4+', '6+', '9+', ['Claws', 'Frenzy', 'Loner (4+)', 'Mighty Blow', 'Unchannelled Fury'], 'MS', 'AG'),
    ],
  },
  {
    key: 'lizardmen', name: 'Lizardmen', page: 175,
    leagues: ['Lustrian Superleague'], specialRules: [], rerollCost: 70000, apothecary: true,
    positions: [
      p('skink-lineman', 'Skink Lineman', ['Lineman', 'Lizardman'], 16, 60000, 8, 2, '3+', '4+', '8+', ['Dodge', 'Stunty'], 'A', 'GDPS'),
      p('chameleon-skink', 'Chameleon Skink', ['Lizardman', 'Thrower'], 2, 70000, 7, 2, '3+', '3+', '8+', ['Dodge', 'On the Ball', 'Shadowing', 'Stunty'], 'AP', 'GDS'),
      p('saurus-blocker', 'Saurus Blocker', ['Blocker', 'Lizardman'], 6, 90000, 6, 4, '5+', '6+', '10+', ['Juggernaut', 'Unsteady'], 'GS', 'A'),
      p('kroxigor', 'Kroxigor', ['Big Guy', 'Lizardman'], 1, 140000, 6, 5, '5+', '6+', '10+', ['Bone Head', 'Loner (4+)', 'Mighty Blow', 'Prehensile Tail', 'Thick Skull'], 'S', 'AG'),
    ],
  },
  {
    key: 'necromantic-horror', name: 'Necromantic Horror', page: 176,
    leagues: ['Sylvanian Spotlight'], specialRules: ['Masters of Undeath'], rerollCost: 70000, apothecary: false,
    positions: [
      p('zombie-lineman', 'Zombie Lineman', ['Human', 'Lineman', 'Undead', 'Zombie'], 16, 40000, 4, 3, '4+', '6+', '9+', ['Eye Gouge', 'Regeneration', 'Unsteady'], 'DG', 'AS'),
      p('ghoul-runner', 'Ghoul Runner', ['Ghoul', 'Runner', 'Undead'], 2, 75000, 7, 3, '3+', '3+', '8+', ['Dodge', 'Regeneration'], 'AG', 'DPS'),
      p('wraith', 'Wraith', ['Blocker', 'Undead', 'Wraith'], 2, 85000, 6, 3, '3+', '-', '9+', ['Block', 'Foul Appearance', 'No Ball', 'Regeneration', 'Sidestep'], 'GS', 'AD'),
      p('flesh-golem', 'Flesh Golem', ['Blocker', 'Construct', 'Undead'], 2, 110000, 4, 4, '4+', '6+', '10+', ['Regeneration', 'Stand Firm', 'Thick Skull', 'Unsteady'], 'GS', 'AD'),
      p('werewolf', 'Werewolf', ['Blitzer', 'Undead', 'Werewolf'], 2, 120000, 8, 3, '3+', '3+', '9+', ['Claws', 'Frenzy', 'Regeneration'], 'AG', 'DPS'),
    ],
  },
  {
    key: 'norse', name: 'Norse', page: 177,
    leagues: ['Chaos Clash', 'Old World Classic'], specialRules: [],
    favouredIfLeague: { league: 'Chaos Clash', favouredOf: 'Khorne' }, rerollCost: 60000, apothecary: true,
    positions: [
      p('norse-raider', 'Norse Raider', ['Human', 'Lineman'], 16, 50000, 6, 3, '3+', '4+', '8+', ['Block', 'Drunkard', 'Thick Skull', 'Unsteady'], 'G', 'APS'),
      p('beer-boar', 'Beer Boar', ['Animal', 'Special'], 2, 20000, 5, 1, '3+', '-', '6+', ['Dodge', 'No Ball', 'Pick-me-up', 'Stunty', 'Titchy'], '', 'A'),
      p('norse-berserker', 'Norse Berserker', ['Blitzer', 'Human'], 2, 90000, 6, 3, '3+', '5+', '8+', ['Block', 'Frenzy', 'Jump Up'], 'GS', 'AP'),
      p('valkyrie', 'Valkyrie', ['Catcher', 'Human', 'Thrower'], 2, 95000, 7, 3, '3+', '3+', '8+', ['Catch', 'Dauntless', 'Pass', 'Strip Ball'], 'AGP', 'S'),
      p('ulfwerener', 'Ulfwerener', ['Blocker', 'Human'], 2, 105000, 6, 4, '4+', '6+', '9+', ['Frenzy', 'Unsteady'], 'GS', 'A'),
      p('yhetee', 'Yhetee', ['Big Guy', 'Yhetee'], 1, 140000, 5, 5, '4+', '6+', '9+', ['Claws', 'Disturbing Presence', 'Frenzy', 'Loner (4+)', 'Unchannelled Fury'], 'S', 'AG'),
    ],
  },
  {
    key: 'nurgle', name: 'Nurgle', page: 178,
    leagues: ['Chaos Clash'], specialRules: ['Brawlin Brutes', 'Favoured of'], favouredOf: ['Nurgle'], rerollCost: 60000, apothecary: false,
    positions: [
      p('rotter-lineman', 'Rotter Lineman', ['Human', 'Lineman'], 16, 40000, 5, 3, '4+', '6+', '9+', ['Decay', 'Plague Ridden'], 'DGM', 'AS'),
      p('pestigor', 'Pestigor', ['Beastman', 'Runner'], 2, 70000, 6, 3, '3+', '4+', '9+', ['Horns', 'Plague Ridden', 'Regeneration', 'Steady Footing', 'Thick Skull'], 'GMS', 'ADP'),
      p('bloater', 'Bloater', ['Blocker', 'Human'], 4, 110000, 4, 4, '4+', '6+', '10+', ['Disturbing Presence', 'Foul Appearance', 'Plague Ridden', 'Regeneration', 'Stand Firm', 'Unsteady'], 'GMS', 'AD'),
      p('rotspawn', 'Rotspawn', ['Big Guy', 'Spawn'], 1, 140000, 4, 5, '5+', '6+', '10+', ['Disturbing Presence', 'Foul Appearance', 'Loner (4+)', 'Mighty Blow', 'Pick-me-up', 'Plague Ridden', 'Really Stupid', 'Regeneration', 'Tentacles'], 'S', 'DGM'),
    ],
  },
  {
    key: 'ogre', name: 'Ogre', page: 179,
    leagues: ['Badlands Brawl', 'Worlds Edge Superleague'], specialRules: ['Brawlin Brutes', 'Low Cost Linemen'], rerollCost: 70000, apothecary: true,
    positions: [
      p('gnoblar-lineman', 'Gnoblar Lineman', ['Gnoblar', 'Lineman'], 16, 15000, 5, 1, '3+', '4+', '6+', ['Dodge', 'Right Stuff', 'Sidestep', 'Stunty', 'Titchy'], 'AD', 'G'),
      p('ogre-blocker', 'Ogre Blocker', ['Big Guy', 'Blocker', 'Ogre'], 5, 140000, 5, 5, '4+', '5+', '10+', ['Bone Head', 'Mighty Blow', 'Thick Skull', 'Throw Team-mate'], 'S', 'ADGP'),
      p('ogre-runt-punter', 'Ogre Runt Punter', ['Big Guy', 'Ogre', 'Thrower'], 1, 145000, 5, 5, '4+', '4+', '10+', ['Bone Head', 'Kick Team-mate', 'Mighty Blow', 'Thick Skull'], 'PS', 'ADG'),
    ],
  },
  {
    key: 'old-world-alliance', name: 'Old World Alliance', page: 180,
    leagues: ['Old World Classic'], specialRules: [], rerollCost: 70000, apothecary: true,
    positions: [
      p('human-lineman', 'Human Lineman', ['Human', 'Lineman'], 16, 50000, 6, 3, '3+', '4+', '9+', [], 'G', 'AS'),
      p('halfling-hopeful', 'Halfling Hopeful', ['Halfling', 'Lineman'], 5, 30000, 5, 2, '3+', '4+', '7+', ['Dodge', 'Right Stuff', 'Stunty'], 'A', 'GS'),
      p('human-catcher', 'Human Catcher', ['Catcher', 'Human'], 1, 75000, 8, 3, '3+', '4+', '8+', ['Catch', 'Dodge'], 'AG', 'PS'),
      p('dwarf-lineman', 'Dwarf Lineman', ['Dwarf', 'Lineman'], 3, 70000, 4, 3, '4+', '5+', '10+', ['Block', 'Defensive', 'Thick Skull'], 'DG', 'S'),
      p('human-thrower', 'Human Thrower', ['Human', 'Thrower'], 1, 75000, 6, 3, '3+', '3+', '9+', ['Pass', 'Sure Hands'], 'GP', 'AS'),
      p('dwarf-runner', 'Dwarf Runner', ['Dwarf', 'Runner'], 1, 80000, 6, 3, '3+', '4+', '9+', ['Sprint', 'Sure Hands', 'Thick Skull'], 'GP', 'AS'),
      p('human-blitzer', 'Human Blitzer', ['Blitzer', 'Human'], 1, 85000, 7, 3, '3+', '4+', '9+', ['Block', 'Tackle'], 'GS', 'A'),
      p('dwarf-blitzer', 'Dwarf Blitzer', ['Blitzer', 'Dwarf'], 1, 100000, 5, 3, '4+', '4+', '10+', ['Block', 'Diving Tackle', 'Tackle', 'Thick Skull'], 'GS', 'P'),
      p('troll-slayer', 'Troll Slayer', ['Dwarf', 'Special'], 1, 95000, 5, 3, '4+', '5+', '9+', ['Block', 'Dauntless', 'Frenzy', 'Hatred (Troll)', 'Thick Skull'], 'GS', 'A'),
      p('ogre', 'Ogre', ['Big Guy', 'Ogre'], 1, 140000, 5, 5, '4+', '5+', '10+', OGRE_LONER3_SKILLS, 'S', 'AGM'),
      p('altern-forest-treeman', 'Altern Forest Treeman', ['Big Guy', 'Treeman'], 1, 120000, 2, 6, '5+', '5+', '11+', ALTERN_TREEMAN_SKILLS, 'S', 'AGP'),
    ],
    groups: [{ label: 'Big Guy', max: 1, positions: ['ogre', 'altern-forest-treeman'] }],
  },
  {
    key: 'orc', name: 'Orc', page: 181,
    leagues: ['Badlands Brawl'], specialRules: ['Brawlin Brutes', 'Team Captain'], rerollCost: 60000, apothecary: true,
    positions: [
      p('orc-lineman', 'Orc Lineman', ['Lineman', 'Orc'], 16, 50000, 5, 3, '3+', '4+', '10+', [], 'GS', 'AD'),
      p('goblin-lineman', 'Goblin Lineman', ['Goblin', 'Lineman'], 4, 40000, 6, 2, '3+', '3+', '8+', ['Dodge', 'Right Stuff', 'Stunty'], 'AD', 'GPS'),
      p('orc-thrower', 'Orc Thrower', ['Orc', 'Thrower'], 2, 75000, 6, 3, '3+', '3+', '9+', ['Pass', 'Sure Hands'], 'GP', 'ADS'),
      p('orc-blitzer', 'Orc Blitzer', ['Blitzer', 'Orc'], 2, 85000, 6, 3, '3+', '4+', '10+', ['Block', 'Break Tackle'], 'GS', 'AD'),
      p('big-un-blocker', 'Big Un Blocker', ['Blocker', 'Orc'], 2, 95000, 5, 4, '4+', '6+', '10+', ['Mighty Blow', 'Taunt', 'Thick Skull', 'Unsteady'], 'GS', 'AD'),
      p('troll', 'Troll', ['Big Guy', 'Troll'], 1, 115000, 4, 5, '5+', '5+', '10+', TROLL_LONER_SKILLS, 'S', 'AGP'),
    ],
  },
  {
    key: 'shambling-undead', name: 'Shambling Undead', page: 182,
    leagues: ['Sylvanian Spotlight'], specialRules: ['Masters of Undeath'], rerollCost: 70000, apothecary: false,
    positions: [
      p('skeleton-lineman', 'Skeleton Lineman', ['Human', 'Lineman', 'Skeleton', 'Undead'], 16, 40000, 5, 3, '4+', '6+', '8+', ['Regeneration', 'Thick Skull'], 'G', 'ADS'),
      p('zombie-lineman', 'Zombie Lineman', ['Human', 'Lineman', 'Undead', 'Zombie'], 16, 40000, 4, 3, '4+', '6+', '9+', ['Eye Gouge', 'Regeneration', 'Unsteady'], 'DG', 'AS'),
      p('ghoul-runner', 'Ghoul Runner', ['Ghoul', 'Runner', 'Undead'], 2, 75000, 7, 3, '3+', '3+', '8+', ['Dodge', 'Regeneration'], 'AG', 'DPS'),
      p('wight-blitzer', 'Wight Blitzer', ['Blitzer', 'Human', 'Skeleton', 'Undead'], 2, 95000, 6, 3, '3+', '5+', '9+', ['Block', 'Regeneration', 'Tackle', 'Thick Skull'], 'GS', 'AD'),
      p('mummy', 'Mummy', ['Big Guy', 'Blocker', 'Human', 'Undead'], 2, 125000, 3, 5, '5+', '6+', '10+', ['Mighty Blow', 'Regeneration'], 'S', 'AG'),
    ],
  },
  {
    key: 'skaven', name: 'Skaven', page: 183,
    leagues: ['Underworld Challenge'], specialRules: [], rerollCost: 50000, apothecary: true,
    positions: [
      p('skaven-clanrat', 'Skaven Clanrat', ['Lineman', 'Skaven'], 16, 50000, 7, 3, '3+', '4+', '8+', [], 'DG', 'AMS'),
      p('skaven-thrower', 'Skaven Thrower', ['Skaven', 'Thrower'], 2, 80000, 7, 3, '3+', '2+', '8+', ['Pass', 'Sure Hands'], 'GP', 'ADMS'),
      p('gutter-runner', 'Gutter Runner', ['Runner', 'Skaven'], 2, 85000, 9, 2, '2+', '4+', '8+', ['Dodge', 'Stab'], 'ADG', 'MS'),
      p('skaven-blitzer', 'Skaven Blitzer', ['Blitzer', 'Skaven'], 2, 90000, 8, 3, '3+', '4+', '9+', ['Block', 'Strip Ball'], 'GS', 'ADM'),
      p('rat-ogre', 'Rat Ogre', ['Big Guy', 'Skaven'], 1, 150000, 6, 5, '4+', '6+', '9+', RAT_OGRE_SKILLS, 'S', 'AGM'),
    ],
  },
  {
    key: 'snotling', name: 'Snotling', page: 184,
    leagues: ['Underworld Challenge'], specialRules: ['Bribery and Corruption', 'Low Cost Linemen', 'Swarming'], rerollCost: 70000, apothecary: true,
    positions: [
      p('snotling-lineman', 'Snotling Lineman', ['Lineman', 'Snotling'], 16, 15000, 5, 1, '3+', '4+', '6+', ['Dodge', 'Insignificant', 'Right Stuff', 'Sidestep', 'Stunty', 'Titchy'], 'AD', 'G'),
      p('fun-hoppa', 'Fun-hoppa', ['Snotling', 'Special'], 2, 20000, 6, 1, '3+', '4+', '6+', ['Dodge', 'Pogo', 'Right Stuff', 'Sidestep', 'Stunty'], 'AD', 'G'),
      p('stilty-runna', 'Stilty Runna', ['Runner', 'Snotling'], 2, 20000, 6, 1, '3+', '4+', '6+', ['Dodge', 'Right Stuff', 'Sidestep', 'Sprint', 'Stunty'], 'AD', 'G'),
      p('fungus-flinga', 'Fungus Flinga', ['Snotling', 'Special'], 2, 30000, 5, 1, '3+', '4+', '6+', ['Bombardier', 'Dodge', 'Right Stuff', 'Secret Weapon', 'Sidestep', 'Stunty', 'Titchy'], 'ADP', 'G'),
      p('pump-wagon', 'Pump Wagon', ['Big Guy', 'Snotling', 'Special'], 2, 100000, 5, 5, '5+', '6+', '9+', ['Dirty Player', 'Juggernaut', 'Mighty Blow', 'Really Stupid', 'Stand Firm'], 'DS', 'AG'),
      p('trained-troll', 'Trained Troll', ['Big Guy', 'Troll'], 2, 115000, 4, 5, '5+', '5+', '10+', TROLL_SKILLS, 'S', 'AGP'),
    ],
  },
  {
    key: 'tomb-kings', name: 'Tomb Kings', page: 185,
    leagues: ['Sylvanian Spotlight'], specialRules: ['Masters of Undeath'], rerollCost: 60000, apothecary: false,
    positions: [
      p('skeleton-lineman', 'Skeleton Lineman', ['Human', 'Lineman', 'Skeleton', 'Undead'], 16, 40000, 5, 3, '4+', '6+', '8+', ['Regeneration', 'Thick Skull'], 'G', 'ADS'),
      p('tomb-kings-thrower', 'Tomb Kings Thrower', ['Human', 'Skeleton', 'Thrower', 'Undead'], 2, 65000, 6, 3, '4+', '3+', '9+', ['Pass', 'Regeneration', 'Sure Hands', 'Thick Skull'], 'GP', 'ADS'),
      p('tomb-kings-blitzer', 'Tomb Kings Blitzer', ['Blitzer', 'Human', 'Skeleton', 'Undead'], 2, 85000, 6, 3, '4+', '5+', '9+', ['Block', 'Regeneration', 'Thick Skull'], 'GS', 'AD'),
      p('tomb-guardian', 'Tomb Guardian', ['Big Guy', 'Blocker', 'Human', 'Undead'], 4, 115000, 4, 5, '5+', '6+', '10+', ['Brawler', 'Decay', 'Regeneration'], 'S', 'AG'),
    ],
  },
  {
    key: 'underworld-denizens', name: 'Underworld Denizens', page: 186,
    leagues: ['Underworld Challenge'], specialRules: ['Bribery and Corruption'], rerollCost: 70000, apothecary: true,
    positions: [
      p('goblin-lineman', 'Goblin Lineman', ['Goblin', 'Lineman'], 16, 40000, 6, 2, '3+', '4+', '8+', ['Dodge', 'Right Stuff', 'Stunty'], 'ADM', 'GPS'),
      p('snotling-lineman', 'Snotling Lineman', ['Lineman', 'Snotling'], 6, 15000, 5, 1, '3+', '4+', '6+', ['Dodge', 'Insignificant', 'Right Stuff', 'Sidestep', 'Stunty', 'Titchy'], 'ADM', 'G'),
      p('skaven-clanrat', 'Skaven Clanrat', ['Lineman', 'Skaven'], 3, 50000, 7, 3, '3+', '4+', '8+', ['Animosity (Goblin)'], 'DGM', 'AS'),
      p('skaven-thrower', 'Skaven Thrower', ['Skaven', 'Thrower'], 1, 80000, 7, 3, '3+', '2+', '8+', ['Animosity (Goblin)', 'Pass', 'Sure Hands'], 'GMP', 'ADS'),
      p('gutter-runner', 'Gutter Runner', ['Runner', 'Skaven'], 1, 85000, 9, 2, '2+', '4+', '8+', ['Animosity (Goblin)', 'Dodge', 'Stab'], 'ADGM', 'S'),
      p('skaven-blitzer', 'Skaven Blitzer', ['Blitzer', 'Skaven'], 1, 90000, 8, 3, '3+', '4+', '9+', ['Animosity (Goblin)', 'Block', 'Strip Ball'], 'GMS', 'AD'),
      p('troll', 'Troll', ['Big Guy', 'Troll'], 1, 115000, 4, 5, '5+', '5+', '10+', TROLL_LONER_SKILLS, 'MS', 'AGP'),
      p('rat-ogre', 'Rat Ogre', ['Big Guy', 'Skaven'], 1, 150000, 6, 5, '4+', '6+', '9+', RAT_OGRE_SKILLS, 'MS', 'AG'),
    ],
    groups: [{ label: 'Big Guy', max: 1, positions: ['troll', 'rat-ogre'] }],
  },
  {
    key: 'vampire', name: 'Vampire', page: 187,
    leagues: ['Sylvanian Spotlight'], specialRules: ['Masters of Undeath'], rerollCost: 60000, apothecary: true,
    positions: [
      p('thrall-lineman', 'Thrall Lineman', ['Human', 'Lineman', 'Thrall'], 16, 40000, 6, 3, '3+', '4+', '8+', [], 'G', 'AS'),
      p('vampire-runner', 'Vampire Runner', ['Runner', 'Undead', 'Vampire'], 2, 100000, 8, 3, '2+', '3+', '8+', ['Bloodlust (2+)', 'Hypnotic Gaze', 'Regeneration'], 'AG', 'PS'),
      p('vampire-thrower', 'Vampire Thrower', ['Thrower', 'Undead', 'Vampire'], 2, 110000, 6, 4, '2+', '2+', '9+', ['Bloodlust (2+)', 'Hypnotic Gaze', 'Pass', 'Regeneration'], 'AGP', 'S'),
      p('vampire-blitzer', 'Vampire Blitzer', ['Blitzer', 'Undead', 'Vampire'], 2, 110000, 6, 4, '2+', '4+', '9+', ['Bloodlust (3+)', 'Hypnotic Gaze', 'Juggernaut', 'Regeneration'], 'AGS', ''),
      p('vargheist', 'Vargheist', ['Big Guy', 'Undead', 'Vampire'], 1, 150000, 5, 5, '4+', '6+', '10+', ['Bloodlust (3+)', 'Claws', 'Frenzy', 'Loner (4+)', 'Regeneration'], 'S', 'AG'),
    ],
  },
  {
    key: 'wood-elf', name: 'Wood Elf', page: 188,
    leagues: ['Elven Kingdoms League', 'Woodland League'], specialRules: [], rerollCost: 50000, apothecary: true,
    positions: [
      p('wood-elf-lineman', 'Wood Elf Lineman', ['Elf', 'Lineman'], 16, 65000, 7, 3, '2+', '3+', '8+', [], 'AG', 'S'),
      p('wood-elf-thrower', 'Wood Elf Thrower', ['Elf', 'Thrower'], 2, 85000, 7, 3, '2+', '2+', '8+', ['Pass', 'Safe Pair of Hands'], 'AGP', 'S'),
      p('wood-elf-catcher', 'Wood Elf Catcher', ['Catcher', 'Elf'], 2, 90000, 8, 2, '2+', '3+', '8+', ['Catch', 'Dodge', 'Sprint'], 'AG', 'PS'),
      p('wardancer', 'Wardancer', ['Blitzer', 'Elf'], 2, 130000, 8, 3, '2+', '3+', '8+', ['Block', 'Dodge', 'Leap'], 'AG', 'PS'),
      p('loren-forest-treeman', 'Loren Forest Treeman', ['Big Guy', 'Treeman'], 1, 120000, 2, 6, '5+', '5+', '11+', ['Loner (4+)', 'Mighty Blow', 'Stand Firm', 'Strong Arm', 'Take Root', 'Thick Skull', 'Throw Team-mate'], 'S', 'AGP'),
    ],
  },
];

export const getRoster = (key: string | null | undefined) => ROSTERS.find(r => r.key === key) ?? null;

export const getPosition = (roster: Roster | null, positionKey: string | null | undefined) =>
  roster?.positions.find(pos => pos.key === positionKey) ?? null;

export const hasRule = (roster: Roster | null, rule: SpecialRule) => !!roster?.specialRules.includes(rule);

export const isLineman = (position: RosterPosition | null) => !!position?.keywords.includes('Lineman');

// Journeymen: posizioni Lineman con QTY 0-16 (p. 94)
export const journeymanPositions = (roster: Roster | null) =>
  roster ? roster.positions.filter(pos => isLineman(pos) && pos.max === 16) : [];

// "Loner (4+)" -> "Loner"
export const skillBaseName = (skill: string) => skill.replace(/\s*\(.*\)\s*$/, '').trim();

// Favoured of effettivo per una squadra (fisso, scelto o dipendente dalla League)
export function favouredOptions(roster: Roster | null, league: string | null | undefined): string[] {
  if (!roster) return [];
  if (roster.favouredIfLeague) return roster.favouredIfLeague.league === league ? [roster.favouredIfLeague.favouredOf] : [];
  return roster.favouredOf ?? [];
}

// Nomi dei roster come erano salvati nel vecchio campo "race" (migrazione e compatibilità)
export const LEGACY_RACE_TO_ROSTER: Record<string, string> = {
  'Amazons': 'amazon', 'Black Orcs': 'black-orc', 'Bretonnian': 'bretonnian', 'Chaos Chosen': 'chaos-chosen',
  'Chaos Dwarves': 'chaos-dwarf', 'Chaos Renegades': 'chaos-renegade', 'Dark Elf': 'dark-elf', 'Dwarves': 'dwarf',
  'Elf Union': 'elven-union', 'Gnomes': 'gnome', 'Goblins': 'goblin', 'Halflings': 'halfling', 'High Elves': '',
  'Humans': 'human', 'Imperial Nobility': 'imperial-nobility', 'Khorne': 'khorne', 'Lizardmen': 'lizardmen',
  'Necromantics': 'necromantic-horror', 'Norse': 'norse', 'Nurgle': 'nurgle', 'Ogre': 'ogre',
  'Old World Alliance': 'old-world-alliance', 'Orcs': 'orc', 'Shambling Undead': 'shambling-undead', 'Skaven': 'skaven',
  'Slanns': '', 'Snotlings': 'snotling', 'Tomb Kings': 'tomb-kings', 'Underworlds Denizens': 'underworld-denizens',
  'Vampires': 'vampire', 'Wood Elves': 'wood-elf',
};
