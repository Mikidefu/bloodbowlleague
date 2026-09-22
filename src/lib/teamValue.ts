// Team Value e Current Team Value (p. 91), con Low Cost Linemen (p. 155).
//   TV  = valore attuale dei giocatori + staff + Team Re-roll (a prezzo standard).
//         Dedicated Fans e Treasury NON contano.
//   CTV = TV - giocatori che saltano la prossima partita - giocatori Temporarily Retiring (p. 99).
//         Con Low Cost Linemen l'Hiring Fee dei Lineman conta 0 (gli aumenti di valore sì).
// Funzioni pure: usate sia dalle API sia dalle pagine.

import { STAFF_COSTS } from '@/lib/leagueRules';
import { getPosition, getRoster, hasRule, isLineman } from '@/lib/rosters';

type Flag = boolean | 0 | 1 | null | undefined;
const on = (value: Flag) => value === true || value === 1;

export type ValuedPlayer = {
  value: number;
  hiring_fee?: number | null;
  position_key?: string | null;
  mng?: Flag;
  dead?: Flag;
  left_team?: Flag;
  temp_retired?: Flag;
};

export type ValuedTeam = {
  roster?: string | null;
  rerolls?: number | null;
  reroll_cost?: number | null;
  assistant_coaches?: number | null;
  cheerleaders?: number | null;
  apothecary?: Flag;
};

// Giocatori ancora sulla Team Draft List (esclusi morti e chi ha lasciato la squadra)
export const onDraftList = (p: ValuedPlayer) => !on(p.dead) && !on(p.left_team);

export function staffValue(team: ValuedTeam) {
  const roster = getRoster(team.roster);
  const rerollCost = roster?.rerollCost ?? Number(team.reroll_cost || 0);
  return Number(team.rerolls || 0) * rerollCost
       + Number(team.assistant_coaches || 0) * STAFF_COSTS.assistantCoach
       + Number(team.cheerleaders || 0) * STAFF_COSTS.cheerleader
       + (on(team.apothecary) ? STAFF_COSTS.apothecary : 0);
}

export function computeTeamValue(team: ValuedTeam, players: ValuedPlayer[]) {
  const roster = getRoster(team.roster);
  const lowCostLinemen = hasRule(roster, 'Low Cost Linemen');
  const staff = staffValue(team);
  const listed = players.filter(onDraftList);

  const tv = staff + listed.reduce((sum, p) => sum + Number(p.value || 0), 0);

  const ctv = staff + listed
      .filter(p => !on(p.mng) && !on(p.temp_retired))
      .reduce((sum, p) => {
        const value = Number(p.value || 0);
        if (lowCostLinemen && isLineman(getPosition(roster, p.position_key))) {
          const fee = Number(p.hiring_fee ?? getPosition(roster, p.position_key)?.cost ?? 0);
          return sum + Math.max(0, value - fee);
        }
        return sum + value;
      }, 0);

  return { tv, ctv };
}
