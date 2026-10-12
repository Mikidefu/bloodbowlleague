// La rosa nella companion: npm test
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { toMatchPlayer, toPlayer } from '@/lib/players';
import { prayerEffects } from '@/lib/prayers';
import { rosterEntries } from './roster';

const row = (id: string, jersey: number | null, extra: Record<string, unknown> = {}) =>
  ({ id, team_id: 't1', jersey_number: jersey, name: `Player ${id}`, role: 'Lineman', value: 50000, ma: 6, st: 3, ag: '3+', pa: '4+', av: '8+', ...extra });
const block = { id: 's1', name: 'BLOCK', type: 'General', description: 'Text', description_it: 'Testo', level: null };

const team = [
  toPlayer(row('a', 7), { skills: [block] }),
  toPlayer(row('b', 2, { mng: 1 })),
  toPlayer(row('c', null)),
  toPlayer(row('d', 1, { dead: 1 })),
];

describe('rosa della companion', () => {
  test('con la partita: ordine per maglia, chi non gioca in fondo, skill dalla scheda squadra', () => {
    const match = [toMatchPlayer(row('a', 7), null), toMatchPlayer(row('b', 2), 'mng'), toMatchPlayer(row('c', null), null)];
    const list = rosterEntries(team, match, new Map());
    assert.deepEqual(list.map(p => p.id), ['a', 'c', 'b']);
    assert.deepEqual(list[0].skills.map(s => s.name), ['BLOCK']);
    assert.equal(list[2].unavailable, 'mng');
  });

  test('senza la partita: Team Draft List, MNG dalle bandiere', () => {
    const list = rosterEntries(team, null, new Map());
    assert.deepEqual(list.map(p => p.id), ['a', 'c', 'b']);   // il morto non c'è
    assert.equal(list[2].unavailable, 'mng');
  });

  test('senza la scheda squadra restano i profili della partita', () => {
    const list = rosterEntries(null, [toMatchPlayer(row('a', 7), null)], new Map());
    assert.equal(list[0].full, null);
    assert.deepEqual(list[0].skills, []);
    assert.equal(list[0].ma, 6);
  });

  test('i Prayers cambiano il profilo di partita, non quello di rosa', () => {
    // Iron Man (4) su "a" dalla propria squadra, Greasy Cleats (7) su "a" dagli avversari
    const effects = prayerEffects({ t1: [{ roll: 4, players: ['a'] }], t2: [{ roll: 7, players: ['a'] }] });
    const [a] = rosterEntries(team, [toMatchPlayer(row('a', 7), null)], effects);
    assert.deepEqual([a.ma, a.av], [5, '9+']);
    assert.deepEqual(a.base, { ma: 6, av: '8+' });
    assert.deepEqual(a.effects.map(e => e.prayer), ['Iron Man', 'Greasy Cleats']);
  });
});
