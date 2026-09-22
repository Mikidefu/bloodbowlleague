// Regole di League Play del Rulebook Blood Bowl 2025 (Third Season Edition), condivise tra API e pagine.
// Ogni blocco indica la pagina del libro da cui è preso.

import { getPosition, hasRule, type Roster, type RosterPosition } from '@/lib/rosters';

// ------------------------------------------------------------------
// Draft della squadra (pp. 89-91)
// ------------------------------------------------------------------

// REGOLA DELLA CASA: il libro indica 1.000.000 gp come Team Draft Budget per la League Play (p. 89).
// Questa lega parte da 1.200.000.
export const RULEBOOK_DRAFT_BUDGET = 1_000_000;
export const DRAFT_BUDGET = 1_200_000;

export const LIMITS = {
  minPlayers: 11,
  maxPlayers: 16,
  maxRerolls: 8,
  maxAssistantCoaches: 6,
  maxCheerleaders: 6,
  maxApothecaries: 1,
  dedicatedFansStart: 1,
  dedicatedFansDraftMax: 3,
  dedicatedFansMin: 1,
  dedicatedFansMax: 7,
};

export const STAFF_COSTS = {
  assistantCoach: 10000,
  cheerleader: 10000,
  apothecary: 50000,
  dedicatedFan: 5000,   // per ogni punto sopra 1, solo al draft
};

// Durante la lega un Team Re-roll costa il doppio, ma nel Team Value conta al prezzo normale (p. 90)
export const LEAGUE_REROLL_MULTIPLIER = 2;

// ------------------------------------------------------------------
// Star Player Points (p. 96, Brawlin' Brutes p. 154)
// ------------------------------------------------------------------

export type SppStats = {
  td: number;
  cas: number;
  int: number;
  comp: number;
  ttm: number;      // Throw Team-mate con Superb Throw e compagno atterrato in piedi: 1 SPP al lanciatore
  landing: number;  // lanciato da un compagno e atterrato in sicurezza: 1 SPP
  mvp: number;
};

export const SPP_VALUES = { completion: 1, throwTeamMate: 1, landing: 1, interception: 2, casualty: 2, touchdown: 3, mvp: 4 };

export function sppEarned(stats: SppStats, options: { brawlinBrutes?: boolean } = {}) {
  const td = options.brawlinBrutes ? 2 : SPP_VALUES.touchdown;
  const cas = options.brawlinBrutes ? 3 : SPP_VALUES.casualty;
  return stats.td * td + stats.cas * cas + stats.int * SPP_VALUES.interception + stats.comp * SPP_VALUES.completion
       + stats.ttm * SPP_VALUES.throwTeamMate + stats.landing * SPP_VALUES.landing + stats.mvp * SPP_VALUES.mvp;
}

// ------------------------------------------------------------------
// Pre-partita: Fan Factor (p. 45)
// ------------------------------------------------------------------

// Fan Factor = Dedicated Fans + D3 Fair-weather Fans
export const fanFactor = (dedicatedFans: number, fairWeatherD3: number) => dedicatedFans + fairWeatherD3;

// ------------------------------------------------------------------
// Post-partita (pp. 95-100)
// ------------------------------------------------------------------

export type MatchResult = 'win' | 'draw' | 'loss';

// Winnings = (Fan Attendance / 2 + TD segnati + 1 se nessun giocatore ha fatto Stalling) x 10.000
export const winnings = (fanAttendance: number, touchdowns: number, stalling: boolean) =>
  Math.round((fanAttendance / 2 + touchdowns + (stalling ? 0 : 1)) * 10000);

// Vittoria: D6 >= Dedicated Fans -> +1 (max 7). Sconfitta: D6 < Dedicated Fans -> -1 (min 1). Pareggio: invariato.
export function dedicatedFansChange(result: MatchResult, dedicatedFans: number, d6: number) {
  if (result === 'win') return d6 >= dedicatedFans && dedicatedFans < LIMITS.dedicatedFansMax ? 1 : 0;
  if (result === 'loss') return d6 < dedicatedFans && dedicatedFans > LIMITS.dedicatedFansMin ? -1 : 0;
  return 0;
}

export type MistakeResult = 'averted' | 'minor' | 'major' | 'catastrophe';

// Expensive Mistake Table: righe D6 1-6, colonne 100.000-195.000 ... 600.000+
const MISTAKE_TABLE: MistakeResult[][] = [
  ['minor', 'minor', 'major', 'major', 'catastrophe', 'catastrophe'],
  ['averted', 'minor', 'minor', 'major', 'major', 'catastrophe'],
  ['averted', 'averted', 'minor', 'minor', 'major', 'major'],
  ['averted', 'averted', 'averted', 'minor', 'minor', 'major'],
  ['averted', 'averted', 'averted', 'averted', 'minor', 'minor'],
  ['averted', 'averted', 'averted', 'averted', 'averted', 'minor'],
];

export const MISTAKE_THRESHOLD = 100000;

export function expensiveMistake(treasury: number, d6: number): MistakeResult | null {
  if (treasury < MISTAKE_THRESHOLD) return null;
  const column = Math.min(5, Math.floor(treasury / 100000) - 1);
  return MISTAKE_TABLE[d6 - 1][column];
}

// Tesoreria dopo l'incidente. extraRoll: D3 per Minor Incident, 2D6 per Catastrophe.
export function treasuryAfterMistake(treasury: number, result: MistakeResult, extraRoll: number) {
  switch (result) {
    case 'minor': return Math.max(0, treasury - extraRoll * 10000);
    case 'major': return Math.floor(treasury / 2 / 5000) * 5000;
    case 'catastrophe': return Math.min(treasury, extraRoll * 10000);
    default: return treasury;
  }
}

export const mistakeExtraRoll = (result: MistakeResult | null): 'd3' | '2d6' | null =>
  result === 'minor' ? 'd3' : result === 'catastrophe' ? '2d6' : null;

// ------------------------------------------------------------------
// Infortuni (pp. 67-68)
// ------------------------------------------------------------------

export type CasualtyResult = 'BH' | 'SH' | 'SI' | 'LI' | 'DEAD';
export type InjuryStat = 'ma' | 'st' | 'ag' | 'pa' | 'av';

export const CASUALTY_RESULTS: { key: CasualtyResult; name: string; d16: string; missNextGame: boolean; niggling: boolean }[] = [
  { key: 'BH', name: 'Badly Hurt', d16: '1-8', missNextGame: false, niggling: false },
  { key: 'SH', name: 'Seriously Hurt', d16: '9-10', missNextGame: true, niggling: false },
  { key: 'SI', name: 'Serious Injury', d16: '11-12', missNextGame: true, niggling: true },
  { key: 'LI', name: 'Lasting Injury', d16: '13-14', missNextGame: true, niggling: false },
  { key: 'DEAD', name: 'Dead', d16: '15-16', missNextGame: false, niggling: false },
];

export const casualtyInfo = (key: string | null | undefined) => CASUALTY_RESULTS.find(c => c.key === key) ?? null;

// Lasting Injury Table: D6 1-2 Head Injury (-1 AV), 3 Smashed Knee (-1 MA), 4 Broken Arm (-1 PA),
// 5 Dislocated Hip (-1 AG), 6 Broken Shoulder (-1 ST)
export const LASTING_INJURIES: { d6: number[]; name: string; stat: InjuryStat }[] = [
  { d6: [1, 2], name: 'Head Injury', stat: 'av' },
  { d6: [3], name: 'Smashed Knee', stat: 'ma' },
  { d6: [4], name: 'Broken Arm', stat: 'pa' },
  { d6: [5], name: 'Dislocated Hip', stat: 'ag' },
  { d6: [6], name: 'Broken Shoulder', stat: 'st' },
];

export const lastingInjuryForRoll = (d6: number) => LASTING_INJURIES.find(l => l.d6.includes(d6)) ?? null;

// Minimi delle caratteristiche (p. 37): MA 1, ST 1, AG 6+, PA 6+, AV 3+
// Restituisce il nuovo valore, oppure null se la riduzione non si può applicare
// (in quel caso il risultato vale come Miss Next Game, che il Lasting Injury già comporta).
export function reduceStat(stat: InjuryStat, current: number | string | null | undefined): number | string | null {
  if (stat === 'ma' || stat === 'st') {
    const value = Number(current);
    return Number.isNaN(value) || value <= 1 ? null : value - 1;
  }
  const text = String(current ?? '').trim();
  const value = parseInt(text, 10);
  if (Number.isNaN(value)) return null;   // PA "-": non si può peggiorare
  if (stat === 'av') return value <= 3 ? null : `${value - 1}+`;
  return value >= 6 ? null : `${value + 1}+`;
}

// Operazione inversa, per annullare una riduzione quando si corregge un referto
export function restoreStat(stat: InjuryStat, current: number | string | null | undefined): number | string {
  if (stat === 'ma' || stat === 'st') return Number(current) + 1;
  const value = parseInt(String(current), 10);
  return stat === 'av' ? `${value + 1}+` : `${value - 1}+`;
}

// Getting Even (p. 68): dopo SH, SI o LI con Miss Next Game, con 4+ su D6 il giocatore ottiene Hatred (X),
// dove X è una keyword del giocatore che ha causato la Casualty, escluse le keyword di posizione.
export const HATRED_FORBIDDEN_KEYWORDS = ['Big Guy', 'Blitzer', 'Blocker', 'Catcher', 'Lineman', 'Runner', 'Special', 'Thrower'];
export const GETTING_EVEN_TARGET = 4;

// ------------------------------------------------------------------
// Concessione (p. 101)
// ------------------------------------------------------------------

export type MatchOutcome =
  | 'played'
  | 'conceded'              // Concede durante la partita
  | 'conceded_no_penalty'   // Concede Without Penalty
  | 'forfeit_both'          // non giocata entro il limite: sconfitta per entrambe (p. 102)
  | 'forfeit_commitments';  // non giocata: una squadra concede per impegni personali (p. 102)

export const MATCH_OUTCOMES: MatchOutcome[] = ['played', 'conceded', 'conceded_no_penalty', 'forfeit_both', 'forfeit_commitments'];

// Chi concede e ha giocatori con 3+ avanzamenti tira un D6 per ognuno: con 1-3 lascia la squadra
export const CONCEDE_QUIT_MIN_ADVANCEMENTS = 3;
export const CONCEDE_QUIT_MAX_ROLL = 3;

// Risultato a tavolino: 2-0, oppure X-0 se chi vince aveva già segnato più di 2 TD
export const concededScore = (winnerTouchdowns: number) => Math.max(2, winnerTouchdowns);

// ------------------------------------------------------------------
// Incentivi (pp. 94, 142-148)
// ------------------------------------------------------------------

export type InducementContext = {
  roster: Roster | null;
  favouredOf: string | null;
};

export type InducementDef = {
  key: string;
  name: string;
  page: number;
  max: (ctx: InducementContext) => number;
  cost: (ctx: InducementContext) => number | null;  // null = prezzo variabile (Mercenari, Star Player)
  available: (ctx: InducementContext) => boolean;
  note?: string;
};

const always = () => true;
const fixed = (value: number) => () => value;
const bribery = (ctx: InducementContext) => hasRule(ctx.roster, 'Bribery and Corruption');

export const INDUCEMENTS: InducementDef[] = [
  { key: 'prayers', name: 'Prayers to Nuffle', page: 142, max: fixed(3), cost: fixed(10000), available: always },
  { key: 'part_time_assistant_coaches', name: 'Part-time Assistant Coaches', page: 144, max: fixed(5), cost: fixed(20000), available: always },
  { key: 'temp_agency_cheerleaders', name: 'Temp Agency Cheerleaders', page: 144, max: fixed(5), cost: fixed(5000), available: always },
  { key: 'team_mascot', name: 'Team Mascot', page: 144, max: fixed(1), cost: fixed(25000), available: always },
  { key: 'weather_mage', name: 'Weather Mage', page: 144, max: fixed(1), cost: fixed(25000), available: always },
  { key: 'blitzers_best_kegs', name: "Blitzer's Best Kegs", page: 144, max: fixed(2), cost: fixed(50000), available: always },
  { key: 'bribes', name: 'Bribes', page: 144, max: ctx => (bribery(ctx) ? 6 : 3), cost: ctx => (bribery(ctx) ? 50000 : 100000), available: always },
  { key: 'extra_team_training', name: 'Extra Team Training', page: 145, max: fixed(8), cost: fixed(100000), available: always },
  { key: 'mortuary_assistant', name: 'Mortuary Assistant', page: 145, max: fixed(1), cost: fixed(100000), available: ctx => hasRule(ctx.roster, 'Masters of Undeath') },
  { key: 'plague_doctor', name: 'Plague Doctor', page: 145, max: fixed(1), cost: fixed(100000), available: ctx => hasRule(ctx.roster, 'Favoured of') && ctx.favouredOf === 'Nurgle' },
  { key: 'riotous_rookies', name: 'Riotous Rookies', page: 145, max: fixed(1), cost: fixed(150000), available: ctx => hasRule(ctx.roster, 'Low Cost Linemen'), note: '+2D3+1 Journeymen' },
  { key: 'wandering_apothecary', name: 'Wandering Apothecary', page: 146, max: fixed(2), cost: fixed(100000), available: ctx => !!ctx.roster?.apothecary },
  { key: 'halfling_master_chef', name: 'Halfling Master Chef', page: 146, max: fixed(1), cost: ctx => (ctx.roster?.key === 'halfling' ? 100000 : 300000), available: always },
  { key: 'dodgy_league_rep', name: 'Biased Referee: Dodgy League Rep', page: 146, max: fixed(1), cost: ctx => (bribery(ctx) ? 80000 : 120000), available: always },
  { key: 'josef_bugman', name: 'Infamous Coaching Staff: Josef Bugman', page: 147, max: fixed(1), cost: fixed(100000), available: always },
  { key: 'sports_wizard', name: 'Wizard: Sports-Wizard', page: 149, max: fixed(1), cost: fixed(150000), available: always },
  { key: 'mercenary', name: 'Mercenary Player', page: 147, max: fixed(3), cost: () => null, available: always, note: 'Hiring Fee +30.000 (+50.000 con una skill primaria)' },
  { key: 'star_player', name: 'Star Player', page: 148, max: fixed(2), cost: () => null, available: always },
];

export const MERCENARY_SURCHARGE = 30000;
export const MERCENARY_SKILL_COST = 50000;
export const PETTY_CASH_TREASURY_TOP_UP = 50000;

export const getInducement = (key: string) => INDUCEMENTS.find(i => i.key === key) ?? null;

// Una riga di incentivo scelta nel pre-partita
export type InducementChoice = {
  key: string;
  qty: number;
  position_key?: string;   // Mercenari
  with_skill?: boolean;    // Mercenari con skill primaria
  name?: string;           // Star Player
  cost?: number;           // Star Player: costo dal suo profilo
};

export function mercenaryCost(position: RosterPosition | null, withSkill: boolean) {
  if (!position) return null;
  return position.cost + MERCENARY_SURCHARGE + (withSkill ? MERCENARY_SKILL_COST : 0);
}

// Costo totale di una scelta; null se non è valida
export function inducementChoiceCost(choice: InducementChoice, ctx: InducementContext): number | null {
  const def = getInducement(choice.key);
  if (!def || !Number.isInteger(choice.qty) || choice.qty < 1) return null;
  if (choice.key === 'mercenary') {
    const cost = mercenaryCost(getPosition(ctx.roster, choice.position_key), !!choice.with_skill);
    return cost === null ? null : cost * choice.qty;
  }
  if (choice.key === 'star_player') {
    return Number.isInteger(choice.cost) && (choice.cost as number) > 0 ? (choice.cost as number) * choice.qty : null;
  }
  const unit = def.cost(ctx);
  return unit === null ? null : unit * choice.qty;
}

// Budget per gli incentivi (p. 94).
// La squadra con CTV più alto spende per prima dalla propria Treasury; quella con CTV più basso riceve
// Petty Cash = differenza di CTV + quanto speso dall'altra, e può aggiungere al massimo 50.000 dalla Treasury.
// A CTV pari nessuna delle due può spendere.
export function pettyCash(ctvHigher: number, ctvLower: number, higherSpent: number) {
  return Math.max(0, ctvHigher - ctvLower) + higherSpent;
}

// ------------------------------------------------------------------
// Dadi
// ------------------------------------------------------------------

export const rollDie = (sides: number) => {
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return (buffer[0] % sides) + 1;
};

export const isDieValue = (value: unknown, min: number, max: number) =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
