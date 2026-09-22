// Team Value e Current Team Value (p. 91), con Low Cost Linemen (p. 155).
//   TV  = valore attuale dei giocatori + staff + Team Re-roll (a prezzo standard).
//         Dedicated Fans e Treasury NON contano.
//   CTV = TV - giocatori che saltano la prossima partita - giocatori Temporarily Retiring (p. 99).
//         Con Low Cost Linemen l'Hiring Fee dei Lineman conta 0 (gli aumenti di valore sì).
// Funzioni pure: usate sia dalle API sia dalle pagine.

import { STAFF_COSTS } from '@/lib/leagueRules';
import { flag, onDraftList, type PlayerFlags } from '@/lib/players';
import { getPosition, getRoster, hasRule, isLineman } from '@/lib/rosters';

// Qui arrivano sia oggetti Player sia righe del database: i campi servono solo per un conto,
// quindi si accettano come unknown e si normalizzano (le righe di SQLite non sono tipizzate).
export type ValuedPlayer = PlayerFlags & {
  value?: unknown;
  hiring_fee?: unknown;
  position_key?: unknown;
};

export type ValuedTeam = {
  roster?: unknown;
  rerolls?: unknown;
  reroll_cost?: unknown;
  assistant_coaches?: unknown;
  cheerleaders?: unknown;
  apothecary?: unknown;
  [column: string]: unknown;
};

export function staffValue(team: ValuedTeam) {
  const roster = getRoster(rosterKey(team));
  const rerollCost = roster?.rerollCost ?? Number(team.reroll_cost || 0);
  return Number(team.rerolls || 0) * rerollCost
       + Number(team.assistant_coaches || 0) * STAFF_COSTS.assistantCoach
       + Number(team.cheerleaders || 0) * STAFF_COSTS.cheerleader
       + (flag(team.apothecary) ? STAFF_COSTS.apothecary : 0);
}

export function computeTeamValue(team: ValuedTeam, players: ValuedPlayer[]) {
  const roster = getRoster(rosterKey(team));
  const lowCostLinemen = hasRule(roster, 'Low Cost Linemen');
  const staff = staffValue(team);
  const listed = players.filter(onDraftList);

  const tv = staff + listed.reduce((sum, p) => sum + Number(p.value || 0), 0);

  const ctv = staff + listed
      .filter(p => !flag(p.mng) && !flag(p.temp_retired))
      .reduce((sum, p) => {
        const value = Number(p.value || 0);
        const position = getPosition(roster, positionKey(p));
        if (lowCostLinemen && isLineman(position)) {
          const fee = Number(p.hiring_fee ?? position?.cost ?? 0);
          return sum + Math.max(0, value - fee);
        }
        return sum + value;
      }, 0);

  return { tv, ctv };
}

const rosterKey = (team: ValuedTeam) => (team.roster === null || team.roster === undefined ? null : String(team.roster));
const positionKey = (player: ValuedPlayer) =>
  player.position_key === null || player.position_key === undefined ? null : String(player.position_key);
