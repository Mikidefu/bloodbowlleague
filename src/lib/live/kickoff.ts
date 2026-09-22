// Kick-off Event (p. 48) risolto per intero: il 2D6 e, dove serve, i tiri contrapposti dei due allenatori.
// Funzione pura: i dadi arrivano da fuori (crypto sul server, valori fissi nei test, dadi fisici se li inserisce chi gioca).

import { getMatchTable, rollDie, rowForTotal } from '@/lib/matchTables';
import type { KickoffOutcome, KickoffResult, LiveTeamSetup } from './types';

export type DieRoller = (sides: number) => number;

// Dadi tirati al tavolo e inseriti a mano: sostituiscono quelli del server
export type ManualKickoffDice = {
  dice?: [number, number];
  rolls?: Record<string, number>;   // D6 di ciascuna squadra nei tiri contrapposti
  d3?: number;
  weather?: [number, number];
};

export type KickoffInput = {
  drive: number;
  kickingTeamId: string;
  receivingTeamId: string;
  kickingTurn: number;              // segnalino turno della squadra che calcia (Time-out)
  teams: Record<string, LiveTeamSetup>;
  manual?: ManualKickoffDice;
};

const isD6 = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 6;

export function validateManualDice(manual: ManualKickoffDice | undefined, teamIds: string[]): string | null {
  if (!manual) return null;
  if (manual.dice !== undefined && !(Array.isArray(manual.dice) && manual.dice.length === 2 && manual.dice.every(isD6))) return 'dice must be two D6 values';
  if (manual.weather !== undefined && !(Array.isArray(manual.weather) && manual.weather.length === 2 && manual.weather.every(isD6))) return 'weather must be two D6 values';
  if (manual.d3 !== undefined && !(Number.isInteger(manual.d3) && manual.d3 >= 1 && manual.d3 <= 3)) return 'd3 must be 1-3';
  for (const [team, roll] of Object.entries(manual.rolls ?? {})) {
    if (!teamIds.includes(team)) return 'rolls refer to an unknown team';
    if (!isD6(roll)) return 'rolls must be D6 values';
  }
  return null;
}

type Opposed = { modifier: (setup: LiveTeamSetup) => number; lowestLoses: boolean; mascotRerollsOne?: boolean };

// Chi tira cosa nei risultati con tiro contrapposto (p. 48)
const OPPOSED: Record<number, Opposed> = {
  6: { modifier: s => s.cheerleaders, lowestLoses: false, mascotRerollsOne: true },   // Cheering Fans (+ Team Mascot, p. 144)
  7: { modifier: s => s.assistant_coaches, lowestLoses: false },                      // Brilliant Coaching
  11: { modifier: () => 0, lowestLoses: true },                                       // Dodgy Snack
  12: { modifier: s => s.fan_factor, lowestLoses: true },                             // Pitch Invasion
};

const D3_RESULTS = [4, 9, 10, 12];   // Solid Defence, Quick Snap, Charge! (D3+3) e Pitch Invasion (D3)

export function resolveKickoff(input: KickoffInput, roll: DieRoller = rollDie): KickoffResult {
  const { manual } = input;
  const dice: [number, number] = manual?.dice ?? [roll(6), roll(6)];
  const total = dice[0] + dice[1];
  const table = getMatchTable('kickoff')!;
  const row = rowForTotal(table, total)!;
  const result: KickoffResult = { drive: input.drive, kicking_team_id: input.kickingTeamId, dice, total, name: row.name };
  const order = [input.kickingTeamId, input.receivingTeamId];

  if (total === 2) result.winners = order;   // Get the Ref: un Bribe a entrambe

  // Time-out: con la squadra che calcia al turno 6, 7 o 8 i segnalini arretrano, altrimenti avanzano
  if (total === 3) result.turn_shift = input.kickingTurn >= 6 ? -1 : 1;

  const opposed = OPPOSED[total];
  if (opposed) {
    const outcomes: KickoffOutcome[] = order.map(teamId => {
      const setup = input.teams[teamId];
      const manualRoll = manual?.rolls?.[teamId];
      const first = manualRoll ?? roll(6);
      const outcome: KickoffOutcome = { team_id: teamId, roll: first, total: 0 };
      // Il natural 1 si ritira col Team Mascot; se il dado l'ha tirato a mano l'allenatore, l'ha già fatto al tavolo
      if (opposed.mascotRerollsOne && setup.mascot && first === 1 && manualRoll === undefined) {
        outcome.rerolled = first;
        outcome.roll = roll(6);
      }
      outcome.total = outcome.roll + opposed.modifier(setup);
      return outcome;
    });
    const best = opposed.lowestLoses ? Math.min(...outcomes.map(o => o.total)) : Math.max(...outcomes.map(o => o.total));
    result.outcomes = outcomes;
    result.winners = outcomes.filter(o => o.total === best).map(o => o.team_id);   // parità: entrambe
  }

  if (D3_RESULTS.includes(total)) result.d3 = manual?.d3 ?? Math.ceil(roll(6) / 2);
  if (total === 8) {
    const weather = manual?.weather ?? [roll(6), roll(6)];
    result.weather_roll = weather[0] + weather[1];
  }
  return result;
}

// Frase breve per notifiche e cronologia: chi ha ottenuto cosa
export function kickoffHeadline(result: KickoffResult, teamName: (id: string) => string, language: 'it' | 'en' = 'it'): string {
  const it = language === 'it';
  const who = (ids: string[] = []) => ids.map(teamName).join(it ? ' e ' : ' and ');
  switch (result.total) {
    case 2: return it ? 'Get the Ref: un Bribe gratis a entrambe le squadre' : 'Get the Ref: a free Bribe for both teams';
    case 3: return it
      ? `Time-out: i segnalini turno ${result.turn_shift === -1 ? 'arretrano' : 'avanzano'} di uno`
      : `Time-out: both turn markers move ${result.turn_shift === -1 ? 'back' : 'forward'} one space`;
    case 6: return it ? `Cheering Fans: un assist offensivo in più per ${who(result.winners)}` : `Cheering Fans: an extra Offensive Assist for ${who(result.winners)}`;
    case 7: return it ? `Brilliant Coaching: un Team Re-roll per questo drive a ${who(result.winners)}` : `Brilliant Coaching: a Team Re-roll for this drive to ${who(result.winners)}`;
    case 8: return it ? `Changing Weather: nuovo Meteo (${result.weather_roll})` : `Changing Weather: new Weather (${result.weather_roll})`;
    case 11: return it ? `Dodgy Snack: tocca a ${who(result.winners)}` : `Dodgy Snack: ${who(result.winners)} is hit`;
    case 12: return it ? `Pitch Invasion: ${result.d3} giocatori Stunned per ${who(result.winners)}` : `Pitch Invasion: ${result.d3} players Stunned for ${who(result.winners)}`;
    default: return result.d3 ? `${result.name}: ${result.d3 + 3} ${it ? 'giocatori' : 'players'}` : result.name;
  }
}
