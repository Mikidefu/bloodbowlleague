// Prayers to Nuffle (pp. 142-143): per ogni preghiera comprata la squadra tira un D16, ritirando i risultati
// che ha già ottenuto. Gli effetti durano fino a fine partita e non toccano la rosa: qui c'è cosa cambiano
// ai profili dei giocatori in campo e agli SPP del referto. Il testo di ogni risultato sta in matchTables.
// Funzioni pure: le usano il pre-partita, il tabellone live, la companion e il referto.

import { SKILL_TABLE } from '@/lib/advancement';
import { improveCharacteristic, reduceCharacteristic, type ArmourValue, type MovementValue } from '@/lib/characteristics';

export const PRAYER_DIE = 16;

// Giocatori da scegliere: della propria squadra o avversari, a caso o a scelta, uno o D3.
// Gli Star Player non si scelgono mai (p. 142).
export type PrayerTarget = { side: 'own' | 'opponent'; pick: 'random' | 'choose'; count: 'one' | 'd3' };

// SPP che la preghiera aggiunge al referto (p. 143)
export type PrayerSppKind = 'completion' | 'catch' | 'crowd' | 'foul';

export type PrayerDef = {
  roll: number;
  name: string;
  target?: PrayerTarget;
  skill?: string;          // skill o tratto per la partita
  primarySkill?: boolean;  // Intensive Training: una skill Primary a scelta
  av?: 1;                  // Iron Man: +1 AV (massimo 11+)
  ma?: -1;                 // Greasy Cleats: -1 MA (minimo 1)
  spp?: PrayerSppKind;
  oncePerGame?: boolean;   // Throw a Rock
};

const ownRandom: PrayerTarget = { side: 'own', pick: 'random', count: 'one' };
const ownChoice: PrayerTarget = { side: 'own', pick: 'choose', count: 'one' };

export const PRAYERS: PrayerDef[] = [
  { roll: 1, name: 'Treacherous Trapdoor' },
  { roll: 2, name: 'Friends with the Ref' },
  { roll: 3, name: 'Stiletto', target: ownRandom, skill: 'Stab' },
  { roll: 4, name: 'Iron Man', target: ownChoice, av: 1 },
  { roll: 5, name: 'Knuckle Dusters', target: ownChoice, skill: 'Mighty Blow' },
  { roll: 6, name: 'Bad Habits', target: { side: 'opponent', pick: 'random', count: 'd3' }, skill: 'Loner (2+)' },
  { roll: 7, name: 'Greasy Cleats', target: { side: 'opponent', pick: 'random', count: 'one' }, ma: -1 },
  { roll: 8, name: 'Blessing of Nuffle', target: ownRandom, skill: 'Pro' },
  { roll: 9, name: 'Moles under the Pitch' },
  { roll: 10, name: 'Perfect Passing', spp: 'completion' },
  { roll: 11, name: 'Dazzling Catching', spp: 'catch' },
  { roll: 12, name: 'Fan Interaction', spp: 'crowd' },
  { roll: 13, name: 'Fouling Frenzy', spp: 'foul' },
  { roll: 14, name: 'Throw a Rock', oncePerGame: true },
  { roll: 15, name: 'Under Scrutiny' },
  { roll: 16, name: 'Intensive Training', target: ownRandom, primarySkill: true },
];

export const getPrayer = (roll: unknown) => PRAYERS.find(p => p.roll === roll) ?? null;

// Una preghiera tirata, come si salva in match_team_reports.prayers (JSON)
export type PrayerResult = {
  roll: number;          // D16
  players?: string[];    // giocatori scelti (id di players)
  d3?: number;           // Bad Habits: quanti avversari
  skill?: string;        // Intensive Training: la skill scelta
};

// Quanti giocatori servono; null se manca ancora il D3
export function targetCount(def: PrayerDef, d3: number | null | undefined): number | null {
  if (!def.target) return 0;
  if (def.target.count === 'one') return 1;
  return Number.isInteger(d3) && (d3 as number) >= 1 && (d3 as number) <= 3 ? (d3 as number) : null;
}

// Skill Primary che un giocatore può ricevere da Intensive Training (categorie Primary della posizione, p. 121)
export const primarySkillOptions = (categories: readonly string[]) =>
  categories.flatMap(letter => SKILL_TABLE[letter.toUpperCase()]?.flat() ?? []);

const isInt = (v: unknown): v is number => Number.isInteger(v);

// Lettura tollerante del JSON salvato (o di quello che arriva dal browser)
export function parsePrayers(raw: unknown): PrayerResult[] {
  let value = raw;
  if (typeof raw === 'string') {
    try { value = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(value)) return [];
  return value
    .filter(p => p && typeof p === 'object' && isInt((p as PrayerResult).roll))
    .map(p => {
      const r = p as PrayerResult;
      return {
        roll: r.roll,
        ...(Array.isArray(r.players) ? { players: r.players.map(String) } : {}),
        ...(isInt(r.d3) ? { d3: r.d3 } : {}),
        ...(typeof r.skill === 'string' && r.skill.trim() ? { skill: r.skill.trim() } : {}),
      };
    });
}

export type PrayerCandidates = {
  own: string[];                                  // chi gioca questa partita per la squadra (niente Star Player)
  opponent: string[];                             // chi gioca per gli avversari
  primarySkills: (playerId: string) => string[];  // per Intensive Training
};

// Il motivo per cui l'elenco non va bene (null = va bene). qty = preghiere comprate.
export function prayerProblem(list: PrayerResult[], qty: number, c: PrayerCandidates): string | null {
  if (list.length !== qty) return `roll the D16 once for each of the ${qty} Prayers to Nuffle bought (p. 142)`;
  const seen = new Set<number>();
  for (const p of list) {
    const def = getPrayer(p.roll);
    if (!def) return 'every Prayer to Nuffle is a D16 roll (1-16)';
    if (seen.has(p.roll)) return `${def.name} rolled twice: re-roll results the team already has (p. 142)`;
    seen.add(p.roll);
    const players = p.players ?? [];
    if (!def.target) {
      if (players.length) return `${def.name} does not select players`;
      continue;
    }
    if (def.target.count === 'd3' && !(isInt(p.d3) && p.d3 >= 1 && p.d3 <= 3)) return `${def.name}: roll the D3 for the number of players`;
    const pool = def.target.side === 'own' ? c.own : c.opponent;
    const wanted = Math.min(targetCount(def, p.d3) ?? 0, pool.length);
    if (players.length !== wanted) return `${def.name}: select ${wanted} ${def.target.side === 'own' ? 'players of the team' : 'opposition players'} playing this game`;
    if (new Set(players).size !== players.length) return `${def.name}: the same player selected twice`;
    if (players.some(id => !pool.includes(id))) return `${def.name}: select players playing this game (never Star Players, p. 142)`;
    if (def.primarySkill) {
      if (!p.skill) return `${def.name}: choose the Primary skill`;
      if (!c.primarySkills(players[0]).includes(p.skill)) return `${def.name}: ${p.skill} is not a Primary skill of that player`;
    } else if (p.skill) {
      return `${def.name} does not choose a skill`;
    }
  }
  return null;
}

export const hasPrayer = (list: PrayerResult[], name: string) => list.some(p => getPrayer(p.roll)?.name === name);

// ------------------------------------------------------------------
// SPP (p. 143)
// ------------------------------------------------------------------

// SPP per azione con le preghiere della squadra: senza preghiera catches, crowd e foul non valgono niente
export type PrayerSppValues = { completion: number; catch: number; crowd: number; foul: number };

export function prayerSpp(list: PrayerResult[] | null | undefined): PrayerSppValues {
  const kinds = new Set((list ?? []).map(p => getPrayer(p.roll)?.spp).filter(Boolean));
  return {
    completion: kinds.has('completion') ? 2 : 1,   // Perfect Passing: 2 SPP invece di 1
    catch: kinds.has('catch') ? 1 : 0,             // Dazzling Catching: 1 SPP a chi prende un passaggio
    crowd: kinds.has('crowd') ? 2 : 0,             // Fan Interaction: 2 SPP a chi spinge nel pubblico un avversario che subisce una Casualty
    foul: kinds.has('foul') ? 2 : 0,               // Fouling Frenzy: 2 SPP per una Casualty causata con un Foul
  };
}

// Statistiche del referto che esistono solo con la preghiera giusta
export const PRAYER_STATS = [
  { field: 'catches', spp: 'catch', prayer: 'Dazzling Catching', short: { it: 'PRESE', en: 'CATCH' },
    title: { it: 'Passaggi presi (Dazzling Catching, 1 SPP)', en: 'Passes caught (Dazzling Catching, 1 SPP)' } },
  { field: 'crowd_cas', spp: 'crowd', prayer: 'Fan Interaction', short: { it: 'CAS PUB', en: 'CAS CROWD' },
    title: { it: 'Avversari spinti nel pubblico che subiscono una Casualty (Fan Interaction, 2 SPP)', en: 'Opponents pushed into the crowd who suffer a Casualty (Fan Interaction, 2 SPP)' } },
  { field: 'foul_cas', spp: 'foul', prayer: 'Fouling Frenzy', short: { it: 'CAS FOUL', en: 'CAS FOUL' },
    title: { it: 'Casualty causate con un Foul (Fouling Frenzy, 2 SPP)', en: 'Casualties caused by a Foul (Fouling Frenzy, 2 SPP)' } },
] as const;
export type PrayerStatField = (typeof PRAYER_STATS)[number]['field'];

export const prayerStatFields = (list: PrayerResult[] | null | undefined): PrayerStatField[] => {
  const spp = prayerSpp(list);
  return PRAYER_STATS.filter(s => spp[s.spp] > 0).map(s => s.field);
};

// ------------------------------------------------------------------
// Profili in campo
// ------------------------------------------------------------------

export type PrayerEffect = { prayer: string; team_id: string; skill?: string; ma?: -1; av?: 1 };

// Cosa riceve ogni giocatore dalle preghiere delle due squadre (anche da quelle avversarie: Bad Habits, Greasy Cleats)
export function prayerEffects(byTeam: Record<string, PrayerResult[]>): Map<string, PrayerEffect[]> {
  const out = new Map<string, PrayerEffect[]>();
  for (const [teamId, list] of Object.entries(byTeam)) {
    for (const p of list) {
      const def = getPrayer(p.roll);
      if (!def?.target) continue;
      const skill = def.primarySkill ? p.skill : def.skill;
      for (const id of p.players ?? []) {
        const effect: PrayerEffect = { prayer: def.name, team_id: teamId, ...(skill ? { skill } : {}), ...(def.ma ? { ma: def.ma } : {}), ...(def.av ? { av: def.av } : {}) };
        out.set(id, [...(out.get(id) ?? []), effect]);
      }
    }
  }
  return out;
}

// Il profilo per questa partita: +1 AV fino a 11+, -1 MA fino a 1
export function profileWithPrayers(ma: MovementValue, av: ArmourValue, effects: PrayerEffect[]) {
  let nextMa = ma;
  let nextAv = av;
  for (const e of effects) {
    if (e.ma) nextMa = reduceCharacteristic('ma', nextMa) ?? nextMa;
    if (e.av) nextAv = improveCharacteristic('av', nextAv) ?? nextAv;
  }
  return { ma: nextMa, av: nextAv, skills: effects.map(e => e.skill).filter((s): s is string => !!s) };
}
