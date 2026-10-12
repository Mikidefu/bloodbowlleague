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

type Opposed = { modifier: (setup: LiveTeamSetup) => number; label: string; lowestLoses: boolean; mascotRerollsOne?: boolean };

// Chi tira cosa nei risultati con tiro contrapposto (p. 48)
const OPPOSED: Record<number, Opposed> = {
  6: { modifier: s => s.cheerleaders, label: 'Cheerleaders', lowestLoses: false, mascotRerollsOne: true },   // Cheering Fans (+ Team Mascot, p. 144)
  7: { modifier: s => s.assistant_coaches, label: 'Assistant Coaches', lowestLoses: false },                 // Brilliant Coaching
  11: { modifier: () => 0, label: '', lowestLoses: true },                                                   // Dodgy Snack
  12: { modifier: s => s.fan_factor, label: 'Fan Factor', lowestLoses: true },                               // Pitch Invasion
};

const D3_RESULTS = [4, 9, 10, 12];   // Solid Defence, Quick Snap, Charge! (D3+3) e Pitch Invasion (D3)

// Gli altri dadi che un risultato del 2D6 fa tirare: chi inserisce i dadi a mano deve scriverli tutti
export type KickoffExtraDice = {
  opposed: { label: string; modifier: (setup: LiveTeamSetup) => number; mascotRerollsOne: boolean } | null;   // un D6 per squadra
  d3: boolean;
  weather: boolean;   // nuovo 2D6 del Meteo
};

export function kickoffExtraDice(total: number): KickoffExtraDice {
  const opposed = OPPOSED[total];
  return {
    opposed: opposed ? { label: opposed.label, modifier: opposed.modifier, mascotRerollsOne: !!opposed.mascotRerollsOne } : null,
    d3: D3_RESULTS.includes(total),
    weather: total === 8,
  };
}

// Il kick-off non lo tira mai il server: null solo se ci sono tutti i dadi che servono
export function manualDiceMissing(manual: ManualKickoffDice | undefined, teamIds: string[]): string | null {
  if (!manual?.dice) return 'Enter the two kick-off dice rolled at the table';
  const extra = kickoffExtraDice(manual.dice[0] + manual.dice[1]);
  if (extra.opposed && teamIds.some(id => manual.rolls?.[id] === undefined)) return 'Enter the D6 rolled by each coach';
  if (extra.d3 && manual.d3 === undefined) return 'Enter the D3';
  if (extra.weather && !manual.weather) return 'Enter the two Weather dice';
  return null;
}

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

// I tiri fatti dopo il 2D6, una riga ciascuno: chi ha tirato cosa e con quale modificatore
export function kickoffRolls(result: KickoffResult, teamName: (id: string) => string, language: 'it' | 'en' = 'it'): string[] {
  const it = language === 'it';
  const lines: string[] = [];
  const label = OPPOSED[result.total]?.label ?? '';
  for (const o of result.outcomes ?? []) {
    const modifier = o.total - o.roll;
    const mascot = o.rerolled ? (it ? ` (${o.rerolled} ritirato col Team Mascot)` : ` (${o.rerolled} re-rolled with the Team Mascot)`) : '';
    lines.push(`${teamName(o.team_id)}: D6 ${o.roll}${mascot}${label ? ` + ${modifier} ${label} = ${o.total}` : ''}`);
  }
  if (result.d3 && result.total === 12) lines.push(`D3 = ${result.d3}`);
  else if (result.d3) lines.push(`D3 ${result.d3} + 3 = ${result.d3 + 3} ${it ? 'giocatori' : 'players'}`);
  if (result.weather_roll) {
    const weather = rowForTotal(getMatchTable('weather')!, result.weather_roll);
    lines.push(`${it ? 'Meteo' : 'Weather'} 2D6 = ${result.weather_roll}${weather ? `: ${weather.name}` : ''}`);
    if (weather) lines.push(weather.text[language]);
  }
  return lines;
}

// Cosa vuol dire il kick-off per una squadra: un vantaggio, un guaio, qualcosa da fare subito, o solo una novità
export type KickoffForTeam = { tone: 'good' | 'bad' | 'act' | 'info'; text: string };

export function kickoffForTeam(result: KickoffResult, teamId: string, language: 'it' | 'en' = 'it'): KickoffForTeam | null {
  const L = (a: string, b: string) => (language === 'it' ? a : b);
  const won = !!result.winners?.includes(teamId);
  const kicking = result.kicking_team_id === teamId;
  const players = (result.d3 ?? 0) + 3;
  switch (result.total) {
    case 2: return { tone: 'good', text: L('Hai un Bribe gratis, da usare entro fine partita.', 'You get a free Bribe, to use before the end of the game.') };
    case 3: return { tone: 'info', text: result.turn_shift === -1
      ? L('Il tuo segnalino turno è già tornato indietro di uno: un turno in più da giocare.', 'Your turn marker has already moved back one: one more turn to play.')
      : L('Il tuo segnalino turno è già avanzato di uno: un turno in meno da giocare.', 'Your turn marker has already moved forward one: one less turn to play.') };
    case 4: return kicking ? { tone: 'act', text: L(`Puoi rischierare fino a ${players} tuoi giocatori Open.`, `You may set up again up to ${players} of your Open players.`) } : null;
    case 5: return kicking ? null : { tone: 'act', text: L('Puoi spostare un tuo giocatore Open nella casella dove atterra la palla.', 'You may move one of your Open players to the square where the ball will land.') };
    case 6: return won ? { tone: 'good', text: L('Hai un assist offensivo in più nel primo Block del tuo prossimo turno.', 'You get an extra Offensive Assist on the first Block of your next turn.') } : null;
    case 7: return won ? { tone: 'good', text: L('Hai un Team Re-roll in più per questo drive: lo trovi sotto, nel pannello dei Team Re-roll. Se non lo usi è perso.', 'You get an extra Team Re-roll for this drive: it is below, in the Team Re-roll panel. Lost if unused.') } : null;
    case 8: return { tone: 'info', text: L('Il Meteo sul tabellone è già quello nuovo.', 'The Weather on the scoreboard is already the new one.') };
    case 9: return kicking ? null : { tone: 'act', text: L(`Puoi spostare di una casella fino a ${players} tuoi giocatori Open.`, `You may move up to ${players} of your Open players one square.`) };
    case 10: return kicking ? { tone: 'act', text: L(`Puoi attivare fino a ${players} tuoi giocatori Open, uno alla volta.`, `You may activate up to ${players} of your Open players, one at a time.`) } : null;
    case 11: return won ? { tone: 'bad', text: L('Scegli a caso un tuo giocatore in campo e tira un D6: con 2+ ha -1 MA e -1 AV per il drive, con 1 va nelle riserve.', 'Randomly pick one of your players on the pitch and roll a D6: on 2+ they get -1 MA and -1 AV for the drive, on a 1 they go to the Reserves.') } : null;
    case 12: return won ? { tone: 'bad', text: L(`${result.d3} tuoi giocatori in campo, scelti a caso, finiscono Prone e Stunned.`, `${result.d3} of your players on the pitch, picked at random, are Placed Prone and Stunned.`) } : null;
    default: return null;
  }
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
