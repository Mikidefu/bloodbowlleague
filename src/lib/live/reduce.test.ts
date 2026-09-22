// Tabellone e regole di scrittura, senza database: npm test
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, test } from 'node:test';
import { reduceLive } from './reduce';
import { LiveRuleError, validateLiveEvent, type ClientEventInput, type LiveActor } from './rules';
import type { KickoffResult, LiveEvent, LiveStartPayload, LiveTeamSetup } from './types';

const H = 'home-team';
const A = 'away-team';
const base: LiveTeamSetup = { rerolls: 3, mascot: false, master_chef: false, assistant_coaches: 0, cheerleaders: 0, fan_factor: 3, bribes: 0 };

function game(overrides: { home?: Partial<LiveTeamSetup>; away?: Partial<LiveTeamSetup>; knockout?: boolean } = {}) {
  const events: LiveEvent[] = [];
  const add = (type: LiveEvent['type'], team_id: string | null = null, payload: Record<string, unknown> = {}, source: LiveEvent['source'] = 'admin') => {
    const event: LiveEvent = { id: randomUUID(), seq: events.length + 1, type, team_id, payload, source };
    events.push(event);
    return event;
  };
  const setup: LiveStartPayload = {
    home_team_id: H, away_team_id: A, kicking_team_id: A, knockout: !!overrides.knockout,
    teams: { [H]: { ...base, ...overrides.home }, [A]: { ...base, rerolls: 2, ...overrides.away } },
  };
  add('match_started', null, setup, 'server');
  const kickoff = (total: number, extra: Partial<KickoffResult> = {}) => {
    const state = reduceLive(events);
    return add('kickoff_rolled', state.kicking_team_id, {
      drive: state.drive + 1, kicking_team_id: state.kicking_team_id, dice: [1, total - 1], total, name: 'x', ...extra,
    }, 'server');
  };
  return { events, add, kickoff, state: () => reduceLive(events) };
}

describe('reduceLive', () => {
  test('avvio: primo tempo, in attesa del kick-off di chi ha vinto il roll-off', () => {
    const g = game();
    const s = g.state();
    assert.equal(s.status, 'awaiting_kickoff');
    assert.equal(s.half, 1);
    assert.equal(s.kicking_team_id, A);
    assert.equal(s.teams[H].rerolls, 3);
    assert.equal(s.teams[A].rerolls, 2);
  });

  test('Brilliant Coaching: reroll per il drive, perso col touchdown che chiude il drive (p. 48)', () => {
    const g = game();
    g.kickoff(7, { winners: [H] });
    assert.equal(g.state().teams[H].drive_rerolls, 1);
    assert.equal(g.state().status, 'in_drive');
    g.add('touchdown', H, {});
    const s = g.state();
    assert.equal(s.teams[H].drive_rerolls, 0);
    assert.equal(s.teams[H].score, 1);
    assert.equal(s.status, 'awaiting_kickoff');
    assert.equal(s.kicking_team_id, H, 'chi segna calcia (p. 50)');
  });

  test('Brilliant Coaching in parità: un reroll a entrambe', () => {
    const g = game();
    g.kickoff(7, { winners: [A, H] });
    assert.equal(g.state().teams[H].drive_rerolls, 1);
    assert.equal(g.state().teams[A].drive_rerolls, 1);
  });

  test('Get the Ref: un Bribe a entrambe', () => {
    const g = game({ home: { bribes: 1 } });
    g.kickoff(2, { winners: [A, H] });
    assert.equal(g.state().teams[H].bribes, 2);
    assert.equal(g.state().teams[A].bribes, 1);
  });

  test('Team Re-roll pieni all\'intervallo, non nei supplementari (pp. 33, 83)', () => {
    const g = game({ knockout: true });
    g.kickoff(5);
    g.add('reroll_used', H, { kind: 'team' });
    g.add('reroll_used', H, { kind: 'team' });
    assert.equal(g.state().teams[H].rerolls, 1);
    g.add('half_started', null, { half: 2 });
    let s = g.state();
    assert.equal(s.teams[H].rerolls, 3);
    assert.equal(s.kicking_team_id, H, 'nel secondo tempo calcia chi ha ricevuto nel primo (p. 50)');
    g.kickoff(5);
    g.add('reroll_used', H, { kind: 'team' });
    g.add('half_started', null, { half: 3, kicking_team_id: A });
    s = g.state();
    assert.equal(s.half, 3);
    assert.equal(s.teams[H].rerolls, 2, 'i reroll non usati passano ai supplementari');
    assert.equal(s.kicking_team_id, A);
  });

  test('Brilliant Coaching perso a fine tempo anche senza touchdown', () => {
    const g = game();
    g.kickoff(7, { winners: [H] });
    g.add('half_started', null, { half: 2 });
    assert.equal(g.state().teams[H].drive_rerolls, 0);
  });

  test('Time-out sposta entrambi i segnalini (p. 48)', () => {
    const g = game();
    g.kickoff(5);
    for (let i = 0; i < 6; i++) { g.add('turn_started', H, { turn: i + 1 }); g.add('turn_started', A, { turn: i + 1 }); }
    g.add('touchdown', A, {});
    g.kickoff(3, { turn_shift: -1 });
    assert.equal(g.state().teams[H].turn, 5);
    assert.equal(g.state().teams[A].turn, 5);
  });

  test('Team Mascot: il reroll si usa (o si perde) una volta per tempo', () => {
    const g = game({ home: { mascot: true } });
    g.kickoff(5);
    g.add('reroll_used', H, { kind: 'mascot', roll: 2 });
    assert.equal(g.state().teams[H].mascot, false);
    assert.equal(g.state().teams[H].rerolls, 3, 'il Team Re-roll normale non si tocca');
    g.add('half_started', null, { half: 2 });
    assert.equal(g.state().teams[H].mascot, true);
  });

  test('Halfling Master Chef: ruba reroll, l\'avversario non va sotto zero (p. 146)', () => {
    const g = game({ away: { rerolls: 1, master_chef: true } });
    const start = g.events[0];
    g.add('chef_rolled', A, { dice: [4, 5, 6], stolen: 3, cause: start.id }, 'server');
    assert.equal(g.state().teams[A].rerolls, 4);
    assert.equal(g.state().teams[H].rerolls, 0);
  });

  test('undo: annulla l\'evento e quelli derivati', () => {
    const g = game();
    const used = g.add('reroll_used', H, { kind: 'team' });
    g.add('undo', H, { event_id: used.id });
    assert.equal(g.state().teams[H].rerolls, 3);
    const half = g.add('half_started', null, { half: 2 });
    g.add('chef_rolled', A, { dice: [6, 6, 6], stolen: 3, cause: half.id }, 'server');
    g.add('undo', null, { event_id: half.id });
    const s = g.state();
    assert.equal(s.half, 1);
    assert.equal(s.teams[A].rerolls, 2);
    assert.ok(s.voided.includes(half.id));
  });

  test('statistiche per giocatore con le colonne di player_stats', () => {
    const g = game();
    g.kickoff(5);
    g.add('casualty', H, { player_id: 'p1' });
    g.add('casualty', H, { player_id: 'p1' });
    g.add('completion', H, { player_id: 'p2' });
    g.add('casualty', H, {});
    const t = g.state().teams[H];
    assert.deepEqual(t.stats.p1, { casualties: 2 });
    assert.deepEqual(t.stats.p2, { completions: 1 });
    assert.deepEqual(t.team_stats, { casualties: 1 });
  });

  test('l\'ordine è quello di seq, non quello di arrivo', () => {
    const g = game();
    g.kickoff(5);
    g.add('touchdown', H, {});
    assert.deepEqual(reduceLive([...g.events].reverse()), g.state());
  });
});

describe('validateLiveEvent', () => {
  const admin: LiveActor = { role: 'admin' };
  const homePhone: LiveActor = { role: 'companion', teamId: H };
  const input = (type: string, payload: Record<string, unknown> = {}, team_id?: string): ClientEventInput => ({ id: randomUUID(), type, payload, team_id });
  const rejects = (fn: () => unknown, status: number) =>
    assert.throws(fn, (e: unknown) => e instanceof LiveRuleError && e.status === status);

  test('il telefono scrive solo per la sua squadra', () => {
    const g = game();
    g.kickoff(5);
    rejects(() => validateLiveEvent(g.state(), input('reroll_used', {}, A), homePhone, g.events), 403);
    const ok = validateLiveEvent(g.state(), input('reroll_used', {}), homePhone, g.events);
    assert.equal(ok.team_id, H);
  });

  test('turno: solo dopo il kick-off, al massimo 8, numero calcolato dal server', () => {
    const g = game();
    rejects(() => validateLiveEvent(g.state(), input('turn_started', {}, H), admin, g.events), 409);
    g.kickoff(5);
    const e = validateLiveEvent(g.state(), input('turn_started', { turn: 7 }, H), admin, g.events);
    assert.deepEqual(e.payload, { turn: 1 });
    for (let i = 1; i <= 8; i++) g.add('turn_started', H, { turn: i });
    rejects(() => validateLiveEvent(g.state(), input('turn_started', {}, H), admin, g.events), 409);
  });

  test('stesso stato, stessa chiave anti-doppione; dopo l\'evento la chiave cambia', () => {
    const g = game();
    g.kickoff(5);
    const a = validateLiveEvent(g.state(), input('turn_started', {}, H), admin, g.events);
    const b = validateLiveEvent(g.state(), input('turn_started', {}, H), homePhone, g.events);
    assert.equal(a.dedupe_key, b.dedupe_key);
    g.add('turn_started', H, a.payload);
    const c = validateLiveEvent(g.state(), input('turn_started', {}, H), admin, g.events);
    assert.notEqual(c.dedupe_key, a.dedupe_key);
  });

  test('reroll finiti: rifiutato; reroll del drive solo se c\'è', () => {
    const g = game({ home: { rerolls: 1 } });
    g.kickoff(5);
    g.add('reroll_used', H, { kind: 'team' });
    rejects(() => validateLiveEvent(g.state(), input('reroll_used', {}, H), admin, g.events), 409);
    rejects(() => validateLiveEvent(g.state(), input('reroll_used', { kind: 'drive' }, H), admin, g.events), 409);
  });

  test('supplementari solo nei playoff, in parità, con la squadra che calcia', () => {
    const league = game();
    league.add('half_started', null, { half: 2 });
    rejects(() => validateLiveEvent(league.state(), input('half_started', { half: 3, kicking_team_id: A }), admin, league.events), 409);
    const cup = game({ knockout: true });
    cup.add('half_started', null, { half: 2 });
    assert.throws(() => validateLiveEvent(cup.state(), input('half_started', { half: 3 }), admin, cup.events), LiveRuleError);
    const ok = validateLiveEvent(cup.state(), input('half_started', { half: 3, kicking_team_id: H }), admin, cup.events);
    assert.equal(ok.payload.kicking_team_id, H);
    cup.kickoff(5);
    cup.add('touchdown', H, {});
    rejects(() => validateLiveEvent(cup.state(), input('half_started', { half: 3, kicking_team_id: H }), admin, cup.events), 409);
  });

  test('undo: il telefono annulla solo i suoi eventi, mai quelli del server', () => {
    const g = game();
    const kick = g.kickoff(5);
    const mine = g.add('reroll_used', H, { kind: 'team' }, 'companion');
    const theirs = g.add('reroll_used', A, { kind: 'team' }, 'companion');
    assert.equal(validateLiveEvent(g.state(), input('undo', { event_id: mine.id }), homePhone, g.events).team_id, H);
    rejects(() => validateLiveEvent(g.state(), input('undo', { event_id: theirs.id }), homePhone, g.events), 403);
    rejects(() => validateLiveEvent(g.state(), input('undo', { event_id: kick.id }), homePhone, g.events), 403);
    assert.ok(validateLiveEvent(g.state(), input('undo', { event_id: kick.id }), admin, g.events));
    g.add('undo', null, { event_id: mine.id });
    rejects(() => validateLiveEvent(g.state(), input('undo', { event_id: mine.id }), admin, g.events), 409);
  });

  test('a partita finita scrive solo l\'admin, e solo per annullare', () => {
    const g = game();
    const end = g.add('match_ended', null, {});
    rejects(() => validateLiveEvent(g.state(), input('casualty', {}, H), admin, g.events), 409);
    assert.ok(validateLiveEvent(g.state(), input('undo', { event_id: end.id }), admin, g.events));
  });

  test('id non UUID rifiutato (serve per l\'idempotenza)', () => {
    const g = game();
    rejects(() => validateLiveEvent(g.state(), { id: '1', type: 'casualty', team_id: H }, admin, g.events), 400);
  });
});
