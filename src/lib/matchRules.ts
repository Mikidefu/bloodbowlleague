// Pre-partita e post-partita di League Play applicati al database (solo server).
// Le regole pure stanno in leagueRules.ts; qui si leggono i dati, si valida l'input e si preparano gli statement.
//
// Ogni effetto di una partita è registrato (match_team_reports, player_injuries) così da poterlo annullare:
// correggere un referto = annullare gli effetti precedenti in memoria e riapplicare quelli nuovi.

import crypto from 'crypto';
import db from '@/lib/db';
import { recalcSppStatement } from '@/lib/spp';
import { isLeagueMatch, MATCH_TYPES } from '@/lib/matchTypes';
import { isStatKey, reduceCharacteristic, restoreCharacteristic, type Characteristics, type StatKey } from '@/lib/characteristics';
import {
  CONCEDE_QUIT_MAX_ROLL, CONCEDE_QUIT_MIN_ADVANCEMENTS, HATRED_FORBIDDEN_KEYWORDS, LIMITS, MATCH_OUTCOMES,
  MISTAKE_THRESHOLD, PETTY_CASH_TREASURY_TOP_UP, casualtyInfo, concededScore, dedicatedFansChange, expensiveMistake, fanFactor,
  getInducement, inducementChoiceCost, isDieValue, mistakeExtraRoll, pettyCash, sppEarned,
  treasuryAfterMistake, winnings,
  type CasualtyResult, type InducementChoice, type InjuryStat, type MatchOutcome, type MatchResult, type MistakeResult, type SppStats,
} from '@/lib/leagueRules';
import { canPlayNextMatch, flag, hatredList, isPlayerStatus, onDraftList, playerStatus, toPlayer, toPlayerInjury } from '@/lib/players';
import { getPosition, getRoster, hasRule, journeymanPositions, skillBaseName, type Roster } from '@/lib/rosters';
import { computeTeamValue } from '@/lib/teamValue';
import type { MatchInjury, Player, PlayerStatus } from '@/lib/types';

type Row = Record<string, unknown>;
type Arg = string | number | null;
export type Statement = { sql: string; args: Arg[] };

export class RuleError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const num = (v: unknown) => Number(v ?? 0) || 0;
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));
const parseJson = <T>(v: unknown, fallback: T): T => {
  try { return v ? (JSON.parse(String(v)) as T) : fallback; } catch { return fallback; }
};
const isCount = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 99;

export const isFriendly = (matchType: unknown) => matchType === MATCH_TYPES.friendly;
// Le partite di playoff si decidono con supplementari e rigori (p. 83)
export const isKnockout = (matchType: unknown) => !isFriendly(matchType) && !isLeagueMatch(matchType);

// ------------------------------------------------------------------
// Caricamento
// ------------------------------------------------------------------

// Il giocatore come lo modifica il referto: un Player più la partita che gli fa saltare la prossima
// (mng_match_id), che serve solo qui per poter annullare l'infortunio correggendo il referto.
export type MatchPlayerState = Player & { mng_match_id: string | null };

export type MatchContext = {
  match: Row;
  teamIds: [string, string];
  teams: Map<string, Row>;
  players: MatchPlayerState[];
  reports: Map<string, Row>;
  injuries: MatchInjury[];
};

export async function loadMatch(matchId: string): Promise<MatchContext> {
  const { rows: [match] } = await db.execute({
    sql: `SELECT m.*, s.status AS season_db_status FROM matches m LEFT JOIN seasons s ON s.id = m.season_id WHERE m.id = ?`,
    args: [matchId],
  });
  if (!match) throw new RuleError('Match not found', 404);
  const teamIds: [string, string] = [String(match.home_team_id), String(match.away_team_id)];
  const [teams, players, reports, injuries] = await Promise.all([
    db.execute({ sql: 'SELECT * FROM teams WHERE id IN (?, ?)', args: teamIds }),
    db.execute({ sql: 'SELECT * FROM players WHERE team_id IN (?, ?) ORDER BY jersey_number, created_at', args: teamIds }),
    db.execute({ sql: 'SELECT * FROM match_team_reports WHERE match_id = ?', args: [matchId] }),
    db.execute({ sql: 'SELECT * FROM player_injuries WHERE match_id = ?', args: [matchId] }),
  ]);
  return {
    match,
    teamIds,
    teams: new Map(teams.rows.map(t => [String(t.id), { ...t }])),
    players: players.rows.map(p => ({ ...toPlayer(p), mng_match_id: str(p.mng_match_id) })),
    reports: new Map(reports.rows.map(r => [String(r.team_id), { ...r }])),
    injuries: injuries.rows.map(toPlayerInjury),
  };
}

async function skillIdsByName() {
  const { rows } = await db.execute('SELECT id, name FROM skills');
  return new Map(rows.map(r => [String(r.name).toLowerCase(), String(r.id)]));
}

// Skill del profilo di una posizione collegate alla tabella skills (per nome base, es. "Loner (4+)" -> Loner)
export function skillLinks(playerId: string, skills: string[], ids: Map<string, string>): Statement[] {
  const unique = [...new Set(skills.map(s => ids.get(skillBaseName(s).toLowerCase())).filter((id): id is string => !!id))];
  return unique.map(skillId => ({ sql: 'INSERT OR IGNORE INTO skills_players (player_id, skill_id) VALUES (?, ?)', args: [playerId, skillId] }));
}

// Chi può scendere in campo nella prossima partita: vedi canPlayNextMatch in src/lib/players.ts
const canPlayNext = canPlayNextMatch;

const upsertReport = (matchId: string, teamId: string, fields: Record<string, Arg>): Statement => {
  const keys = Object.keys(fields);
  return {
    sql: `INSERT INTO match_team_reports (match_id, team_id, ${keys.join(', ')}) VALUES (?, ?, ${keys.map(() => '?').join(', ')})
          ON CONFLICT(match_id, team_id) DO UPDATE SET ${keys.map(k => `${k} = excluded.${k}`).join(', ')}`,
    args: [matchId, teamId, ...keys.map(k => fields[k])],
  };
};

// ------------------------------------------------------------------
// Pre-partita (pp. 44-45, 94, 142-148)
// ------------------------------------------------------------------

export type PregameTeamInput = {
  fair_weather: number;
  journeyman_position?: string | null;
  inducements?: InducementChoice[];
  riotous_roll?: number | null;
};

export type PregameInput = { teams: Record<string, PregameTeamInput> };

function validateInducements(
    choices: InducementChoice[], roster: Roster | null, favouredOf: string | null, players: Player[], journeymenCount: number,
) {
  const ctx = { roster, favouredOf };
  let total = 0;
  const seen = new Set<string>();
  let mercenaries = 0;
  let starSlots = 0;
  let starChoices = 0;
  const mercsByPosition = new Map<string, number>();

  for (const choice of choices) {
    const def = getInducement(choice?.key);
    if (!def) throw new RuleError(`Unknown inducement: ${choice?.key}`);
    if (!def.available(ctx)) throw new RuleError(`${def.name} is not available to this team (p. ${def.page})`);
    const cost = inducementChoiceCost(choice, ctx);
    if (cost === null) throw new RuleError(`${def.name}: invalid choice`);

    if (choice.key === 'mercenary') {
      mercenaries += choice.qty;
      mercsByPosition.set(String(choice.position_key), (mercsByPosition.get(String(choice.position_key)) ?? 0) + choice.qty);
    } else if (choice.key === 'star_player') {
      if (!choice.name?.trim()) throw new RuleError('Star Player: name required');
      starChoices += 1;
      starSlots += choice.qty;   // coppie: una scelta che occupa due posti
    } else {
      if (seen.has(choice.key)) throw new RuleError(`${def.name} selected twice`);
      seen.add(choice.key);
      if (choice.qty > def.max(ctx)) throw new RuleError(`${def.name}: at most ${def.max(ctx)} (p. ${def.page})`);
    }
    total += cost;
  }

  if (mercenaries > 3) throw new RuleError('Mercenary Players: at most 3 (p. 147)');
  // I Mercenari non possono superare i limiti di posizione; chi salta la partita non conta (p. 147)
  const playing = players.filter(p => onDraftList(p) && !p.mng);
  for (const [positionKey, qty] of mercsByPosition) {
    const position = getPosition(roster, positionKey);
    if (!position) throw new RuleError('Mercenary Player: unknown position');
    const current = playing.filter(p => p.position_key === positionKey).length;
    if (current + qty > position.max) throw new RuleError(`Mercenary ${position.name}: the team would have more than ${position.max} (p. 147)`);
    const group = roster?.groups?.find(g => g.positions.includes(positionKey));
    if (group) {
      const inGroup = playing.filter(p => group.positions.includes(p.position_key ?? '')).length
          + [...mercsByPosition].filter(([k]) => group.positions.includes(k)).reduce((s, [, q]) => s + q, 0);
      if (inGroup > group.max) throw new RuleError(`Mercenary ${group.label}: at most ${group.max}`);
    }
  }
  if (starChoices > 2) throw new RuleError('Star Players: at most 2 (p. 148)');
  const available = players.filter(canPlayNext).length + journeymenCount;
  if (starSlots > 0 && available + starSlots > LIMITS.maxPlayers) throw new RuleError('Star Players cannot take the team above 16 players (p. 148)');
  return total;
}

export async function applyPregame(matchId: string, input: PregameInput) {
  const ctx = await loadMatch(matchId);
  if (flag(ctx.match.is_played)) throw new RuleError('The match has already been played: its pre-game can no longer change.', 409);
  if (isFriendly(ctx.match.match_type)) throw new RuleError('Friendly games have no pre-game sequence.', 409);

  const statements: Statement[] = [];
  const skillIds = await skillIdsByName();
  const plan = new Map<string, { team: Row; roster: Roster | null; ctv: number; treasury: number; cost: number; fanFactor: number; fairWeather: number; journeymen: number; choices: InducementChoice[] }>();

  for (const teamId of ctx.teamIds) {
    const team = ctx.teams.get(teamId)!;
    const roster = getRoster(str(team.roster));
    const t = input?.teams?.[teamId];
    if (!t) throw new RuleError(`Missing pre-game data for ${team.name}`);
    if (!isDieValue(t.fair_weather, 1, 3)) throw new RuleError(`${team.name}: Fair-weather Fans must be a D3 roll (1-3)`);

    // Annulla un eventuale pre-partita precedente: Treasury spesa e Journeymen creati per questa partita
    const previous = ctx.reports.get(teamId);
    const treasury = num(team.treasury) + num(previous?.treasury_spent);
    const oldJourneymen = ctx.players.filter(p => p.team_id === teamId && p.journeyman && p.journeyman_match_id === matchId);
    for (const j of oldJourneymen) statements.push({ sql: 'DELETE FROM players WHERE id = ?', args: [j.id] });
    const players = ctx.players.filter(p => p.team_id === teamId && !oldJourneymen.includes(p));

    const choices = Array.isArray(t.inducements) ? t.inducements.filter(c => c && c.qty > 0) : [];

    // Take on Journeymen (p. 94) + Riotous Rookies (p. 145)
    let journeymen = Math.max(0, LIMITS.minPlayers - players.filter(canPlayNext).length);
    if (choices.some(c => c.key === 'riotous_rookies')) {
      if (!isDieValue(t.riotous_roll, 3, 7)) throw new RuleError(`${team.name}: Riotous Rookies needs the 2D3+1 roll (3-7)`);
      journeymen += t.riotous_roll as number;
    }
    const newJourneymen: Player[] = [];
    if (journeymen > 0) {
      const options = journeymanPositions(roster);
      if (!options.length) throw new RuleError(`${team.name} needs ${journeymen} Journeymen: link the team to its Team Roster first.`);
      const position = options.find(o => o.key === t.journeyman_position) ?? (options.length === 1 ? options[0] : null);
      if (!position) throw new RuleError(`${team.name}: choose which Lineman position the Journeymen come from`);
      for (let i = 1; i <= journeymen; i++) {
        const id = crypto.randomUUID();
        const journeyman = toPlayer({
          id, team_id: teamId, name: `Journeyman ${i}`, role: position.name, position_key: position.key,
          value: position.cost, hiring_fee: position.cost, journeyman: 1, journeyman_match_id: matchId,
          ma: position.ma, st: position.st, ag: position.ag, pa: position.pa, av: position.av,
        });
        newJourneymen.push(journeyman);
        statements.push({
          sql: `INSERT INTO players (id, team_id, name, role, position_key, value, hiring_fee, primary_skills, secondary_skills,
                                     ma, st, ag, pa, av, spp, spp_base, advancements, status, mng, dead, journeyman, journeyman_match_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 'Active', 0, 0, 1, ?)`,
          args: [id, teamId, journeyman.name, position.name, position.key, position.cost, position.cost,
                 position.primary.join(', '), position.secondary.join(', '),
                 position.ma, position.st, position.ag, position.pa, position.av, matchId],
        });
        // I Journeymen hanno il profilo della posizione più Loner (4+)
        statements.push(...skillLinks(id, [...position.skills, 'Loner (4+)'], skillIds));
      }
    }

    const { ctv } = computeTeamValue(team, [...players, ...newJourneymen]);
    const cost = validateInducements(choices, roster, str(team.favoured_of), players, newJourneymen.length);
    plan.set(teamId, { team, roster, ctv, treasury, cost, fanFactor: fanFactor(num(team.fan_factor), t.fair_weather), fairWeather: t.fair_weather, journeymen, choices });
  }

  // Petty Cash (p. 94)
  const [home, away] = ctx.teamIds.map(id => plan.get(id)!);
  const spent = new Map<string, { treasury: number; petty: number }>();
  if (home.ctv === away.ctv) {
    if (home.cost > 0 || away.cost > 0) throw new RuleError('Equal CTV: neither team can spend gold on Inducements (p. 94).');
    spent.set(ctx.teamIds[0], { treasury: 0, petty: 0 });
    spent.set(ctx.teamIds[1], { treasury: 0, petty: 0 });
  } else {
    const higherId = home.ctv > away.ctv ? ctx.teamIds[0] : ctx.teamIds[1];
    const lowerId = higherId === ctx.teamIds[0] ? ctx.teamIds[1] : ctx.teamIds[0];
    const higher = plan.get(higherId)!;
    const lower = plan.get(lowerId)!;
    if (higher.cost > higher.treasury) throw new RuleError(`${higher.team.name} does not have enough gold in its Treasury (${higher.treasury.toLocaleString()} gp).`);
    const petty = pettyCash(higher.ctv, lower.ctv, higher.cost);
    const topUp = Math.max(0, lower.cost - petty);
    const maxTopUp = Math.min(PETTY_CASH_TREASURY_TOP_UP, lower.treasury);
    if (topUp > maxTopUp) throw new RuleError(`${lower.team.name}: Petty Cash is ${petty.toLocaleString()} gp and at most ${maxTopUp.toLocaleString()} gp can be added from the Treasury.`);
    spent.set(higherId, { treasury: higher.cost, petty: 0 });
    spent.set(lowerId, { treasury: topUp, petty });
  }

  for (const [teamId, p] of plan) {
    const s = spent.get(teamId)!;
    statements.push({ sql: 'UPDATE teams SET treasury = ? WHERE id = ?', args: [p.treasury - s.treasury, teamId] });
    statements.push(upsertReport(matchId, teamId, {
      fair_weather: p.fairWeather, fan_factor: p.fanFactor, ctv: p.ctv, petty_cash: s.petty, treasury_spent: s.treasury,
      inducements: JSON.stringify(p.choices), journeymen: p.journeymen,
    }));
  }
  statements.push({ sql: 'UPDATE matches SET pregame_done = 1 WHERE id = ?', args: [matchId] });
  await db.batch(statements, 'write');
}

// ------------------------------------------------------------------
// Referto e post-partita (pp. 67-68, 95-103)
// ------------------------------------------------------------------

export type InjuryInput = { result: CasualtyResult; stat?: InjuryStat | null; hatred?: string | null };

export type PlayerResultInput = {
  player_id: string;
  td: number; cas: number; int: number; comp: number; ttm: number; landing: number; mvp: number;
  injury?: InjuryInput | null;
  status?: PlayerStatus;   // solo partite legacy
};

export type TeamResultInput = {
  stalling?: boolean;
  df_roll?: number | null;
  commitments_roll?: number | null;
  quit_rolls?: Record<string, number>;
};

export type ResultInput = {
  outcome?: MatchOutcome;
  conceded_team_id?: string | null;
  penalty_winner_id?: string | null;
  home_score?: number;
  away_score?: number;
  home_casualties?: number;
  away_casualties?: number;
  match_date?: string | null;
  teams?: Record<string, TeamResultInput>;
  playerStats?: PlayerResultInput[];
};

const PLAYER_STATE_COLUMNS = ['ma', 'st', 'ag', 'pa', 'av', 'mng', 'mng_match_id', 'dead', 'left_team', 'niggling_injuries', 'hatreds', 'journeyman', 'status'] as const;

// SQLite non ha booleani: le bandiere tornano 0/1
const toArg = (value: string | number | boolean | null): Arg => (typeof value === 'boolean' ? (value ? 1 : 0) : value);

const playerUpdate = (p: MatchPlayerState): Statement => ({
  sql: `UPDATE players SET ${PLAYER_STATE_COLUMNS.map(c => `${c} = ?`).join(', ')} WHERE id = ?`,
  args: [...PLAYER_STATE_COLUMNS.map(c => (c === 'status' ? playerStatus(p) : toArg(p[c]))), p.id],
});

// Assegnazione tipata di una caratteristica (ag non può ricevere un AV)
function setCharacteristic<K extends StatKey>(p: Characteristics, stat: K, value: Characteristics[K]) {
  p[stat] = value;
}

// Annulla in memoria gli effetti del referto già applicato (non Expensive Mistakes né pre-partita)
function revertResultInMemory(ctx: MatchContext) {
  const matchId = String(ctx.match.id);
  const byId = new Map(ctx.players.map(p => [p.id, p]));
  for (const [teamId, report] of ctx.reports) {
    const team = ctx.teams.get(teamId)!;
    team.treasury = num(team.treasury) - num(report.winnings);
    team.fan_factor = num(team.fan_factor) - num(report.df_change);
    for (const id of parseJson<string[]>(report.quit_player_ids, [])) { const p = byId.get(id); if (p) p.left_team = false; }
    for (const id of parseJson<string[]>(report.recovered_player_ids, [])) { const p = byId.get(id); if (p) p.mng = true; }
    Object.assign(report, { winnings: 0, df_roll: null, df_change: 0, quit_player_ids: null, recovered_player_ids: null, stalling: 0 });
  }
  for (const injury of ctx.injuries) {
    const p = byId.get(injury.player_id);
    if (!p) continue;
    const { stat } = injury;
    if (stat && flag(injury.stat_applied)) setCharacteristic(p, stat, restoreCharacteristic(stat, p[stat]));
    if (injury.result === 'SI') p.niggling_injuries = Math.max(0, p.niggling_injuries - 1);
    if (injury.result === 'DEAD') p.dead = false;
    if (casualtyInfo(injury.result)?.missNextGame && p.mng_match_id === matchId) { p.mng = false; p.mng_match_id = null; }
    if (injury.hatred) {
      const list = hatredList(p.hatreds);
      const index = list.indexOf(injury.hatred);
      if (index >= 0) list.splice(index, 1);
      p.hatreds = list.join(', ') || null;
    }
  }
  ctx.injuries = [];
}

const outcomeOf = (value: unknown): MatchOutcome => (MATCH_OUTCOMES.includes(value as MatchOutcome) ? value as MatchOutcome : 'played');

export async function applyResult(matchId: string, input: ResultInput) {
  const ctx = await loadMatch(matchId);
  const { match, teamIds } = ctx;
  const friendly = isFriendly(match.match_type);
  const legacy = flag(match.is_played) && !flag(match.rules_applied);
  if (friendly || legacy) return applySimpleResult(ctx, input, friendly);

  for (const [, report] of ctx.reports) {
    if (report.mistake_result) throw new RuleError('Expensive Mistakes have already been rolled for this match: undo them before changing the result.', 409);
  }

  const outcome = outcomeOf(input.outcome);
  const [homeId, awayId] = teamIds;
  const conceder = outcome === 'played' || outcome === 'forfeit_both' ? null : str(input.conceded_team_id);
  if (outcome !== 'played' && outcome !== 'forfeit_both' && !teamIds.includes(conceder ?? '')) throw new RuleError('Choose the team that conceded');
  const played = outcome === 'played' || outcome === 'conceded' || outcome === 'conceded_no_penalty';
  if (played && !flag(match.pregame_done)) throw new RuleError('Complete the pre-game first: Fan Factor is needed to work out Winnings.', 409);

  revertResultInMemory(ctx);
  const byId = new Map(ctx.players.map(p => [p.id, p]));

  // --- Punteggio ---
  const intOr0 = (v: unknown, label: string) => {
    if (v === undefined || v === null) return 0;
    if (!isCount(v)) throw new RuleError(`${label} must be a whole number`);
    return v as number;
  };
  const score: Record<string, number> = { [homeId]: intOr0(input.home_score, 'Score'), [awayId]: intOr0(input.away_score, 'Score') };
  const casualties: Record<string, number> = { [homeId]: intOr0(input.home_casualties, 'Casualties'), [awayId]: intOr0(input.away_casualties, 'Casualties') };
  if (!played) {
    // Partita non giocata entro il limite: nessun TD né Casualty (p. 102)
    for (const id of teamIds) { score[id] = 0; casualties[id] = 0; }
  }
  if (conceder) {
    // Chi non concede vince 2-0, o X-0 se aveva già segnato di più (pp. 101-102)
    const winnerId = conceder === homeId ? awayId : homeId;
    score[winnerId] = concededScore(score[winnerId]);
    score[conceder] = 0;
  }

  const result: Record<string, MatchResult> = {};
  if (outcome === 'forfeit_both') {
    result[homeId] = 'loss';
    result[awayId] = 'loss';
  } else if (score[homeId] !== score[awayId]) {
    result[homeId] = score[homeId] > score[awayId] ? 'win' : 'loss';
    result[awayId] = result[homeId] === 'win' ? 'loss' : 'win';
  } else if (isKnockout(match.match_type)) {
    const winner = str(input.penalty_winner_id);
    if (!winner || !teamIds.includes(winner)) throw new RuleError('Play-off games need a winner: after Extra Time, choose who won the Penalty Shoot-out (p. 83).');
    result[winner] = 'win';
    result[winner === homeId ? awayId : homeId] = 'loss';
  } else {
    result[homeId] = 'draw';
    result[awayId] = 'draw';
  }
  const penaltyWinner = isKnockout(match.match_type) && score[homeId] === score[awayId] && outcome !== 'forfeit_both' ? str(input.penalty_winner_id) : null;

  // --- Recupero di chi ha saltato questa partita (p. 100) ---
  const recovered = new Map<string, string[]>(teamIds.map(id => [id, []]));
  for (const p of ctx.players) {
    if (p.mng && p.mng_match_id !== matchId && !p.dead) {
      recovered.get(p.team_id)!.push(p.id);
      p.mng = false;
    }
  }
  const missed = new Set([...recovered.values()].flat());

  // --- Statistiche e infortuni ---
  const stats = Array.isArray(input.playerStats) ? input.playerStats : [];
  const statements: Statement[] = [{ sql: 'DELETE FROM player_stats WHERE match_id = ?', args: [matchId] }, { sql: 'DELETE FROM player_injuries WHERE match_id = ?', args: [matchId] }];
  const mvps: Record<string, number> = { [homeId]: 0, [awayId]: 0 };
  const injuries: Statement[] = [];
  const recalc = new Set<string>();

  for (const s of stats) {
    const p = byId.get(String(s?.player_id));
    if (!p) throw new RuleError('Unknown player in the match report');
    const teamId = p.team_id;
    const values: SppStats = { td: s.td, cas: s.cas, int: s.int, comp: s.comp, ttm: s.ttm ?? 0, landing: s.landing ?? 0, mvp: s.mvp };
    for (const [k, v] of Object.entries(values)) if (!isCount(v)) throw new RuleError(`${p.name}: ${k} must be a whole number`);
    const any = Object.values(values).some(v => v > 0);
    const injury = s.injury && s.injury.result ? s.injury : null;
    if (!any && !injury) continue;

    const eligible = !missed.has(p.id) && !p.dead && !p.left_team && !p.temp_retired
        && (!p.journeyman || p.journeyman_match_id === matchId);
    if (!eligible) throw new RuleError(`${p.name} could not play this match`);
    if (!played) {
      const onlyMvp = values.mvp > 0 && Object.entries(values).every(([k, v]) => k === 'mvp' || v === 0);
      if (!onlyMvp || injury || outcome === 'forfeit_both' || teamId === conceder) throw new RuleError('An unplayed match can only record the MVP awards of the team that did not concede.');
    }
    mvps[teamId] += values.mvp;

    const roster = getRoster(str(ctx.teams.get(teamId)!.roster));
    const lostSpp = outcome === 'conceded' && teamId === conceder;   // chi concede perde gli SPP (p. 101)
    const spp = lostSpp ? 0 : sppEarned(values, { brawlinBrutes: hasRule(roster, 'Brawlin Brutes') });
    statements.push({
      sql: `INSERT INTO player_stats (id, match_id, player_id, touchdowns, casualties, interceptions, completions, ttm, landings, mvp, spp_earned)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [crypto.randomUUID(), matchId, p.id, values.td, values.cas, values.int, values.comp, values.ttm, values.landing, values.mvp, spp],
    });
    recalc.add(p.id);

    if (injury) {
      if (!played) throw new RuleError('Injuries can only be recorded for matches that were played');
      const info = casualtyInfo(injury.result);
      if (!info) throw new RuleError(`${p.name}: unknown Casualty result`);
      let stat: InjuryStat | null = null;
      let applied = false;
      if (injury.result === 'LI') {
        stat = injury.stat ?? null;
        if (!stat || !isStatKey(stat)) throw new RuleError(`${p.name}: choose the characteristic reduced by the Lasting Injury`);
        const reduced = reduceCharacteristic(stat, p[stat]);
        if (reduced !== null) { setCharacteristic(p, stat, reduced); applied = true; }
      }
      if (info.niggling) p.niggling_injuries += 1;
      if (info.missNextGame) { p.mng = true; p.mng_match_id = matchId; }
      if (injury.result === 'DEAD') p.dead = true;
      const hatred = injury.hatred?.trim() || null;
      if (hatred) {
        if (!info.missNextGame) throw new RuleError(`${p.name}: Getting Even only follows a Seriously Hurt, Serious Injury or Lasting Injury (p. 68)`);
        if (HATRED_FORBIDDEN_KEYWORDS.some(k => k.toLowerCase() === hatred.toLowerCase())) throw new RuleError(`${p.name}: Hatred cannot be a position keyword (p. 68)`);
        p.hatreds = [...hatredList(p.hatreds), hatred].join(', ');
      }
      injuries.push({
        sql: 'INSERT INTO player_injuries (id, match_id, player_id, result, stat, stat_applied, hatred) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [crypto.randomUUID(), matchId, p.id, injury.result, stat, applied ? 1 : 0, hatred],
      });
    }
  }

  // MVP (p. 96, 101, 102)
  for (const teamId of teamIds) {
    const opponentConceded = conceder !== null && conceder !== teamId && (outcome === 'conceded' || outcome === 'forfeit_commitments');
    const max = outcome === 'forfeit_both' || (conceder === teamId && outcome !== 'conceded_no_penalty') ? 0 : opponentConceded ? 2 : 1;
    if (mvps[teamId] > max) throw new RuleError(`${ctx.teams.get(teamId)!.name} can award at most ${max} MVP`);
  }

  // --- Winnings, Dedicated Fans, giocatori che se ne vanno ---
  const fanAttendance = teamIds.reduce((sum, id) => sum + num(ctx.reports.get(id)?.fan_factor), 0);
  for (const teamId of teamIds) {
    const team = ctx.teams.get(teamId)!;
    const t = input.teams?.[teamId] ?? {};
    const stalling = !!t.stalling;
    const isConceder = conceder === teamId;

    let gold = 0;
    if (outcome === 'played' || outcome === 'conceded_no_penalty') gold = winnings(fanAttendance, score[teamId], stalling);
    else if (outcome === 'conceded') gold = isConceder ? 0 : (fanAttendance + score[teamId]) * 10000;
    else if (outcome === 'forfeit_commitments' && !isConceder) {
      if (!isDieValue(t.commitments_roll, 1, 6)) throw new RuleError(`${team.name}: roll a D6 for the Winnings of the unplayed fixture (p. 102)`);
      gold = (t.commitments_roll as number) * 10000;
    }

    let dfChange = 0;
    const df = num(team.fan_factor);
    if (outcome === 'conceded' && isConceder) {
      // Chi concede perde D3 Dedicated Fans, minimo 1 (p. 101)
      if (!isDieValue(t.df_roll, 1, 3)) throw new RuleError(`${team.name}: roll a D3 for the Dedicated Fans lost by conceding`);
      dfChange = Math.max(LIMITS.dedicatedFansMin, df - (t.df_roll as number)) - df;
    } else if (result[teamId] !== 'draw') {
      if (!isDieValue(t.df_roll, 1, 6)) throw new RuleError(`${team.name}: roll a D6 to update Dedicated Fans (p. 95)`);
      dfChange = dedicatedFansChange(result[teamId], df, t.df_roll as number);
    }

    const quit: string[] = [];
    if (outcome === 'conceded' && isConceder) {
      for (const p of ctx.players.filter(p => p.team_id === teamId && onDraftList(p) && !p.journeyman && p.advancements >= CONCEDE_QUIT_MIN_ADVANCEMENTS)) {
        const roll = t.quit_rolls?.[p.id];
        if (!isDieValue(roll, 1, 6)) throw new RuleError(`${p.name} has ${p.advancements} advancements: roll a D6 to see if they quit (p. 101)`);
        if ((roll as number) <= CONCEDE_QUIT_MAX_ROLL) { p.left_team = true; quit.push(p.id); }
      }
    }

    team.treasury = num(team.treasury) + gold;
    team.fan_factor = df + dfChange;
    statements.push({ sql: 'UPDATE teams SET treasury = ?, fan_factor = ? WHERE id = ?', args: [num(team.treasury), num(team.fan_factor), teamId] });
    statements.push(upsertReport(matchId, teamId, {
      stalling: stalling ? 1 : 0, winnings: gold, df_roll: (t.df_roll as number) ?? null, df_change: dfChange,
      quit_player_ids: quit.length ? JSON.stringify(quit) : null,
      recovered_player_ids: recovered.get(teamId)!.length ? JSON.stringify(recovered.get(teamId)) : null,
    }));
  }

  for (const p of ctx.players) statements.push(playerUpdate(p));
  statements.push(...injuries);
  statements.push({
    sql: `UPDATE matches SET home_score = ?, away_score = ?, home_casualties = ?, away_casualties = ?, outcome = ?, conceded_team_id = ?,
                             penalty_winner_id = ?, is_played = 1, rules_applied = 1, played_at = COALESCE(played_at, CURRENT_TIMESTAMP), match_date = ?
          WHERE id = ?`,
    args: [score[homeId], score[awayId], casualties[homeId], casualties[awayId], outcome, conceder, penaltyWinner, input.match_date || null, matchId],
  });
  // SPP: anche chi aveva statistiche nella versione precedente del referto
  const { rows: previous } = await db.execute({ sql: 'SELECT DISTINCT player_id FROM player_stats WHERE match_id = ?', args: [matchId] });
  for (const r of previous) recalc.add(String(r.player_id));
  for (const id of recalc) statements.push(recalcSppStatement(id));

  await db.batch(statements, 'write');
}

// Amichevoli (p. 103: niente SPP, niente Winnings, Casualty = Badly Hurt, gli MNG restano) e partite legacy
async function applySimpleResult(ctx: MatchContext, input: ResultInput, friendly: boolean) {
  const matchId = String(ctx.match.id);
  const byId = new Map(ctx.players.map(p => [p.id, p]));
  const statements: Statement[] = [];
  const recalc = new Set<string>();
  const { rows: previous } = await db.execute({ sql: 'SELECT DISTINCT player_id FROM player_stats WHERE match_id = ?', args: [matchId] });
  for (const r of previous) recalc.add(String(r.player_id));

  const [homeId, awayId] = ctx.teamIds;
  const count = (v: unknown) => (isCount(v) ? (v as number) : 0);
  const homeScore = count(input.home_score);
  const awayScore = count(input.away_score);
  if (!friendly && isKnockout(ctx.match.match_type) && homeScore === awayScore && ![homeId, awayId].includes(str(input.penalty_winner_id) ?? '')) {
    throw new RuleError('Play-off games need a winner: after Extra Time, choose who won the Penalty Shoot-out (p. 83).');
  }
  statements.push({
    sql: `UPDATE matches SET home_score = ?, away_score = ?, home_casualties = ?, away_casualties = ?, penalty_winner_id = ?,
                             is_played = 1, played_at = COALESCE(played_at, CURRENT_TIMESTAMP), match_date = ? WHERE id = ?`,
    args: [homeScore, awayScore, count(input.home_casualties), count(input.away_casualties),
           homeScore === awayScore ? str(input.penalty_winner_id) : null, input.match_date || null, matchId],
  });
  statements.push({ sql: 'DELETE FROM player_stats WHERE match_id = ?', args: [matchId] });

  const mvps = new Map<string, number>();
  for (const s of Array.isArray(input.playerStats) ? input.playerStats : []) {
    const p = byId.get(String(s?.player_id));
    if (!p) throw new RuleError('Unknown player in the match report');
    const values: SppStats = { td: count(s.td), cas: count(s.cas), int: count(s.int), comp: count(s.comp), ttm: count(s.ttm), landing: count(s.landing), mvp: count(s.mvp) };
    mvps.set(p.team_id, (mvps.get(p.team_id) ?? 0) + values.mvp);
    const roster = getRoster(str(ctx.teams.get(p.team_id)?.roster));
    const spp = friendly ? 0 : sppEarned(values, { brawlinBrutes: hasRule(roster, 'Brawlin Brutes') });
    if (Object.values(values).some(v => v > 0)) {
      statements.push({
        sql: `INSERT INTO player_stats (id, match_id, player_id, touchdowns, casualties, interceptions, completions, ttm, landings, mvp, spp_earned)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [crypto.randomUUID(), matchId, p.id, values.td, values.cas, values.int, values.comp, values.ttm, values.landing, values.mvp, spp],
      });
    }
    // Partite legacy: lo stato si imposta a mano come prima. Le amichevoli non cambiano lo stato dei giocatori.
    if (!friendly && s.status) {
      if (!isPlayerStatus(s.status)) throw new RuleError(`${p.name}: unknown status`);
      const dead = s.status === 'Dead' ? 1 : 0;
      const mng = s.status === 'Injured' ? 1 : 0;
      statements.push({ sql: 'UPDATE players SET status = ?, mng = ?, dead = ? WHERE id = ?', args: [s.status, mng, dead, p.id] });
    }
    recalc.add(p.id);
  }
  for (const [teamId, total] of mvps) {
    if (total > 1) throw new RuleError(`${ctx.teams.get(teamId)?.name} can award at most 1 MVP`);
  }
  for (const id of recalc) statements.push(recalcSppStatement(id));
  await db.batch(statements, 'write');
}

// ------------------------------------------------------------------
// Expensive Mistakes (p. 100) e Journeymen non ingaggiati (p. 99)
// ------------------------------------------------------------------

export async function applyExpensiveMistakes(matchId: string, teamId: string, roll: unknown, extra: unknown) {
  const ctx = await loadMatch(matchId);
  if (!flag(ctx.match.rules_applied)) throw new RuleError('Save the match result first', 409);
  const team = ctx.teams.get(teamId);
  const report = ctx.reports.get(teamId);
  if (!team || !report) throw new RuleError('Team not found in this match', 404);
  if (report.mistake_result) throw new RuleError('Expensive Mistakes have already been resolved for this team', 409);

  const treasury = num(team.treasury);
  let result: MistakeResult | null = null;   // null = Treasury sotto 100.000: nessun tiro
  let after = treasury;
  if (treasury >= MISTAKE_THRESHOLD) {
    if (!isDieValue(roll, 1, 6)) throw new RuleError('Roll a D6 on the Expensive Mistake Table');
    result = expensiveMistake(treasury, roll as number)!;
    const extraKind = mistakeExtraRoll(result);
    if (extraKind === 'd3' && !isDieValue(extra, 1, 3)) throw new RuleError('Minor Incident: roll a D3');
    if (extraKind === '2d6' && !isDieValue(extra, 2, 12)) throw new RuleError('Catastrophe: roll 2D6');
    after = treasuryAfterMistake(treasury, result, Number(extra) || 0);
  }

  // Step 5 del post-partita concluso: i Journeymen non ingaggiati se ne vanno
  const released = ctx.players.filter(p => p.team_id === teamId && p.journeyman && p.journeyman_match_id === matchId && !p.left_team).map(p => p.id);
  const statements: Statement[] = released.map(id => ({ sql: 'UPDATE players SET left_team = 1 WHERE id = ?', args: [id] }));
  statements.push({ sql: 'UPDATE teams SET treasury = ? WHERE id = ?', args: [after, teamId] });
  statements.push(upsertReport(matchId, teamId, {
    mistake_result: result ?? 'skipped', mistake_roll: result ? (roll as number) : null, mistake_extra: result && mistakeExtraRoll(result) ? Number(extra) : null,
    mistake_treasury_before: treasury, mistake_loss: treasury - after, released_player_ids: released.length ? JSON.stringify(released) : null,
  }));
  await db.batch(statements, 'write');
  return { result: result ?? 'skipped', treasury: after, loss: treasury - after };
}

export async function undoExpensiveMistakes(matchId: string, teamId: string) {
  const ctx = await loadMatch(matchId);
  const team = ctx.teams.get(teamId);
  const report = ctx.reports.get(teamId);
  if (!team || !report?.mistake_result) throw new RuleError('Nothing to undo', 409);
  const statements = mistakesRevertStatements(matchId, teamId, team, report);
  await db.batch(statements, 'write');
}

function mistakesRevertStatements(matchId: string, teamId: string, team: Row, report: Row): Statement[] {
  const statements: Statement[] = parseJson<string[]>(report.released_player_ids, []).map(id => ({ sql: 'UPDATE players SET left_team = 0 WHERE id = ?', args: [id] }));
  team.treasury = num(team.treasury) + num(report.mistake_loss);
  statements.push({ sql: 'UPDATE teams SET treasury = ? WHERE id = ?', args: [num(team.treasury), teamId] });
  statements.push(upsertReport(matchId, teamId, { mistake_result: null, mistake_roll: null, mistake_extra: null, mistake_treasury_before: null, mistake_loss: 0, released_player_ids: null }));
  Object.assign(report, { mistake_result: null, mistake_loss: 0, released_player_ids: null });
  return statements;
}

// Statement per eliminare una partita annullando tutti i suoi effetti (Expensive Mistakes, referto, pre-partita)
export async function deleteMatchStatements(matchId: string): Promise<Statement[]> {
  const ctx = await loadMatch(matchId);
  const statements: Statement[] = [];
  for (const [teamId, report] of ctx.reports) {
    if (report.mistake_result) statements.push(...mistakesRevertStatements(matchId, teamId, ctx.teams.get(teamId)!, report));
  }
  const byId = new Map(ctx.players.map(p => [p.id, p]));
  for (const id of ctx.reports.size ? [...ctx.reports.values()].flatMap(r => parseJson<string[]>(r.released_player_ids, [])) : []) {
    const p = byId.get(id); if (p) p.left_team = false;
  }
  if (flag(ctx.match.rules_applied)) {
    revertResultInMemory(ctx);
    for (const p of ctx.players) statements.push(playerUpdate(p));
  }
  for (const [teamId, report] of ctx.reports) {
    const team = ctx.teams.get(teamId)!;
    statements.push({ sql: 'UPDATE teams SET treasury = ?, fan_factor = ? WHERE id = ?', args: [num(team.treasury) + num(report.treasury_spent), num(team.fan_factor), teamId] });
  }
  const { rows: statPlayers } = await db.execute({ sql: 'SELECT DISTINCT player_id FROM player_stats WHERE match_id = ?', args: [matchId] });
  statements.push({ sql: 'DELETE FROM player_stats WHERE match_id = ?', args: [matchId] });
  statements.push({ sql: 'DELETE FROM players WHERE journeyman = 1 AND journeyman_match_id = ?', args: [matchId] });
  statements.push({ sql: 'DELETE FROM matches WHERE id = ?', args: [matchId] });
  for (const r of statPlayers) statements.push(recalcSppStatement(String(r.player_id)));
  return statements;
}
