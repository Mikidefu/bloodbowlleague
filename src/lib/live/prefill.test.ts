// Dal live al referto: npm test
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, test } from 'node:test';
import { livePrefill } from './prefill';
import { reduceLive } from './reduce';
import type { LiveEvent, LiveTeamSetup } from './types';

const H = 'home';
const A = 'away';
const setup: LiveTeamSetup = { rerolls: 3, mascot: false, master_chef: false, assistant_coaches: 0, cheerleaders: 0, fan_factor: 3, bribes: 0 };
const players = [
  { player_id: 'h1', team_id: H, unavailable: null },
  { player_id: 'h2', team_id: H, unavailable: null },
  { player_id: 'h3', team_id: H, unavailable: 'mng' },
  { player_id: 'a1', team_id: A, unavailable: null },
];

function stateOf(extra: [LiveEvent['type'], string | null, Record<string, unknown>][]) {
  const events: LiveEvent[] = [];
  const add = (type: LiveEvent['type'], team_id: string | null, payload: Record<string, unknown>) =>
    events.push({ id: randomUUID(), seq: events.length + 1, type, team_id, payload, source: 'companion' });
  add('match_started', null, { home_team_id: H, away_team_id: A, kicking_team_id: A, knockout: false, teams: { [H]: setup, [A]: setup } });
  add('kickoff_rolled', A, { drive: 1, kicking_team_id: A, dice: [2, 3], total: 5, name: 'High Kick' });
  for (const e of extra) add(...e);
  return reduceLive(events);
}

describe('livePrefill', () => {
  test('nessun dato dal live: niente da precompilare', () => {
    assert.equal(livePrefill(stateOf([]), players), null);
    assert.equal(livePrefill(null, players), null);
  });

  test('punteggio, Casualty e statistiche per giocatore nei campi del referto', () => {
    const p = livePrefill(stateOf([
      ['completion', H, { player_id: 'h2' }],
      ['touchdown', H, { player_id: 'h1' }],
      ['casualty', A, { player_id: 'a1' }],
      ['casualty', A, { player_id: 'a1' }],
    ]), players)!;
    assert.deepEqual(p.scores, { [H]: 1, [A]: 0 });
    assert.deepEqual(p.casualties, { [H]: 0, [A]: 2 });
    assert.deepEqual(p.players.h1, { td: 1, cas: 0, int: 0, comp: 0, ttm: 0, landing: 0 });
    assert.deepEqual(p.players.h2, { td: 0, cas: 0, int: 0, comp: 1, ttm: 0, landing: 0 });
    assert.equal(p.players.a1.cas, 2);
    assert.equal(p.events, 4);
  });

  test('touchdown senza giocatore (Star Player): nel punteggio, non a un giocatore', () => {
    const p = livePrefill(stateOf([['touchdown', H, {}]]), players)!;
    assert.equal(p.scores[H], 1);
    assert.deepEqual(p.withoutPlayer[H], { td: 1 });
    assert.deepEqual(p.players, {});
  });

  test('Casualty senza giocatore contano nel totale di squadra', () => {
    const p = livePrefill(stateOf([['casualty', H, { player_id: 'h1' }], ['casualty', H, {}]]), players)!;
    assert.equal(p.casualties[H], 2);
    assert.equal(p.players.h1.cas, 1);
  });

  test('statistiche di un giocatore che nel referto non può esserci: messe da parte, non perse in silenzio', () => {
    const p = livePrefill(stateOf([['casualty', H, { player_id: 'h3' }]]), players)!;
    assert.deepEqual(p.skipped, [{ player_id: 'h3', team_id: H, stats: { cas: 1 } }]);
    assert.equal(p.players.h3, undefined);
    assert.equal(p.casualties[H], 0);
  });

  test('gli eventi annullati non arrivano al referto', () => {
    const casId = randomUUID();
    const state = reduceLive([
      { id: randomUUID(), seq: 1, type: 'match_started', team_id: null, source: 'server',
        payload: { home_team_id: H, away_team_id: A, kicking_team_id: A, knockout: false, teams: { [H]: setup, [A]: setup } } },
      { id: casId, seq: 2, type: 'casualty', team_id: H, source: 'companion', payload: { player_id: 'h1' } },
      { id: randomUUID(), seq: 3, type: 'undo', team_id: H, source: 'companion', payload: { event_id: casId } },
    ]);
    assert.equal(livePrefill(state, players), null);
  });
});
