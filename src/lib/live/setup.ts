// Fotografia di inizio partita: dai dati di squadra e dal pre-partita salvato ai valori che servono in campo.

import { isLeagueMatch, MATCH_TYPES } from '@/lib/matchTypes';
import type { DieRoller } from './kickoff';
import type { LiveStartPayload, LiveTeamSetup } from './types';

type Row = Record<string, unknown>;
type Choice = { key?: unknown; qty?: unknown };

const num = (v: unknown) => Number(v ?? 0) || 0;

function inducementQty(report: Row | undefined, key: string) {
  let choices: Choice[] = [];
  try { choices = report?.inducements ? JSON.parse(String(report.inducements)) : []; } catch { choices = []; }
  return Array.isArray(choices) ? choices.filter(c => c?.key === key).reduce((sum, c) => sum + num(c.qty), 0) : 0;
}

export function teamSetup(team: Row, report: Row | undefined): LiveTeamSetup {
  return {
    rerolls: num(team.rerolls) + inducementQty(report, 'extra_team_training'),                      // p. 145
    mascot: inducementQty(report, 'team_mascot') > 0,                                              // p. 144
    master_chef: inducementQty(report, 'halfling_master_chef') > 0,                                // p. 146
    assistant_coaches: num(team.assistant_coaches) + inducementQty(report, 'part_time_assistant_coaches'),
    cheerleaders: num(team.cheerleaders) + inducementQty(report, 'temp_agency_cheerleaders'),
    // Fan Factor di partita del pre-partita (p. 44); senza pre-partita resta quello dei Dedicated Fans
    fan_factor: report?.fan_factor !== null && report?.fan_factor !== undefined ? num(report.fan_factor) : num(team.fan_factor),
    bribes: inducementQty(report, 'bribes'),
  };
}

export function liveStartPayload(match: Row, teams: Map<string, Row>, reports: Map<string, Row>): LiveStartPayload {
  const home = String(match.home_team_id);
  const away = String(match.away_team_id);
  return {
    home_team_id: home,
    away_team_id: away,
    kicking_team_id: String(match.kicking_team_id),
    // Supplementari e rigori solo dove serve un vincitore: playoff, semifinali, finali (p. 83)
    knockout: match.match_type !== MATCH_TYPES.friendly && !isLeagueMatch(match.match_type),
    teams: Object.fromEntries([home, away].map(id => [id, teamSetup(teams.get(id) ?? {}, reports.get(id))])),
  };
}

// Halfling Master Chef (p. 146): a inizio tempo, prima del kick-off, 3D6; ogni 4+ ruba un Team Re-roll per il tempo.
// Nei supplementari i Team Re-roll non si ricaricano (p. 83), quindi lo Chef lavora solo nei due tempi regolamentari.
export function chefRolls(setup: LiveStartPayload, half: number, roll: DieRoller) {
  if (half > 2) return [];
  return [setup.home_team_id, setup.away_team_id]
    .filter(id => setup.teams[id]?.master_chef)
    .map(id => {
      const dice = [roll(6), roll(6), roll(6)];
      return { team_id: id, payload: { half, dice, stolen: dice.filter(d => d >= 4).length } };
    });
}
