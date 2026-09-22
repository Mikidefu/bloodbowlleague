// Calcoli del pre-partita (pp. 94, 142-148) condivisi da percorso guidato e riepilogo.
// Il server rifà tutto in applyPregame: qui c'è solo l'anteprima per chi compila.

import {
  LIMITS, PETTY_CASH_TREASURY_TOP_UP, fanFactor, inducementChoiceCost, pettyCash, type InducementChoice,
} from '@/lib/leagueRules';
import { getRoster, hasRule, isLineman, journeymanPositions } from '@/lib/rosters';
import { isTrue, type MatchDetails, type MatchTeam } from '@/lib/types';

export type TeamPregameDraft = {
  fair_weather: number | null;      // D3 dei Fair-weather Fans
  journeyman_position: string;
  inducements: InducementChoice[];
  riotous_roll: number | null;      // 2D3+1 dei Riotous Rookies
};

export const playersOf = (match: MatchDetails, teamId: string) =>
  [...match.homePlayers, ...match.awayPlayers].filter(p => p.team_id === teamId);

export const reportOf = (match: MatchDetails, teamId: string) => match.reports.find(r => r.team_id === teamId);

export function savedInducements(match: MatchDetails, teamId: string): InducementChoice[] {
  try {
    const raw = reportOf(match, teamId)?.inducements;
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Anteprima di una squadra: disponibili, Journeymen, CTV con i Journeymen, costo degli incentivi, Fan Factor
export function teamPreview(match: MatchDetails, team: MatchTeam, draft: TeamPregameDraft) {
  const roster = getRoster(team.roster);
  const players = playersOf(match, team.id);
  const available = players.filter(p => !p.unavailable && !isTrue(p.journeyman) && !isTrue(p.dead)).length;
  const unavailable = players.filter(p => p.unavailable && !isTrue(p.journeyman));
  const riotous = draft.inducements.some(c => c.key === 'riotous_rookies');
  const baseJourneymen = Math.max(0, LIMITS.minPlayers - available);
  const journeymen = baseJourneymen + (riotous ? draft.riotous_roll ?? 0 : 0);
  const options = journeymanPositions(roster);
  const jPosition = options.find(o => o.key === draft.journeyman_position) ?? (options.length === 1 ? options[0] : null);
  const jCtv = (position: typeof jPosition) => (!position ? 0 : hasRule(roster, 'Low Cost Linemen') && isLineman(position) ? 0 : position.cost);
  const existing = players.filter(p => isTrue(p.journeyman));
  const existingCtv = existing.reduce((sum, p) => sum + jCtv(roster?.positions.find(pos => pos.key === p.position_key) ?? null), 0);
  const ctv = team.ctv - existingCtv + journeymen * jCtv(jPosition);
  const ctx = { roster, favouredOf: team.favoured_of, league: team.team_league };
  const cost = draft.inducements.reduce((sum, c) => sum + (inducementChoiceCost(c, ctx) ?? 0), 0);
  const invalid = draft.inducements.filter(c => inducementChoiceCost(c, ctx) === null);
  const ff = draft.fair_weather ? fanFactor(team.dedicated_fans, draft.fair_weather) : null;
  // La Treasury prima di un eventuale pre-partita già salvato (che l'ha già scalata)
  const treasury = team.treasury + (reportOf(match, team.id)?.treasury_spent ?? 0);
  return { roster, ctx, available, unavailable, baseJourneymen, journeymen, options, jPosition, ctv, cost, invalid, ff, treasury };
}

export type TeamPreview = ReturnType<typeof teamPreview>;

// Chi spende per primo, Petty Cash e limiti (p. 94)
export function pregameBudget(home: MatchTeam, away: MatchTeam, pHome: TeamPreview, pAway: TeamPreview) {
  const equal = pHome.ctv === pAway.ctv;
  const higher = pHome.ctv > pAway.ctv ? home : away;
  const lower = higher.id === home.id ? away : home;
  const pHigher = higher.id === home.id ? pHome : pAway;
  const pLower = higher.id === home.id ? pAway : pHome;
  const petty = equal ? 0 : pettyCash(pHigher.ctv, pLower.ctv, pHigher.cost);
  const topUp = Math.max(0, pLower.cost - petty);
  const maxTopUp = Math.min(PETTY_CASH_TREASURY_TOP_UP, pLower.treasury);
  const problems: string[] = [];
  if (equal && (pHome.cost > 0 || pAway.cost > 0)) problems.push('equal');
  if (!equal && pHigher.cost > pHigher.treasury) problems.push('higher');
  if (!equal && topUp > maxTopUp) problems.push('lower');
  return { equal, higher, lower, pHigher, pLower, petty, topUp, maxTopUp, problems };
}
