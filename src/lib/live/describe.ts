// Un evento del registro raccontato in una riga, per la cronologia del web e le notifiche del companion.

import { kickoffHeadline } from './kickoff';
import type { KickoffResult, LiveEvent } from './types';

export type DescribeContext = {
  language: 'it' | 'en';
  teamName: (id: string | null) => string;
  playerName: (id: string) => string | null;
  events: LiveEvent[];            // per raccontare cosa annulla un 'undo'
};

const STAT_LABEL: Record<string, { it: string; en: string }> = {
  touchdown: { it: 'Touchdown', en: 'Touchdown' },
  casualty: { it: 'Casualty', en: 'Casualty' },
  completion: { it: 'Passaggio riuscito', en: 'Completion' },
  interception: { it: 'Intercetto', en: 'Interception' },
  ttm: { it: 'Lancio del compagno', en: 'Throw Team-mate' },
  landing: { it: 'Atterraggio', en: 'Landing' },
};

export function describeEvent(event: LiveEvent, ctx: DescribeContext): string {
  const it = ctx.language === 'it';
  const L = (a: string, b: string) => (it ? a : b);
  const team = ctx.teamName(event.team_id);
  const p = event.payload;

  switch (event.type) {
    case 'match_started': return L('Partita avviata dal vivo', 'Live match started');
    case 'match_ended': return L('Partita chiusa', 'Match closed');
    case 'half_started':
      return p.half === 3
        ? L(`Supplementari: calcia ${ctx.teamName(String(p.kicking_team_id))}`, `Extra time: ${ctx.teamName(String(p.kicking_team_id))} kicks`)
        : L('Inizia il secondo tempo', 'Second half starts');
    case 'chef_rolled': {
      const dice = Array.isArray(p.dice) ? p.dice.join(', ') : '';
      return L(`Halfling Master Chef di ${team} (${dice}): ${p.stolen} reroll rubati`, `${team}'s Halfling Master Chef (${dice}): ${p.stolen} re-rolls stolen`);
    }
    case 'kickoff_rolled': {
      const k = p as unknown as KickoffResult;
      return `Kick-off, drive ${k.drive} (${k.dice?.join('+')}): ${kickoffHeadline(k, id => ctx.teamName(id), ctx.language)}`;
    }
    case 'turn_started': return L(`${team}: turno ${p.turn}`, `${team}: turn ${p.turn}`);
    case 'reroll_used':
      if (p.kind === 'drive') return L(`${team} usa il reroll di Brilliant Coaching`, `${team} uses the Brilliant Coaching re-roll`);
      if (p.kind === 'mascot') {
        const ok = Number(p.roll) >= 4;
        return L(`${team}: Team Mascot (${p.roll}) ${ok ? 'reroll usato' : 'reroll perso'}`, `${team}: Team Mascot (${p.roll}) ${ok ? 're-roll used' : 're-roll lost'}`);
      }
      return L(`${team} usa un Team Re-roll`, `${team} uses a Team Re-roll`);
    case 'bribe_used': return L(`${team} usa un Bribe`, `${team} uses a Bribe`);
    case 'rerolls_adjusted': {
      const delta = Number(p.delta);
      const reason = typeof p.reason === 'string' ? ` (${p.reason})` : '';
      return L(`${team}: Team Re-roll ${delta > 0 ? '+' : ''}${delta}${reason}`, `${team}: Team Re-rolls ${delta > 0 ? '+' : ''}${delta}${reason}`);
    }
    case 'undo': {
      const target = ctx.events.find(e => e.id === p.event_id);
      const what = target ? describeEvent(target, ctx) : L('evento', 'event');
      return L(`Annullato: ${what}`, `Undone: ${what}`);
    }
  }
  const label = STAT_LABEL[event.type];
  if (label) {
    const player = typeof p.player_id === 'string' ? ctx.playerName(p.player_id) : null;
    return `${label[ctx.language]}: ${player ?? L('senza giocatore', 'no player')} (${team})`;
  }
  return event.type;
}
