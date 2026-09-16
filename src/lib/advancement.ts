// Regole degli avanzamenti SPP, condivise tra interfaccia e API.

export const MAX_ADVANCEMENTS = 6;

export const ADVANCEMENT_TIERS = [
  { name: 'Experienced (1st)', randomPrimary: 3, choosePrimary: 6, chooseSecondary: 10, stat: 14 },
  { name: 'Veteran (2nd)', randomPrimary: 4, choosePrimary: 8, chooseSecondary: 12, stat: 16 },
  { name: 'Emerging Star (3rd)', randomPrimary: 6, choosePrimary: 12, chooseSecondary: 16, stat: 20 },
  { name: 'Star (4th)', randomPrimary: 8, choosePrimary: 16, chooseSecondary: 20, stat: 24 },
  { name: 'Superstar (5th)', randomPrimary: 10, choosePrimary: 20, chooseSecondary: 24, stat: 28 },
  { name: 'Legend (6th)', randomPrimary: 15, choosePrimary: 30, chooseSecondary: 34, stat: 38 },
];

export type AdvancementKind = 'randomPrimary' | 'choosePrimary' | 'chooseSecondary' | 'stat';
export type StatKey = 'ma' | 'st' | 'ag' | 'pa' | 'av';

export const SKILL_VALUE_INCREASE = { primary: 20000, secondary: 40000 };
export const STAT_VALUE_INCREASE: Record<StatKey, number> = { ma: 20000, st: 60000, ag: 30000, pa: 20000, av: 10000 };

const SKILL_CATEGORIES_MAP: Record<string, string> = {
  G: 'General',
  A: 'Agility',
  S: 'Strength',
  P: 'Passing',
  M: 'Mutation',
};

export function getTier(advancements: number) {
  return ADVANCEMENT_TIERS[Math.min(Math.max(advancements, 0), ADVANCEMENT_TIERS.length - 1)];
}

export function advancementCost(kind: AdvancementKind, advancements: number) {
  return getTier(advancements)[kind];
}

type SkillLike = { id: string; type?: string | null };

// Skill che il giocatore può prendere dalle categorie indicate (es. "G, A"), escluse quelle già possedute
export function skillsForCategories<T extends SkillLike>(allSkills: T[], categoryLetters: string | null | undefined, ownedSkillIds: string[]) {
  if (!categoryLetters || categoryLetters.trim() === '') return [];
  const categories = categoryLetters
      .split(',')
      .map(l => l.trim().toUpperCase())
      .filter(Boolean)
      .map(l => (SKILL_CATEGORIES_MAP[l] || l).toLowerCase());

  return allSkills.filter(skill =>
      !ownedSkillIds.includes(skill.id) &&
      categories.some(cat => (skill.type || '').toLowerCase().includes(cat))
  );
}

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
