// Partita dal vivo sul database (solo server): avvio, abbinamento dei telefoni, scrittura e lettura del registro.
//
// Robustezza:
// - ogni evento ha un UUID scelto da chi lo crea: rimandarlo (rete ballerina, coda offline) non lo duplica;
// - seq e dedupe_key sono UNIQUE per partita e ogni scrittura è un batch atomico;
// - lo stato non si salva mai: si ricalcola dal registro, quindi non può divergere dagli eventi.

import crypto from 'crypto';
import db from '@/lib/db';
import { rollDie } from '@/lib/matchTables';
import { resolveKickoff, validateManualDice, type DieRoller, type ManualKickoffDice } from './kickoff';
import { reduceLive } from './reduce';
import { LiveRuleError, canRollKickoff, isEventId, kickoffDedupeKey, validateLiveEvent, type ClientEventInput, type LiveActor, type LiveErrorCode, type ValidatedEvent } from './rules';
import { chefRolls, liveStartPayload } from './setup';
import { companionToken, newJoinCode, newNonce, normalizeJoinCode } from './token';
import type { LiveEvent, LiveEventType, LiveState } from './types';

type Row = Record<string, unknown>;
type Arg = string | number | null;

export const MAX_EVENTS_PER_REQUEST = 50;

export type LiveRow = {
  match_id: string;
  home_team_id: string;
  away_team_id: string;
  join_code: string;
  home_nonce: string | null;
  away_nonce: string | null;
  home_device: string | null;
  away_device: string | null;
  status: 'live' | 'ended';
  played: boolean;   // referto già salvato: il live vale come chiuso anche se nessuno l'ha chiuso
};

type NewEvent = Omit<ValidatedEvent, 'id'> & { id: string; source: LiveEvent['source'] };

const str = (v: unknown) => (v === null || v === undefined ? null : String(v));
const fail = (message: string, status = 400, code: LiveErrorCode = 'invalid'): never => { throw new LiveRuleError(message, status, code); };

function toLiveRow(r: Row): LiveRow {
  return {
    match_id: String(r.match_id), home_team_id: String(r.home_team_id), away_team_id: String(r.away_team_id),
    join_code: String(r.join_code), home_nonce: str(r.home_nonce), away_nonce: str(r.away_nonce),
    home_device: str(r.home_device), away_device: str(r.away_device),
    status: r.status === 'ended' || Number(r.is_played) ? 'ended' : 'live', played: !!Number(r.is_played),
  };
}

function toEvent(r: Row): LiveEvent {
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(String(r.payload ?? '{}')); } catch { payload = {}; }
  return {
    id: String(r.id), seq: Number(r.seq), team_id: str(r.team_id), type: String(r.type) as LiveEventType, payload,
    source: (['admin', 'companion', 'server'].includes(String(r.source)) ? r.source : 'server') as LiveEvent['source'],
    created_at: str(r.created_at) ?? undefined,
  };
}

const LIVE_SELECT = `SELECT l.*, m.home_team_id, m.away_team_id, m.is_played FROM match_live l JOIN matches m ON m.id = l.match_id`;

// Col referto già salvato il live non accetta più niente: i numeri ufficiali sono quelli del referto
async function assertNotPlayed(matchId: string) {
  const { rows: [row] } = await db.execute({ sql: 'SELECT is_played FROM matches WHERE id = ?', args: [matchId] });
  if (!row) fail('Match not found', 404, 'not_found');
  if (Number(row.is_played)) fail('The match report has already been saved', 409, 'match_played');
}

export async function loadLive(matchId: string): Promise<LiveRow | null> {
  const { rows: [row] } = await db.execute({ sql: `${LIVE_SELECT} WHERE l.match_id = ?`, args: [matchId] });
  return row ? toLiveRow(row) : null;
}

export async function loadEvents(matchId: string): Promise<LiveEvent[]> {
  const { rows } = await db.execute({ sql: 'SELECT * FROM match_events WHERE match_id = ? ORDER BY seq', args: [matchId] });
  return rows.map(toEvent);
}

// Il seq lo assegna il database dentro il batch: MAX+1 della partita, protetto da UNIQUE(match_id, seq)
const insertEvent = (matchId: string, e: NewEvent) => ({
  sql: `INSERT OR IGNORE INTO match_events (id, match_id, seq, team_id, type, payload, source, dedupe_key)
        SELECT ?, ?, COALESCE(MAX(seq), 0) + 1, ?, ?, ?, ?, ? FROM match_events WHERE match_id = ?`,
  args: [e.id, matchId, e.team_id, e.type, JSON.stringify(e.payload), e.source, e.dedupe_key, matchId] as Arg[],
});

// Eventi che il server deriva da un altro (inizio tempo -> tiri del Master Chef): stessa chiave con suffisso,
// così se il principale viene scartato come doppione lo sono anche loro; e un undo del principale li annulla (cause)
const derived = (parent: NewEvent, i: number, e: Pick<NewEvent, 'type' | 'team_id' | 'payload'>): NewEvent => ({
  ...e, id: crypto.randomUUID(), source: 'server', payload: { ...e.payload, cause: parent.id },
  dedupe_key: parent.dedupe_key ? `${parent.dedupe_key}#${i}` : null,
});

export type LiveSnapshot = {
  live: { status: 'live' | 'ended'; paired: Record<string, boolean>; join_code?: string };
  seq: number;
  events: LiveEvent[];
  state: LiveState;
};

// Quello che ricevono web e companion: gli eventi dopo `since` e lo stato completo.
// Il codice di abbinamento lo vede solo l'admin.
export async function liveSnapshot(matchId: string, since = 0, admin = false): Promise<LiveSnapshot | null> {
  const [live, events] = await Promise.all([loadLive(matchId), loadEvents(matchId)]);
  if (!live) return null;
  const state = reduceLive(events);
  return {
    live: {
      status: live.status,
      paired: { [live.home_team_id]: !!live.home_nonce, [live.away_team_id]: !!live.away_nonce },
      ...(admin ? { join_code: live.join_code } : {}),
    },
    seq: state.seq,
    events: events.filter(e => e.seq > since),
    state,
  };
}

// ------------------------------------------------------------------
// Avvio e chiusura (admin)
// ------------------------------------------------------------------

export async function startLive(matchId: string, roll: DieRoller = rollDie) {
  const { rows: [match] } = await db.execute({ sql: 'SELECT * FROM matches WHERE id = ?', args: [matchId] });
  if (!match) fail('Match not found', 404);
  if (Number(match.is_played)) fail('This match has already been played', 409, 'match_played');
  if (!Number(match.pregame_done) || !match.kicking_team_id) fail('Complete the pre-game first: the live match needs the kicking team and the inducements', 409);

  const existing = await loadLive(matchId);
  if (existing) {
    if (existing.status === 'ended') {
      // Riapertura: si annulla la chiusura, il registro resta com'era
      const events = await loadEvents(matchId);
      const state = reduceLive(events);
      const end = [...events].reverse().find(e => e.type === 'match_ended' && !state.voided.includes(e.id));
      const statements = [{ sql: `UPDATE match_live SET status = 'live', ended_at = NULL WHERE match_id = ?`, args: [matchId] as Arg[] }];
      if (end) statements.push(insertEvent(matchId, { id: crypto.randomUUID(), type: 'undo', team_id: null, payload: { event_id: end.id }, source: 'admin', dedupe_key: `undo:${end.id}` }));
      await db.batch(statements, 'write');
    }
    return;
  }

  const teamIds = [String(match.home_team_id), String(match.away_team_id)];
  const [teams, reports] = await Promise.all([
    db.execute({ sql: 'SELECT * FROM teams WHERE id IN (?, ?)', args: teamIds }),
    db.execute({ sql: 'SELECT * FROM match_team_reports WHERE match_id = ?', args: [matchId] }),
  ]);
  const setup = liveStartPayload(
    match,
    new Map(teams.rows.map(t => [String(t.id), { ...t }])),
    new Map(reports.rows.map(r => [String(r.team_id), { ...r }])),
  );
  const started: NewEvent = { id: crypto.randomUUID(), type: 'match_started', team_id: null, payload: setup, source: 'server', dedupe_key: 'start' };
  const chef = chefRolls(setup, 1, roll).map((c, i) => derived(started, i, { type: 'chef_rolled', team_id: c.team_id, payload: c.payload }));

  // Il codice è UNIQUE: in caso (rarissimo) di collisione se ne prova un altro
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await db.batch([
        { sql: `INSERT INTO match_live (match_id, join_code, status) VALUES (?, ?, 'live')`, args: [matchId, newJoinCode()] },
        insertEvent(matchId, started),
        ...chef.map(e => insertEvent(matchId, e)),
      ], 'write');
      return;
    } catch (error) {
      if (await loadLive(matchId)) return;   // avviata nello stesso istante da un'altra richiesta
      if (!String(error).includes('UNIQUE') || attempt === 4) throw error;
    }
  }
}

// Restituisce l'id dell'evento di chiusura (per le notifiche), null se era già chiusa
export async function endLive(matchId: string): Promise<string | null> {
  const live = await loadLive(matchId);
  if (!live) fail('The live match has not started', 409);
  if (live!.status === 'ended') return null;
  const state = reduceLive(await loadEvents(matchId));
  const id = crypto.randomUUID();
  await db.batch([
    insertEvent(matchId, { id, type: 'match_ended', team_id: null, payload: {}, source: 'admin', dedupe_key: `end:${state.phase_seq}` }),
    { sql: `UPDATE match_live SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE match_id = ?`, args: [matchId] },
  ], 'write');
  return id;
}

// Azzera il live (es. pre-partita rifatto: la fotografia di inizio partita non vale più). Il referto non si tocca.
export async function resetLive(matchId: string) {
  await db.batch([
    { sql: 'DELETE FROM push_subscriptions WHERE match_id = ?', args: [matchId] },
    { sql: 'DELETE FROM match_events WHERE match_id = ?', args: [matchId] },
    { sql: 'DELETE FROM match_live WHERE match_id = ?', args: [matchId] },
  ], 'write');
}

// ------------------------------------------------------------------
// Abbinamento dei telefoni
// ------------------------------------------------------------------

const side = (live: LiveRow, teamId: string) => (teamId === live.home_team_id ? 'home' : teamId === live.away_team_id ? 'away' : null);

// Cosa vede il telefono dopo aver inserito il codice: le due squadre e quali sono già prese
export async function lookupJoinCode(code: unknown) {
  const joinCode = normalizeJoinCode(code);
  if (joinCode.length !== 6) fail('The code has 6 characters');
  const { rows: [row] } = await db.execute({
    sql: `SELECT l.match_id, l.home_nonce, l.away_nonce, m.round, m.home_team_id, m.away_team_id,
                 th.name AS home_name, th.primary_color AS home_color, th.logo_url AS home_logo,
                 ta.name AS away_name, ta.primary_color AS away_color, ta.logo_url AS away_logo
          FROM match_live l
          JOIN matches m ON m.id = l.match_id
          JOIN teams th ON th.id = m.home_team_id
          JOIN teams ta ON ta.id = m.away_team_id
          WHERE l.join_code = ? AND l.status = 'live'`,
    args: [joinCode],
  });
  if (!row) fail('No live match with this code', 404);
  const team = (side: 'home' | 'away') => ({
    id: String(row[`${side}_team_id`]), name: String(row[`${side}_name`]),
    color: str(row[`${side}_color`]), logo: str(row[`${side}_logo`]), paired: !!row[`${side}_nonce`],
  });
  return { match_id: String(row.match_id), round: Number(row.round), teams: [team('home'), team('away')] };
}

// Il telefono entra col codice e sceglie la squadra: la prima che la prende la tiene,
// finché non la lascia lei o l'admin non la scollega. Lo stesso telefono può rientrare (stesso device id).
export async function joinLive(code: unknown, teamId: unknown, deviceId: unknown) {
  const joinCode = normalizeJoinCode(code);
  if (joinCode.length !== 6) fail('The code has 6 characters');
  if (!isEventId(deviceId)) fail('Invalid device id');
  const { rows: [row] } = await db.execute({ sql: `${LIVE_SELECT} WHERE l.join_code = ? AND l.status = 'live'`, args: [joinCode] });
  if (!row) fail('No live match with this code', 404);
  const live = toLiveRow(row);
  const s = typeof teamId === 'string' ? side(live, teamId) : null;
  if (!s) fail('Pick one of the two teams of this match');

  const nonce = live[`${s!}_nonce`];
  if (nonce && live[`${s!}_device`] === deviceId) {
    return { match_id: live.match_id, team_id: teamId as string, token: companionToken(live.match_id, teamId as string, nonce) };
  }
  if (nonce) fail('This team is already paired with another phone: ask the admin to disconnect it', 409);
  const fresh = newNonce();
  // Condizionale: se due telefoni scelgono la stessa squadra nello stesso istante, vince uno solo
  const result = await db.execute({
    sql: `UPDATE match_live SET ${s}_nonce = ?, ${s}_device = ? WHERE match_id = ? AND ${s}_nonce IS NULL AND status = 'live'`,
    args: [fresh, deviceId as string, live.match_id],
  });
  if (!result.rowsAffected) fail('This team has just been paired with another phone', 409);
  return { match_id: live.match_id, team_id: teamId as string, token: companionToken(live.match_id, teamId as string, fresh) };
}

// Scollega una squadra (admin) o lasciala (il telefono stesso): il vecchio token smette di valere
export async function unpairTeam(matchId: string, teamId: unknown) {
  const live = await loadLive(matchId);
  if (!live) fail('The live match has not started', 409);
  const s = typeof teamId === 'string' ? side(live!, teamId) : null;
  if (!s) fail('Unknown team');
  // Il telefono scollegato non riceve più nemmeno le notifiche di questa squadra
  await db.batch([
    { sql: `UPDATE match_live SET ${s}_nonce = NULL, ${s}_device = NULL WHERE match_id = ?`, args: [matchId] },
    { sql: 'DELETE FROM push_subscriptions WHERE match_id = ? AND team_id = ?', args: [matchId, teamId as string] },
  ], 'write');
}

// ------------------------------------------------------------------
// Scrittura degli eventi
// ------------------------------------------------------------------

export type EventResult = { id: string; status: 'ok' | 'duplicate' | 'rejected'; error?: string; code?: LiveErrorCode; params?: Record<string, string | number> };

// Uno o più eventi (la coda offline del telefono li manda a lotti). Ognuno è validato sullo stato che
// include i precedenti del lotto; uno rifiutato non blocca gli altri. Poi un solo batch atomico.
export async function recordEvents(matchId: string, actor: LiveActor, inputs: ClientEventInput[], roll: DieRoller = rollDie): Promise<EventResult[]> {
  if (!Array.isArray(inputs) || !inputs.length) fail('No events');
  if (inputs.length > MAX_EVENTS_PER_REQUEST) fail(`At most ${MAX_EVENTS_PER_REQUEST} events per request`);
  await assertNotPlayed(matchId);
  const [events, players] = await Promise.all([
    loadEvents(matchId),
    db.execute({ sql: 'SELECT p.id, p.team_id FROM players p JOIN matches m ON p.team_id IN (m.home_team_id, m.away_team_id) WHERE m.id = ?', args: [matchId] }),
  ]);
  const teamOfPlayer = new Map(players.rows.map(p => [String(p.id), String(p.team_id)]));
  const known = new Set(events.map(e => e.id));
  const working = [...events];
  let state = reduceLive(working);
  const results: EventResult[] = [];
  const accepted: NewEvent[] = [];

  for (const input of inputs) {
    const id = isEventId(input?.id) ? input.id : null;
    if (id && known.has(id)) { results.push({ id, status: 'duplicate' }); continue; }
    try {
      const event = validateLiveEvent(state, input, actor, working);
      const playerId = event.payload.player_id;
      if (typeof playerId === 'string' && teamOfPlayer.get(playerId) !== event.team_id) fail('This player is not on that team');
      const next: NewEvent = { ...event, source: actor.role };
      // Un nuovo tempo porta con sé i tiri dello Chef, che servono il dado del server
      const chef = next.type === 'half_started'
        ? chefRolls(state.setup!, Number(next.payload.half), roll).map((c, i) => derived(next, i, { type: 'chef_rolled', team_id: c.team_id, payload: c.payload }))
        : [];
      let seq = state.seq;
      for (const e of [next, ...chef]) {
        accepted.push(e);
        known.add(e.id);
        working.push({ ...e, seq: ++seq });
      }
      state = reduceLive(working);
      results.push({ id: next.id, status: 'ok' });
    } catch (error) {
      if (!(error instanceof LiveRuleError)) throw error;
      results.push({ id: id ?? String(input?.id ?? ''), status: 'rejected', error: error.message, code: error.code, params: error.params });
    }
  }

  if (accepted.length) {
    await db.batch(accepted.map(e => insertEvent(matchId, e)), 'write');
    // Scartati dal database come doppioni (stessa azione registrata nello stesso istante da un altro dispositivo)
    const { rows } = await db.execute({
      sql: `SELECT id FROM match_events WHERE match_id = ? AND id IN (${accepted.map(() => '?').join(', ')})`,
      args: [matchId, ...accepted.map(e => e.id)],
    });
    const stored = new Set(rows.map(r => String(r.id)));
    for (const r of results) if (r.status === 'ok' && !stored.has(r.id)) r.status = 'duplicate';
  }
  return results;
}

// Il kick-off lo tira il server (o registra i dadi tirati al tavolo) e ne scrive subito anche gli effetti
export async function rollKickoff(matchId: string, actor: LiveActor, id: unknown, manual?: ManualKickoffDice, roll: DieRoller = rollDie) {
  if (!isEventId(id)) fail('Event id must be a UUID');
  await assertNotPlayed(matchId);
  const events = await loadEvents(matchId);
  if (events.some(e => e.id === id)) return { status: 'duplicate' as const };
  const state = reduceLive(events);
  if (state.status === 'not_started') fail('The live match has not started', 409, 'not_started');
  if (!canRollKickoff(state, actor)) fail('The kicking team rolls the kick-off (p. 48)', 403, 'kicking_team_only');
  const dedupe = kickoffDedupeKey(state);
  const kicking = state.kicking_team_id!;
  const receiving = kicking === state.home_team_id ? state.away_team_id! : state.home_team_id!;
  const invalid = validateManualDice(manual, [kicking, receiving]);
  if (invalid) fail(invalid);

  const result = resolveKickoff({
    drive: state.drive + 1, kickingTeamId: kicking, receivingTeamId: receiving,
    kickingTurn: state.teams[kicking].turn, teams: state.setup!.teams, manual,
  }, roll);
  const payload = { ...result, requested_by: actor.role, ...(manual ? { manual: true } : {}) };
  const event: NewEvent = { id: id as string, type: 'kickoff_rolled', team_id: kicking, payload, source: 'server', dedupe_key: dedupe };
  await db.batch([insertEvent(matchId, event)], 'write');
  const { rows } = await db.execute({ sql: 'SELECT 1 FROM match_events WHERE id = ?', args: [id as string] });
  // Se non c'è, nello stesso istante qualcun altro ha tirato il kick-off di questo drive: vale il suo
  return { status: rows.length ? 'ok' as const : 'duplicate' as const };
}
