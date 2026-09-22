// Stato del tabellone ricalcolato dal registro eventi. Funzione pura e tollerante:
// gli eventi li valida il server quando li scrive (validateLiveEvent), qui un evento incoerente
// viene ignorato o limitato, così rigiocare il registro non si blocca mai.

import {
  EXTRA_TIME_HALF, STAT_COLUMN, STAT_EVENTS, TURNS_PER_HALF,
  type KickoffResult, type LiveEvent, type LiveStartPayload, type LiveState, type LiveTeamState, type StatEvent,
} from './types';

// Eventi che cambiano la fase della partita: dopo ognuno cambiano le chiavi anti-doppione
const PHASE_EVENTS = new Set(['match_started', 'kickoff_rolled', 'touchdown', 'half_started', 'turn_started', 'match_ended']);

const str = (v: unknown) => (typeof v === 'string' ? v : null);
const int = (v: unknown, fallback = 0) => (Number.isInteger(v) ? (v as number) : fallback);

export function emptyLiveState(): LiveState {
  return {
    status: 'not_started', half: 0, drive: 0, kicking_team_id: null, first_half_receiver_id: null, weather_roll: null,
    knockout: false, home_team_id: null, away_team_id: null, teams: {}, last_kickoff: null, seq: 0, phase_seq: 0, voided: [], setup: null,
  };
}

const other = (state: LiveState, teamId: string | null) =>
  teamId === state.home_team_id ? state.away_team_id : teamId === state.away_team_id ? state.home_team_id : null;

// Fine drive (p. 82): il reroll di Brilliant Coaching si perde, così come l'assist di Cheering Fans non usato
function endDrive(state: LiveState) {
  for (const team of Object.values(state.teams)) {
    team.drive_rerolls = 0;
    team.cheering_fans = false;
  }
  state.status = 'awaiting_kickoff';
}

function startHalf(state: LiveState, half: number, kickingTeamId: string | null) {
  const setup = state.setup!;
  endDrive(state);
  state.half = half;
  state.kicking_team_id = kickingTeamId;
  for (const [id, team] of Object.entries(state.teams)) {
    team.turn = 0;
    // I Team Re-roll tornano pieni all'intervallo (p. 33); nei supplementari no, restano quelli non usati (p. 83)
    if (half <= 2) {
      team.rerolls = setup.teams[id].rerolls;
      team.mascot = setup.teams[id].mascot;
    }
  }
}

function applyKickoff(state: LiveState, event: LiveEvent) {
  const k = event.payload as unknown as KickoffResult;
  const kicking = str(k.kicking_team_id) ?? state.kicking_team_id;
  // Nuovo drive: quello che restava del drive precedente (se finito per fine tempo) è già scaduto
  endDrive(state);
  state.drive += 1;
  state.status = 'in_drive';
  state.kicking_team_id = kicking;
  if (state.half === 1 && state.drive === 1 && !state.first_half_receiver_id) state.first_half_receiver_id = other(state, kicking);
  state.last_kickoff = { ...k, event_id: event.id };
  const winners = (Array.isArray(k.winners) ? k.winners : []).filter(id => state.teams[id]);
  switch (k.total) {
    case 2: winners.forEach(id => { state.teams[id].bribes += 1; }); break;
    case 3: {
      const shift = k.turn_shift === -1 ? -1 : 1;
      for (const team of Object.values(state.teams)) team.turn = Math.min(TURNS_PER_HALF, Math.max(0, team.turn + shift));
      break;
    }
    case 6: winners.forEach(id => { state.teams[id].cheering_fans = true; }); break;
    case 7: winners.forEach(id => { state.teams[id].drive_rerolls += 1; }); break;
    case 8: if (int(k.weather_roll, 0) >= 2) state.weather_roll = k.weather_roll!; break;
  }
}

function applyStat(team: LiveTeamState, type: StatEvent, playerId: string | null) {
  const column = STAT_COLUMN[type];
  const bucket = playerId ? (team.stats[playerId] ??= {}) : team.team_stats;
  bucket[column] = (bucket[column] ?? 0) + 1;
}

function applyEvent(state: LiveState, event: LiveEvent) {
  const p = event.payload;
  const team = event.team_id ? state.teams[event.team_id] : undefined;

  if (event.type === 'match_started') {
    const setup = p as unknown as LiveStartPayload;
    state.setup = setup;
    state.knockout = !!setup.knockout;
    state.home_team_id = setup.home_team_id;
    state.away_team_id = setup.away_team_id;
    state.teams = {};
    for (const [id, s] of Object.entries(setup.teams)) {
      state.teams[id] = {
        score: 0, turn: 0, rerolls: s.rerolls, drive_rerolls: 0, mascot: s.mascot, bribes: s.bribes,
        cheering_fans: false, stats: {}, team_stats: {},
      };
    }
    startHalf(state, 1, setup.kicking_team_id);
    return;
  }
  if (!state.setup) return;   // nessun evento ha senso prima dell'avvio

  switch (event.type) {
    case 'half_started': {
      const half = int(p.half);
      if (half !== state.half + 1 || half > EXTRA_TIME_HALF) return;
      // Secondo tempo: calcia chi ha ricevuto all'inizio del primo (p. 50). Supplementari: dopo il roll-off (p. 83)
      const kicking = half === 2 ? state.first_half_receiver_id ?? other(state, state.setup.kicking_team_id) : str(p.kicking_team_id);
      startHalf(state, half, kicking);
      return;
    }
    case 'chef_rolled': {
      // Halfling Master Chef (p. 146): +1 Team Re-roll per ogni 4+, e l'avversario ne perde altrettanti (non sotto zero)
      if (!team) return;
      const stolen = Math.max(0, int(p.stolen));
      team.rerolls += stolen;
      const opp = state.teams[other(state, event.team_id) ?? ''];
      if (opp) opp.rerolls = Math.max(0, opp.rerolls - stolen);
      return;
    }
    case 'kickoff_rolled': applyKickoff(state, event); return;
    case 'turn_started':
      if (team) team.turn = Math.min(TURNS_PER_HALF, Math.max(1, int(p.turn, team.turn + 1)));
      return;
    case 'reroll_used':
      if (!team) return;
      if (p.kind === 'drive') team.drive_rerolls = Math.max(0, team.drive_rerolls - 1);
      else if (p.kind === 'mascot') team.mascot = false;   // usato con 4+ o perso con 1-3: in entrambi i casi non c'è più
      else team.rerolls = Math.max(0, team.rerolls - 1);
      return;
    case 'rerolls_adjusted':
      if (team) team.rerolls = Math.max(0, team.rerolls + int(p.delta));
      return;
    case 'bribe_used':
      if (team) team.bribes = Math.max(0, team.bribes - 1);
      return;
    case 'match_ended':
      endDrive(state);
      state.status = 'ended';
      return;
  }

  if ((STAT_EVENTS as readonly string[]).includes(event.type) && team) {
    applyStat(team, event.type as StatEvent, str(p.player_id));
    if (event.type === 'touchdown') {
      team.score += 1;
      // Il touchdown chiude il drive e chi ha segnato calcia il prossimo (p. 50)
      if (state.status === 'in_drive') {
        endDrive(state);
        state.kicking_team_id = event.team_id;
      }
    }
  }
}

// Gli annullamenti si leggono prima: un undo vale per il suo bersaglio e per gli eventi che il server ne ha derivato
function voidedIds(events: LiveEvent[]) {
  const voided = new Set<string>();
  const undoTargets = events.filter(e => e.type === 'undo').map(e => str(e.payload.event_id)).filter((id): id is string => !!id);
  for (const target of undoTargets) voided.add(target);
  for (const e of events) {
    const cause = str(e.payload.cause);
    if (cause && voided.has(cause)) voided.add(e.id);
  }
  return voided;
}

export function reduceLive(events: LiveEvent[]): LiveState {
  const sorted = [...events].sort((a, b) => a.seq - b.seq);
  const voided = voidedIds(sorted);
  const state = emptyLiveState();
  for (const event of sorted) {
    state.seq = Math.max(state.seq, event.seq);
    if (event.type === 'undo') { state.phase_seq = event.seq; continue; }
    if (voided.has(event.id)) continue;
    if (PHASE_EVENTS.has(event.type)) state.phase_seq = event.seq;
    applyEvent(state, event);
  }
  state.voided = [...voided];
  return state;
}
