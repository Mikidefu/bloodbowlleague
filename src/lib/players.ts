// Il giocatore tipizzato: un solo punto in cui le righe del database diventano oggetti Player
// e un solo punto in cui l'input delle API viene validato.
//
// SQLite non ha booleani (0/1), le caratteristiche sono TEXT e la colonna "status" è ereditata
// dalle partite legacy: leggere le righe così com'erano significava portarsi dietro `as never`,
// `String(...)` e valori fuori regolamento. Qui le righe entrano come Record<string, unknown>
// ed escono come Player, con caratteristiche sempre valide (src/lib/characteristics.ts).

import { parseCategories } from '@/lib/advancement';
import {
  STAT_KEYS, allowedValues, isStatKey, parseCharacteristic, statLabel, toCharacteristics,
  type Characteristics, type StatKey,
} from '@/lib/characteristics';
import { CASUALTY_RESULTS, type CasualtyResult } from '@/lib/leagueRules';
import type { MatchInjury, MatchPlayer, Player, PlayerStatsRow, PlayerStatus, Skill } from '@/lib/types';

// Riga del database o oggetto JSON non ancora validato
export type PlayerRow = Record<string, unknown>;

// Le bandiere di stato come possono arrivare: 0/1 da SQLite, booleani dalle API.
// L'indice permette di passare sia un Player sia una riga del database senza conversioni.
export type PlayerFlags = {
  dead?: unknown;
  left_team?: unknown;
  mng?: unknown;
  temp_retired?: unknown;
  journeyman?: unknown;
  [column: string]: unknown;
};

export const flag = (value: unknown) => value === true || value === 1 || value === '1';

// ------------------------------------------------------------------
// Stato del giocatore
// ------------------------------------------------------------------

// In ordine di precedenza: un morto non è "in infermeria", un Journeyman non ancora ingaggiato
// non è un giocatore della Team Draft List.
export const PLAYER_STATES = ['dead', 'left', 'journeyman', 'retired', 'mng', 'ready'] as const;
export type PlayerState = (typeof PLAYER_STATES)[number];

export function playerState(player: PlayerFlags): PlayerState {
  if (flag(player.dead)) return 'dead';
  if (flag(player.left_team)) return 'left';
  if (flag(player.journeyman)) return 'journeyman';
  if (flag(player.temp_retired)) return 'retired';
  if (flag(player.mng)) return 'mng';
  return 'ready';
}

// Ancora sulla Team Draft List (p. 91): esclusi morti e chi ha lasciato la squadra
export const onDraftList = (player: PlayerFlags) => !flag(player.dead) && !flag(player.left_team);

// Può scendere in campo nella prossima partita (p. 94): in lista, non MNG,
// non Temporarily Retiring e non Journeyman in attesa del post-partita
export const canPlayNextMatch = (player: PlayerFlags) =>
  onDraftList(player) && !flag(player.mng) && !flag(player.temp_retired) && !flag(player.journeyman);

export const PLAYER_STATUSES: readonly PlayerStatus[] = ['Active', 'Injured', 'Dead'];
export const isPlayerStatus = (value: unknown): value is PlayerStatus => PLAYER_STATUSES.includes(value as PlayerStatus);

// La colonna "status" resta allineata alle bandiere: se è illeggibile la si ricava da queste
export function playerStatus(row: PlayerRow): PlayerStatus {
  if (flag(row.dead)) return 'Dead';
  if (flag(row.mng)) return 'Injured';
  return isPlayerStatus(row.status) ? row.status : 'Active';
}

// ------------------------------------------------------------------
// Dalle righe del database agli oggetti tipizzati
// ------------------------------------------------------------------

const text = (value: unknown) => (value === null || value === undefined ? null : String(value));
const count = (value: unknown) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};
const optionalCount = (value: unknown) => (value === null || value === undefined ? null : count(value));

export function toSkill(row: PlayerRow): Skill {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    type: String(row.type ?? ''),
    description: text(row.description),
    description_it: text(row.description_it),
    level: text(row.level),
  };
}

export type PlayerExtras = {
  skills?: PlayerRow[];
  lasting_injuries?: number;
};

// Una riga della tabella players (più le sue skill) diventa un Player completo
export function toPlayer(row: PlayerRow, extras: PlayerExtras = {}): Player {
  return {
    id: String(row.id),
    team_id: String(row.team_id),
    jersey_number: optionalCount(row.jersey_number),
    name: String(row.name ?? ''),
    role: String(row.role ?? ''),
    value: count(row.value),
    primary_skills: text(row.primary_skills),
    secondary_skills: text(row.secondary_skills),
    ...toCharacteristics(row),
    spp: count(row.spp),
    advancements: count(row.advancements),
    status: playerStatus(row),
    mng: flag(row.mng),
    dead: flag(row.dead),
    skills: (extras.skills ?? []).map(toSkill),
    position_key: text(row.position_key),
    hiring_fee: optionalCount(row.hiring_fee),
    niggling_injuries: count(row.niggling_injuries),
    temp_retired: flag(row.temp_retired),
    left_team: flag(row.left_team),
    journeyman: flag(row.journeyman),
    journeyman_match_id: text(row.journeyman_match_id),
    is_captain: flag(row.is_captain),
    hatreds: text(row.hatreds),
    lasting_injuries: count(extras.lasting_injuries),
  };
}

// Il giocatore come compare nel referto di una partita: le stesse colonne, più il motivo
// per cui non poteva giocarla (MNG o Temporarily Retiring).
export function toMatchPlayer(row: PlayerRow, unavailable: MatchPlayer['unavailable']): MatchPlayer {
  const {
    id, jersey_number, name, role, status, team_id, mng, dead, position_key, advancements,
    journeyman, temp_retired, niggling_injuries, ma, st, ag, pa, av,
  } = toPlayer(row);
  return {
    id, jersey_number, name, role, status, team_id, mng, dead, position_key, advancements,
    journeyman, temp_retired, niggling_injuries, ma, st, ag, pa, av, unavailable,
  };
}

export const isCasualtyResult = (value: unknown): value is CasualtyResult =>
  CASUALTY_RESULTS.some(casualty => casualty.key === value);

// Righe di player_injuries e player_stats: il database le vincola già (CHECK e DEFAULT),
// qui si dà loro il tipo con cui le leggono le pagine.
export function toPlayerInjury(row: PlayerRow): MatchInjury {
  return {
    id: String(row.id),
    match_id: String(row.match_id),
    player_id: String(row.player_id),
    result: isCasualtyResult(row.result) ? row.result : 'BH',
    stat: isStatKey(row.stat) ? row.stat : null,
    stat_applied: flag(row.stat_applied),
    hatred: text(row.hatred),
  };
}

export function toPlayerStats(row: PlayerRow): PlayerStatsRow {
  return {
    id: String(row.id),
    match_id: String(row.match_id),
    player_id: String(row.player_id),
    touchdowns: count(row.touchdowns),
    casualties: count(row.casualties),
    interceptions: count(row.interceptions),
    completions: count(row.completions),
    mvp: count(row.mvp),
    spp_earned: count(row.spp_earned),
    ttm: count(row.ttm),
    landings: count(row.landings),
  };
}

// Keyword di Hatred (X) ottenute con Getting Even (p. 68), salvate separate da virgola
export const hatredList = (value: unknown) => String(value ?? '').split(',').map(s => s.trim()).filter(Boolean);

// ------------------------------------------------------------------
// Input delle API
// ------------------------------------------------------------------

export class PlayerInputError extends Error {}

// Profilo di un giocatore come può arrivare da POST/PUT /api/players: i campi assenti restano
// assenti (le route usano COALESCE e non toccano ciò che non viene inviato), quelli presenti
// sono validati qui. Così nel database non finiscono caratteristiche o categorie inventate.
export type PlayerProfileInput = Partial<Characteristics> & {
  name?: string;
  role?: string;
  value?: number;
  jersey_number?: number | null;
  advancements?: number;
  spp?: number;
  primary_skills?: string | null;
  secondary_skills?: string | null;
  status?: PlayerStatus;
};

const has = (body: PlayerRow, key: string) => body[key] !== undefined && body[key] !== null;

const positiveInt = (body: PlayerRow, key: string, label: string, max = 1_000_000_000) => {
  const value = Number(body[key]);
  if (!Number.isInteger(value) || value < 0 || value > max) throw new PlayerInputError(`${label} must be a whole number`);
  return value;
};

export function parsePlayerProfile(body: PlayerRow): PlayerProfileInput {
  const profile: PlayerProfileInput = {};

  if (has(body, 'name')) {
    const name = String(body.name).trim();
    if (!name) throw new PlayerInputError('Name required');
    profile.name = name;
  }
  if (has(body, 'role')) {
    const role = String(body.role).trim();
    if (!role) throw new PlayerInputError('Role required');
    profile.role = role;
  }
  if (has(body, 'value')) profile.value = positiveInt(body, 'value', 'Value');
  if (has(body, 'advancements')) profile.advancements = positiveInt(body, 'advancements', 'Advancements', 99);
  if (has(body, 'spp')) profile.spp = positiveInt(body, 'spp', 'SPP', 999);
  if (body.jersey_number !== undefined) {
    profile.jersey_number = body.jersey_number === null || body.jersey_number === ''
        ? null
        : positiveInt(body, 'jersey_number', 'Jersey number', 99);
  }

  for (const stat of STAT_KEYS) {
    if (!has(body, stat)) continue;
    const value = parseCharacteristic(stat, body[stat]);
    if (value === null) throw new PlayerInputError(`${statLabel(stat)} must be one of: ${allowedValues(stat)}`);
    assignCharacteristic(profile, stat, value);
  }

  for (const key of ['primary_skills', 'secondary_skills'] as const) {
    if (body[key] === undefined) continue;
    // null o stringa vuota: il giocatore non ha categorie di quel tipo
    if (body[key] === null || String(body[key]).trim() === '') { profile[key] = null; continue; }
    const categories = parseCategories(body[key]);
    if (categories === null) {
      throw new PlayerInputError(`${key === 'primary_skills' ? 'Primary' : 'Secondary'} skill categories: use the letters A, D, G, M, P, S (e.g. "G, A")`);
    }
    profile[key] = categories;
  }

  if (has(body, 'status')) {
    if (!isPlayerStatus(body.status)) throw new PlayerInputError(`Status must be one of: ${PLAYER_STATUSES.join(', ')}`);
    profile.status = body.status;
  }

  return profile;
}

// Assegnazione tipata: ogni caratteristica finisce nel proprio campo (ag non può ricevere un AV)
function assignCharacteristic<K extends StatKey>(profile: PlayerProfileInput, stat: K, value: Characteristics[K]) {
  profile[stat] = value;
}
