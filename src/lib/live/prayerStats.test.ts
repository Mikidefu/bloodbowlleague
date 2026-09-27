// Statistiche dei Prayers to Nuffle nella partita dal vivo (p. 143): npm test
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, test } from 'node:test';
import { reduceLive } from './reduce';
import { LiveRuleError, validateLiveEvent, whyNot } from './rules';
import type { LiveEvent, LiveTeamSetup } from './types';

const H = 'home';
const A = 'away';
const setup: LiveTeamSetup = { rerolls: 3, mascot: false, master_chef: false, assistant_coaches: 0, cheerleaders: 0, fan_factor: 3, bribes: 0 };
const admin = { role: 'admin' } as const;

// Casa con Dazzling Catching (11) e Fouling Frenzy (13), ospiti senza preghiere; drive in corso
const state = reduceLive([
  { id: randomUUID(), seq: 1, type: 'match_started', team_id: null, source: 'server',
    payload: { home_team_id: H, away_team_id: A, kicking_team_id: A, knockout: false, teams: { [H]: { ...setup, prayers: [11, 13] }, [A]: setup } } },
  { id: randomUUID(), seq: 2, type: 'kickoff_rolled', team_id: A, source: 'server', payload: { drive: 1, kicking_team_id: A, dice: [2, 3], total: 5, name: 'High Kick' } },
] as LiveEvent[]);

const check = (type: string, team: string, payload: Record<string, unknown> = {}) =>
  validateLiveEvent(state, { id: randomUUID(), type, team_id: team, payload }, admin, []);
const code = (fn: () => unknown) => {
  try { fn(); return null; } catch (e) { return e instanceof LiveRuleError ? e.code : 'other'; }
};

describe('statistiche dei Prayers to Nuffle dal vivo', () => {
  test('solo la squadra con la preghiera le può segnare', () => {
    assert.equal(code(() => check('catch', H, { player_id: 'h1' })), null);
    assert.equal(code(() => check('foul_casualty', H, { player_id: 'h1' })), null);
    assert.equal(code(() => check('crowd_casualty', H, { player_id: 'h1' })), 'prayer_missing');
    assert.equal(code(() => check('catch', A, { player_id: 'a1' })), 'prayer_missing');
  });

  test('serve il giocatore che prende gli SPP, ma il tasto resta acceso finché non lo si sceglie', () => {
    assert.equal(code(() => check('catch', H)), 'player_required');
    assert.equal(whyNot(state, 'catch', H, admin), null);
    assert.equal(whyNot(state, 'catch', A, admin)?.code, 'prayer_missing');
  });

  test('un live avviato prima delle preghiere non le conosce: niente statistiche delle preghiere', () => {
    const old = reduceLive([
      { id: randomUUID(), seq: 1, type: 'match_started', team_id: null, source: 'server',
        payload: { home_team_id: H, away_team_id: A, kicking_team_id: A, knockout: false, teams: { [H]: setup, [A]: setup } } },
      { id: randomUUID(), seq: 2, type: 'kickoff_rolled', team_id: A, source: 'server', payload: { drive: 1, kicking_team_id: A, dice: [2, 3], total: 5, name: 'High Kick' } },
    ] as LiveEvent[]);
    assert.equal(whyNot(old, 'catch', H, admin)?.code, 'prayer_missing');
  });
});
