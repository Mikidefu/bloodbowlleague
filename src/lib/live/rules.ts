// Chi può scrivere cosa, e quando. Funzione pura: il server la chiama con lo stato appena ricalcolato
// dal registro, prima di aggiungere l'evento.
//
// La chiave anti-doppione (dedupe_key) è unica per partita nel database: due richieste identiche nello stesso
// momento (doppio tap, web e telefono insieme) ne producono una sola, anche se hanno UUID diversi.

import { EXTRA_TIME_HALF, STAT_EVENTS, TURNS_PER_HALF, type LiveEvent, type LiveEventType, type LiveState } from './types';

export type LiveActor = { role: 'admin' } | { role: 'companion'; teamId: string };

export type ClientEventInput = { id: unknown; type: unknown; team_id?: unknown; payload?: unknown };

export type ValidatedEvent = {
  id: string;
  type: LiveEventType;
  team_id: string | null;
  payload: Record<string, unknown>;
  dedupe_key: string | null;
};

export class LiveRuleError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const CLIENT_TYPES: readonly string[] = [
  'turn_started', 'reroll_used', 'bribe_used', 'rerolls_adjusted', ...STAT_EVENTS, 'half_started', 'undo',
];
const TEAM_SCOPED: readonly string[] = ['turn_started', 'reroll_used', 'bribe_used', 'rerolls_adjusted', ...STAT_EVENTS];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const fail = (message: string, status = 400): never => { throw new LiveRuleError(message, status); };
const isD6 = (v: unknown) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 6;

export const isEventId = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

// Chi può tirare il kick-off: l'admin, o il telefono della squadra che calcia (p. 48)
export function canRollKickoff(state: LiveState, actor: LiveActor) {
  return actor.role === 'admin' || actor.teamId === state.kicking_team_id;
}

export function kickoffDedupeKey(state: LiveState) {
  if (state.status === 'ended') fail('The match has ended', 409);
  if (state.status !== 'awaiting_kickoff') fail('The kick-off for this drive has already been rolled', 409);
  if (!state.kicking_team_id) fail('No kicking team: start the extra time with the roll-off winner first', 409);
  return `kickoff:${state.phase_seq}`;
}

export function validateLiveEvent(state: LiveState, input: ClientEventInput, actor: LiveActor, events: LiveEvent[]): ValidatedEvent {
  if (!isEventId(input.id)) fail('Event id must be a UUID');
  const id = input.id as string;
  if (typeof input.type !== 'string' || !CLIENT_TYPES.includes(input.type)) fail('Unknown event type');
  const type = input.type as LiveEventType;
  const raw = input.payload && typeof input.payload === 'object' && !Array.isArray(input.payload) ? input.payload as Record<string, unknown> : {};
  if (state.status === 'not_started') fail('The live match has not started', 409);
  if (state.status === 'ended' && !(type === 'undo' && actor.role === 'admin')) fail('The match has ended', 409);

  let teamId: string | null = null;
  if (TEAM_SCOPED.includes(type)) {
    teamId = typeof input.team_id === 'string' ? input.team_id : actor.role === 'companion' ? actor.teamId : null;
    if (!teamId || !state.teams[teamId]) fail('Unknown team');
    if (actor.role === 'companion' && actor.teamId !== teamId) fail('A companion can only record events for its own team', 403);
  }
  const team = teamId ? state.teams[teamId] : null;
  const phase = state.phase_seq;
  const payload: Record<string, unknown> = {};

  switch (type) {
    case 'turn_started': {
      if (state.status !== 'in_drive') fail('Roll the kick-off before starting a turn', 409);
      if (team!.turn >= TURNS_PER_HALF) fail(`Both halves have ${TURNS_PER_HALF} turns: start the next half`, 409);
      payload.turn = team!.turn + 1;
      return { id, type, team_id: teamId, payload, dedupe_key: `turn:${teamId}:${phase}` };
    }
    case 'reroll_used': {
      const kind = raw.kind ?? 'team';
      if (kind !== 'team' && kind !== 'drive' && kind !== 'mascot') fail('kind must be team, drive or mascot');
      const left = kind === 'drive' ? team!.drive_rerolls : kind === 'mascot' ? (team!.mascot ? 1 : 0) : team!.rerolls;
      if (left < 1) fail('No re-roll of this kind left', 409);
      payload.kind = kind;
      if (kind === 'mascot') {
        if (!isD6(raw.roll)) fail('The Team Mascot re-roll needs its D6 (p. 144)');
        payload.roll = raw.roll;
      }
      return { id, type, team_id: teamId, payload, dedupe_key: `reroll:${teamId}:${kind}:${left}:${phase}` };
    }
    case 'bribe_used':
      if (team!.bribes < 1) fail('No Bribe left', 409);
      return { id, type, team_id: teamId, payload, dedupe_key: `bribe:${teamId}:${team!.bribes}:${phase}` };
    case 'rerolls_adjusted': {
      const delta = raw.delta;
      if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta as number) > 9) fail('delta must be a whole number between -9 and 9');
      payload.delta = delta;
      if (typeof raw.reason === 'string' && raw.reason.trim()) payload.reason = raw.reason.trim().slice(0, 100);
      return { id, type, team_id: teamId, payload, dedupe_key: null };
    }
    case 'half_started': {
      const half = raw.half;
      if (half !== state.half + 1 || (half as number) > EXTRA_TIME_HALF) fail(`The next half is ${state.half + 1}`, 409);
      payload.half = half;
      if (half === EXTRA_TIME_HALF) {
        const [home, away] = [state.home_team_id!, state.away_team_id!];
        if (!state.knockout) fail('Extra time is played only when a winner is needed (p. 83)', 409);
        if (state.teams[home].score !== state.teams[away].score) fail('Extra time is played only after a draw (p. 83)', 409);
        if (raw.kicking_team_id !== home && raw.kicking_team_id !== away) fail('Extra time needs the kicking team chosen after the roll-off (p. 83)');
        payload.kicking_team_id = raw.kicking_team_id;
      }
      return { id, type, team_id: null, payload, dedupe_key: `half:${half}:${phase}` };
    }
    case 'undo': {
      const target = events.find(e => e.id === raw.event_id);
      if (!target) fail('Event to undo not found', 404);
      if (state.voided.includes(target!.id)) fail('This event has already been undone', 409);
      if (target!.type === 'undo' || target!.type === 'match_started') fail('This event cannot be undone', 409);
      if (actor.role === 'companion') {
        if (target!.source === 'server' || target!.type === 'half_started') fail('Only the admin can undo this event', 403);
        if (target!.team_id !== actor.teamId) fail('A companion can only undo its own team events', 403);
      }
      payload.event_id = target!.id;
      return { id, type, team_id: target!.team_id, payload, dedupe_key: `undo:${target!.id}` };
    }
  }

  // Statistiche: il giocatore è facoltativo (es. Casualty causata dal pubblico); chi lo verifica è il server
  if (raw.player_id !== undefined && raw.player_id !== null) {
    if (typeof raw.player_id !== 'string' || raw.player_id.length > 64) fail('Invalid player');
    payload.player_id = raw.player_id;
  }
  // Il touchdown è un evento di fase: web e telefono che lo segnano insieme ne registrano uno solo
  const dedupe = type === 'touchdown' ? `touchdown:${teamId}:${phase}` : null;
  return { id, type, team_id: teamId, payload, dedupe_key: dedupe };
}
