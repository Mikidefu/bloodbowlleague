// Chi può scrivere cosa, e quando. Funzione pura: il server la chiama con lo stato appena ricalcolato
// dal registro, prima di aggiungere l'evento.
//
// La chiave anti-doppione (dedupe_key) è unica per partita nel database: due richieste identiche nello stesso
// momento (doppio tap, web e telefono insieme) ne producono una sola, anche se hanno UUID diversi.
//
// Ogni rifiuto ha un codice (LiveErrorCode): web e telefono lo traducono (src/lib/live/errors.ts),
// il messaggio inglese resta per i log e per chi chiama le API a mano.

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

export type LiveErrorCode =
  | 'invalid' | 'not_started' | 'match_ended' | 'match_played' | 'not_your_team' | 'admin_only' | 'not_found'
  | 'kickoff_first' | 'between_drives' | 'no_turn_yet' | 'not_your_turn' | 'no_turns_left' | 'half_over' | 'half_not_over'
  | 'not_active_team' | 'no_rerolls' | 'no_bribes' | 'kickoff_done' | 'kicking_team_only' | 'no_kicking_team'
  | 'extra_time_not_allowed' | 'already_undone' | 'cannot_undo' | 'wrong_half';

export class LiveRuleError extends Error {
  status: number;
  code: LiveErrorCode;
  params: Record<string, string | number>;
  constructor(message: string, status = 400, code: LiveErrorCode = 'invalid', params: Record<string, string | number> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.params = params;
  }
}

const CLIENT_TYPES: readonly string[] = [
  'turn_started', 'reroll_used', 'bribe_used', 'rerolls_adjusted', ...STAT_EVENTS, 'half_started', 'undo',
];
const TEAM_SCOPED: readonly string[] = ['turn_started', 'reroll_used', 'bribe_used', 'rerolls_adjusted', ...STAT_EVENTS];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const fail = (message: string, status = 400, code: LiveErrorCode = 'invalid', params: Record<string, string | number> = {}): never => {
  throw new LiveRuleError(message, status, code, params);
};
const isD6 = (v: unknown) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 6;

export const isEventId = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

// Il drive è in corso (dopo il kick-off): solo allora si segnano statistiche e si usano i reroll
function requireDrive(state: LiveState) {
  if (state.status === 'in_drive') return;
  if (state.drive === 0) fail('Roll the kick-off first: the drive has not started', 409, 'kickoff_first');
  fail('Between drives: roll the next kick-off first', 409, 'between_drives');
}

// Chi può tirare il kick-off: l'admin, o il telefono della squadra che calcia (p. 48)
export function canRollKickoff(state: LiveState, actor: LiveActor) {
  return actor.role === 'admin' || actor.teamId === state.kicking_team_id;
}

export function kickoffDedupeKey(state: LiveState) {
  if (state.status === 'ended') fail('The match has ended', 409, 'match_ended');
  if (state.status !== 'awaiting_kickoff') fail('The kick-off for this drive has already been rolled', 409, 'kickoff_done');
  if (!state.kicking_team_id) fail('No kicking team: start the extra time with the roll-off winner first', 409, 'no_kicking_team');
  // Chi riceverebbe ha già giocato i suoi 8 turni: il tempo è finito, niente nuovo drive (p. 82)
  if (state.turns_done) fail('No turns left in this half: start the next half', 409, 'half_over');
  return `kickoff:${state.phase_seq}`;
}

export function validateLiveEvent(state: LiveState, input: ClientEventInput, actor: LiveActor, events: LiveEvent[]): ValidatedEvent {
  if (!isEventId(input.id)) fail('Event id must be a UUID');
  const id = input.id as string;
  if (typeof input.type !== 'string' || !CLIENT_TYPES.includes(input.type)) fail('Unknown event type');
  const type = input.type as LiveEventType;
  const raw = input.payload && typeof input.payload === 'object' && !Array.isArray(input.payload) ? input.payload as Record<string, unknown> : {};
  if (state.status === 'not_started') fail('The live match has not started', 409, 'not_started');
  if (state.status === 'ended' && !(type === 'undo' && actor.role === 'admin')) fail('The match has ended', 409, 'match_ended');

  let teamId: string | null = null;
  if (TEAM_SCOPED.includes(type)) {
    teamId = typeof input.team_id === 'string' ? input.team_id : actor.role === 'companion' ? actor.teamId : null;
    if (!teamId || !state.teams[teamId]) fail('Unknown team');
    if (actor.role === 'companion' && actor.teamId !== teamId) fail('A companion can only record events for its own team', 403, 'not_your_team');
  }
  const team = teamId ? state.teams[teamId] : null;
  const phase = state.phase_seq;
  const payload: Record<string, unknown> = {};

  switch (type) {
    case 'turn_started': {
      requireDrive(state);
      if (team!.turn >= TURNS_PER_HALF) fail(`Every team has ${TURNS_PER_HALF} turns per half: start the next half`, 409, 'no_turns_left');
      // Alternanza (p. 50): dopo il kick-off gioca chi riceve, poi un turno a testa
      if (state.next_turn_team_id && state.next_turn_team_id !== teamId) {
        fail('It is the other team\'s turn', 409, 'not_your_turn', { team: state.next_turn_team_id });
      }
      payload.turn = team!.turn + 1;
      return { id, type, team_id: teamId, payload, dedupe_key: `turn:${teamId}:${phase}` };
    }
    case 'reroll_used': {
      requireDrive(state);
      // I Team Re-roll si usano solo nel proprio turno (p. 33). Prima del primo turno del drive
      // (azioni del kick-off come Charge!) non c'è ancora una squadra di turno: si lasciano passare.
      if (state.active_team_id && state.active_team_id !== teamId) {
        fail('Team Re-rolls can only be used during your own turn (p. 33)', 409, 'not_active_team', { team: state.active_team_id });
      }
      const kind = raw.kind ?? 'team';
      if (kind !== 'team' && kind !== 'drive' && kind !== 'mascot') fail('kind must be team, drive or mascot');
      const left = kind === 'drive' ? team!.drive_rerolls : kind === 'mascot' ? (team!.mascot ? 1 : 0) : team!.rerolls;
      if (left < 1) fail('No re-roll of this kind left', 409, 'no_rerolls');
      payload.kind = kind;
      if (kind === 'mascot') {
        if (!isD6(raw.roll)) fail('The Team Mascot re-roll needs its D6 (p. 144)');
        payload.roll = raw.roll;
      }
      return { id, type, team_id: teamId, payload, dedupe_key: `reroll:${teamId}:${kind}:${left}:${phase}` };
    }
    case 'bribe_used':
      // Anche tra un drive e l'altro (i Secret Weapon sono espulsi a fine drive, p. 83), ma non prima di iniziare
      if (state.drive === 0) fail('Roll the kick-off first: the drive has not started', 409, 'kickoff_first');
      if (team!.bribes < 1) fail('No Bribe left', 409, 'no_bribes');
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
      if (half !== state.half + 1 || (half as number) > EXTRA_TIME_HALF) fail(`The next half is ${state.half + 1}`, 409, 'wrong_half', { half: state.half + 1 });
      // Si cambia tempo quando i turni sono finiti; prima solo confermando (turni dimenticati, concessioni...)
      if (!state.turns_done && raw.force !== true) fail('The turns of this half are not over yet', 409, 'half_not_over');
      payload.half = half;
      if (raw.force === true && !state.turns_done) payload.forced = true;
      if (half === EXTRA_TIME_HALF) {
        const [home, away] = [state.home_team_id!, state.away_team_id!];
        if (!state.knockout) fail('Extra time is played only when a winner is needed (p. 83)', 409, 'extra_time_not_allowed');
        if (state.teams[home].score !== state.teams[away].score) fail('Extra time is played only after a draw (p. 83)', 409, 'extra_time_not_allowed');
        if (raw.kicking_team_id !== home && raw.kicking_team_id !== away) fail('Extra time needs the kicking team chosen after the roll-off (p. 83)');
        payload.kicking_team_id = raw.kicking_team_id;
      }
      return { id, type, team_id: null, payload, dedupe_key: `half:${half}:${phase}` };
    }
    case 'undo': {
      const target = events.find(e => e.id === raw.event_id);
      if (!target) fail('Event to undo not found', 404, 'not_found');
      if (state.voided.includes(target!.id)) fail('This event has already been undone', 409, 'already_undone');
      if (target!.type === 'undo' || target!.type === 'match_started') fail('This event cannot be undone', 409, 'cannot_undo');
      if (actor.role === 'companion') {
        if (target!.source === 'server' || target!.type === 'half_started') fail('Only the admin can undo this event', 403, 'admin_only');
        if (target!.team_id !== actor.teamId) fail('A companion can only undo its own team events', 403, 'not_your_team');
      }
      payload.event_id = target!.id;
      return { id, type, team_id: target!.team_id, payload, dedupe_key: `undo:${target!.id}` };
    }
  }

  // Statistiche: solo a drive in corso (anche durante il kick-off: Charge! può fare Casualty)
  requireDrive(state);
  // Un touchdown si segna durante un turno (anche quello avversario, p. 80): serve un turno iniziato
  if (type === 'touchdown' && !state.active_team_id) fail('Start the turn before recording a touchdown', 409, 'no_turn_yet');
  // Il giocatore è facoltativo (es. Casualty causata dal pubblico); chi lo verifica è il server
  if (raw.player_id !== undefined && raw.player_id !== null) {
    if (typeof raw.player_id !== 'string' || raw.player_id.length > 64) fail('Invalid player');
    payload.player_id = raw.player_id;
  }
  // Il touchdown è un evento di fase: web e telefono che lo segnano insieme ne registrano uno solo
  const dedupe = type === 'touchdown' ? `touchdown:${teamId}:${phase}` : null;
  return { id, type, team_id: teamId, payload, dedupe_key: dedupe };
}

// Perché un'azione adesso non si può fare (null = si può): le stesse regole del server,
// così web e telefono disattivano i tasti e spiegano il motivo prima ancora di provarci.
export function whyNot(state: LiveState, type: LiveEventType, teamId: string | null, actor: LiveActor, payload: Record<string, unknown> = {}) {
  try {
    validateLiveEvent(state, { id: '00000000-0000-4000-8000-000000000000', type, team_id: teamId ?? undefined, payload }, actor, []);
    return null;
  } catch (error) {
    if (error instanceof LiveRuleError) return { code: error.code, message: error.message, params: error.params };
    throw error;
  }
}
