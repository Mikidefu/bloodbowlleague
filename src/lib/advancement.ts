// Regole degli avanzamenti SPP (Rulebook 2025, pp. 97-98), condivise tra interfaccia e API.

export const MAX_ADVANCEMENTS = 6;

export const ADVANCEMENT_TIERS = [
  { name: 'Experienced (1st)', randomPrimary: 3, choosePrimary: 6, chooseSecondary: 10, stat: 14 },
  { name: 'Veteran (2nd)', randomPrimary: 4, choosePrimary: 8, chooseSecondary: 12, stat: 16 },
  { name: 'Emerging Star (3rd)', randomPrimary: 6, choosePrimary: 12, chooseSecondary: 16, stat: 20 },
  { name: 'Star (4th)', randomPrimary: 8, choosePrimary: 16, chooseSecondary: 20, stat: 24 },
  { name: 'Superstar (5th)', randomPrimary: 10, choosePrimary: 20, chooseSecondary: 24, stat: 28 },
  { name: 'Legend (6th)', randomPrimary: 15, choosePrimary: 30, chooseSecondary: 34, stat: 38 },
];

// statDeclined: il giocatore rifiuta il miglioramento di caratteristica tirato e prende una skill,
// ma gli SPP del tiro restano spesi (p. 98). Costa come "stat".
export type AdvancementKind = 'randomPrimary' | 'choosePrimary' | 'chooseSecondary' | 'stat' | 'statDeclined';
export type StatKey = 'ma' | 'st' | 'ag' | 'pa' | 'av';

export const SKILL_VALUE_INCREASE = { primary: 20000, secondary: 40000 };
export const STAT_VALUE_INCREASE: Record<StatKey, number> = { ma: 20000, st: 60000, ag: 30000, pa: 20000, av: 10000 };

// Le skill Elite fanno salire il valore di altri 10.000 gp (p. 97). Sono segnate nell'elenco
// delle skill (pp. 123-139) con il simbolo Elite: Block, Dodge, Guard e Mighty Blow.
export const ELITE_VALUE_INCREASE = 10000;
export const ELITE_SKILLS = ['Block', 'Dodge', 'Guard', 'Mighty Blow'];
export const isEliteSkill = (name: string | null | undefined) =>
  ELITE_SKILLS.some(elite => elite.toLowerCase() === String(name ?? '').trim().toLowerCase());

const SKILL_CATEGORIES_MAP: Record<string, string> = {
  A: 'Agility',
  D: 'Devious',
  G: 'General',
  M: 'Mutation',
  P: 'Passing',
  S: 'Strength',
};

export const SKILL_CATEGORY_LETTERS = Object.keys(SKILL_CATEGORIES_MAP);
export const categoryName = (letter: string) => SKILL_CATEGORIES_MAP[letter.toUpperCase()] ?? letter;

// Skill Table (p. 121): primo D6 = metà della tabella (1-3 / 4-6), secondo D6 = riga.
export const SKILL_TABLE: Record<string, [string[], string[]]> = {
  A: [
    ['Catch', 'Diving Catch', 'Diving Tackle', 'Dodge', 'Defensive', 'Hit and Run'],
    ['Jump Up', 'Leap', 'Safe Pair of Hands', 'Sidestep', 'Sprint', 'Sure Feet'],
  ],
  D: [
    ['Dirty Player', 'Eye Gouge', 'Fumblerooski', 'Lethal Flight', 'Lone Fouler', 'Pile Driver'],
    ['Put the Boot In', 'Quick Foul', 'Saboteur', 'Shadowing', 'Sneaky Git', 'Violent Innovator'],
  ],
  G: [
    ['Block', 'Dauntless', 'Fend', 'Frenzy', 'Kick', 'Pro'],
    ['Steady Footing', 'Strip Ball', 'Sure Hands', 'Tackle', 'Taunt', 'Wrestle'],
  ],
  M: [
    ['Big Hand', 'Claws', 'Disturbing Presence', 'Extra Arms', 'Foul Appearance', 'Horns'],
    ['Iron Hard Skin', 'Monstrous Mouth', 'Prehensile Tail', 'Tentacles', 'Two Heads', 'Very Long Legs'],
  ],
  P: [
    ['Accurate', 'Cannoneer', 'Cloud Burster', 'Dump-off', 'Give and Go', 'Hail Mary Pass'],
    ['Leader', 'Nerves of Steel', 'On the Ball', 'Pass', 'Punt', 'Safe Pass'],
  ],
  S: [
    ['Arm Bar', 'Brawler', 'Break Tackle', 'Bullseye', 'Grab', 'Guard'],
    ['Juggernaut', 'Mighty Blow', 'Multiple Block', 'Stand Firm', 'Strong Arm', 'Thick Skull'],
  ],
};

// Nome della skill dalla Skill Table: primo D6 (1-6) e secondo D6 (1-6)
export function skillFromTable(letter: string, firstD6: number, secondD6: number): string | null {
  const table = SKILL_TABLE[letter.toUpperCase()];
  if (!table || firstD6 < 1 || firstD6 > 6 || secondD6 < 1 || secondD6 > 6) return null;
  return table[firstD6 <= 3 ? 0 : 1][secondD6 - 1];
}

// Characteristic Improvement Table (p. 98): D8 -> caratteristiche migliorabili
export const CHARACTERISTIC_TABLE: { d8: number[]; stats: StatKey[]; label: string }[] = [
  { d8: [1], stats: ['av'], label: 'AV' },
  { d8: [2], stats: ['av', 'pa'], label: 'AV / PA' },
  { d8: [3, 4], stats: ['av', 'ma', 'pa'], label: 'AV / MA / PA' },
  { d8: [5], stats: ['ma', 'pa'], label: 'MA / PA' },
  { d8: [6], stats: ['ag', 'ma'], label: 'AG / MA' },
  { d8: [7], stats: ['ag', 'st'], label: 'AG / ST' },
  { d8: [8], stats: ['ma', 'st', 'ag', 'pa', 'av'], label: 'A scelta' },
];

export const statsForRoll = (d8: number) => CHARACTERISTIC_TABLE.find(row => row.d8.includes(d8)) ?? null;

// Una caratteristica non si può migliorare più di due volte (p. 98)
export const MAX_IMPROVEMENTS_PER_STAT = 2;

export function getTier(advancements: number) {
  return ADVANCEMENT_TIERS[Math.min(Math.max(advancements, 0), ADVANCEMENT_TIERS.length - 1)];
}

export function advancementCost(kind: AdvancementKind, advancements: number) {
  // Rifiutare il tiro costa quanto il miglioramento di caratteristica
  return getTier(advancements)[kind === 'statDeclined' ? 'stat' : kind];
}

type SkillLike = { id: string; type?: string | null };

// Skill che il giocatore può prendere dalle categorie indicate (es. "G, A"), escluse quelle già possedute
export function skillsForCategories<T extends SkillLike>(allSkills: T[], categoryLetters: string | null | undefined, ownedSkillIds: string[]) {
  if (!categoryLetters || categoryLetters.trim() === '') return [];
  const categories = categoryLetters
      .split(',')
      .map(l => l.trim().toUpperCase())
      .filter(Boolean)
      .map(l => categoryName(l).toLowerCase());

  return allSkills.filter(skill =>
      !ownedSkillIds.includes(skill.id) &&
      categories.some(cat => (skill.type || '').toLowerCase().includes(cat))
  );
}

// Lettere delle categorie di un giocatore, es. "G, A" -> ['G', 'A']
export const categoryLetters = (value: string | null | undefined) =>
  String(value ?? '')
    .split(',')
    .map(l => l.trim().toUpperCase())
    .filter(l => SKILL_CATEGORY_LETTERS.includes(l));

// Migliora una caratteristica. Restituisce null se è già al limite.
// MA max 9, ST max 8, AG/PA min 1+, AV max 11+. Un PA "-" migliorato diventa 6+.
export function improveStat(stat: StatKey, current: number | string | null | undefined): number | string | null {
  if (stat === 'ma' || stat === 'st') {
    const value = Number(current);
    const cap = stat === 'ma' ? 9 : 8;
    return value >= cap ? null : value + 1;
  }

  const text = String(current ?? '').trim();
  if (stat === 'pa' && (text === '' || text === '-')) return '6+';

  const value = parseInt(text, 10);
  if (Number.isNaN(value)) return null;

  if (stat === 'av') return value >= 11 ? null : `${value + 1}+`;
  return value <= 1 ? null : `${value - 1}+`; // AG e PA: più basso è meglio
}
