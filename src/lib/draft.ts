// Draft di una nuova squadra (pp. 88-91, 154-155), condiviso tra il form e l'API.
// Budget: DRAFT_BUDGET (regola della casa, vedi leagueRules.ts).

import { DRAFT_BUDGET, LIMITS, STAFF_COSTS } from '@/lib/leagueRules';
import { favouredOptions, getPosition, getRoster, hasRule } from '@/lib/rosters';

export type DraftPlayer = { position_key: string; name: string; jersey_number?: number | null };

export type DraftInput = {
  roster: string;
  team_league: string | null;
  favoured_of: string | null;
  rerolls: number;
  assistant_coaches: number;
  cheerleaders: number;
  apothecary: boolean;
  dedicated_fans: number;
  players: DraftPlayer[];
  captain_index: number | null;
};

export type DraftCheck = {
  total: number;
  playersCost: number;
  staffCost: number;
  remaining: number;
  errors: string[];
};

const isInt = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

export function checkDraft(input: DraftInput): DraftCheck {
  const errors: string[] = [];
  const roster = getRoster(input.roster);
  if (!roster) return { total: 0, playersCost: 0, staffCost: 0, remaining: DRAFT_BUDGET, errors: ['Choose a Team Roster'] };

  if (!input.team_league || !roster.leagues.includes(input.team_league as never)) errors.push('Choose the League the team plays in (p. 159)');
  const favoured = favouredOptions(roster, input.team_league);
  if (favoured.length > 0 && !favoured.includes(input.favoured_of ?? '')) errors.push('Choose the Favoured of alignment (p. 154)');

  const players = Array.isArray(input.players) ? input.players : [];
  if (players.length < LIMITS.minPlayers) errors.push(`At least ${LIMITS.minPlayers} players (p. 89)`);
  if (players.length > LIMITS.maxPlayers) errors.push(`At most ${LIMITS.maxPlayers} players (p. 89)`);

  let playersCost = 0;
  const counts = new Map<string, number>();
  players.forEach((pl, index) => {
    const position = getPosition(roster, pl?.position_key);
    if (!position) { errors.push(`Player ${index + 1}: unknown position`); return; }
    if (!String(pl.name ?? '').trim()) errors.push(`Player ${index + 1}: name required`);
    counts.set(position.key, (counts.get(position.key) ?? 0) + 1);
    playersCost += position.cost;
  });
  for (const [key, count] of counts) {
    const position = getPosition(roster, key)!;
    if (count > position.max) errors.push(`${position.name}: at most ${position.max}`);
  }
  for (const group of roster.groups ?? []) {
    const count = group.positions.reduce((sum, key) => sum + (counts.get(key) ?? 0), 0);
    if (count > group.max) errors.push(`${group.label}: at most ${group.max} chosen from ${group.positions.map(k => getPosition(roster, k)?.name).join(', ')}`);
  }

  if (!isInt(input.rerolls, 0, LIMITS.maxRerolls)) errors.push(`Team Re-rolls: 0-${LIMITS.maxRerolls} (p. 90)`);
  if (!isInt(input.assistant_coaches, 0, LIMITS.maxAssistantCoaches)) errors.push(`Assistant Coaches: 0-${LIMITS.maxAssistantCoaches} (p. 90)`);
  if (!isInt(input.cheerleaders, 0, LIMITS.maxCheerleaders)) errors.push(`Cheerleaders: 0-${LIMITS.maxCheerleaders} (p. 90)`);
  if (input.apothecary && !roster.apothecary) errors.push(`${roster.name} teams cannot hire an Apothecary`);
  if (!isInt(input.dedicated_fans, LIMITS.dedicatedFansStart, LIMITS.dedicatedFansDraftMax)) errors.push(`Dedicated Fans: ${LIMITS.dedicatedFansStart}-${LIMITS.dedicatedFansDraftMax} when drafting (p. 91)`);

  if (input.captain_index !== null && input.captain_index !== undefined) {
    if (!hasRule(roster, 'Team Captain')) errors.push('Only teams with the Team Captain special rule can nominate a captain');
    const captain = players[input.captain_index];
    const position = getPosition(roster, captain?.position_key);
    if (!position) errors.push('Team Captain: choose a player');
    else if (position.keywords.includes('Big Guy')) errors.push('The Team Captain cannot be a Big Guy (p. 155)');
  }

  const staffCost = (Number(input.rerolls) || 0) * roster.rerollCost
      + (Number(input.assistant_coaches) || 0) * STAFF_COSTS.assistantCoach
      + (Number(input.cheerleaders) || 0) * STAFF_COSTS.cheerleader
      + (input.apothecary ? STAFF_COSTS.apothecary : 0)
      + Math.max(0, (Number(input.dedicated_fans) || 1) - LIMITS.dedicatedFansStart) * STAFF_COSTS.dedicatedFan;
  const total = playersCost + staffCost;
  if (total > DRAFT_BUDGET) errors.push(`Over budget: ${total.toLocaleString('en')} of ${DRAFT_BUDGET.toLocaleString('en')} gp`);

  return { total, playersCost, staffCost, remaining: DRAFT_BUDGET - total, errors };
}
