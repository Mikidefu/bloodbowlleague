// Avvisi della companion: npm test
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, test } from 'node:test';
import { noticesFor } from './notify';
import type { LiveEvent } from './types';

const ME = 'my-team';
const THEM = 'their-team';
const ctx = {
  language: 'it' as const,
  teamName: (id: string | null) => (id === ME ? 'Noi' : id === THEM ? 'Loro' : '—'),
  playerName: () => null,
  events: [] as LiveEvent[],
};
const ev = (type: LiveEvent['type'], team_id: string | null, payload: Record<string, unknown> = {}, source: LiveEvent['source'] = 'server'): LiveEvent =>
  ({ id: randomUUID(), seq: 1, type, team_id, payload, source });
const kickoff = (total: number, winners: string[]) =>
  ev('kickoff_rolled', THEM, { drive: 1, kicking_team_id: THEM, dice: [1, total - 1], total, name: 'x', winners });

describe('noticesFor', () => {
  test('Brilliant Coaching vinto: avviso positivo col reroll', () => {
    const [n] = noticesFor([kickoff(7, [ME])], ME, ctx);
    assert.equal(n.tone, 'good');
    assert.match(n.text, /Hai vinto un Team Re-roll/);
  });

  test('Brilliant Coaching vinto dall\'avversario: si sa, ma senza festa', () => {
    const [n] = noticesFor([kickoff(7, [THEM])], ME, ctx);
    assert.equal(n.tone, 'neutral');
    assert.match(n.text, /Loro/);
  });

  test('Get the Ref: Bribe gratis per tutti', () => {
    assert.equal(noticesFor([kickoff(2, [THEM, ME])], ME, ctx)[0].tone, 'good');
  });

  test('Pitch Invasion che ci colpisce: avviso negativo', () => {
    assert.equal(noticesFor([kickoff(12, [ME])], ME, ctx)[0].tone, 'bad');
  });

  test('Chef avversario che ruba reroll', () => {
    const [n] = noticesFor([ev('chef_rolled', THEM, { stolen: 2 })], ME, ctx);
    assert.equal(n.tone, 'bad');
    assert.match(n.text, /2 Team Re-roll/);
  });

  test('le mosse normali dell\'avversario non disturbano', () => {
    assert.deepEqual(noticesFor([ev('turn_started', THEM, { turn: 3 }, 'companion'), ev('reroll_used', THEM, { kind: 'team' }, 'companion')], ME, ctx), []);
  });

  test('il web che registra per noi: si segnala', () => {
    const [n] = noticesFor([ev('reroll_used', ME, { kind: 'team' }, 'admin')], ME, ctx);
    assert.match(n.text, /^Dal web: /);
  });
});
