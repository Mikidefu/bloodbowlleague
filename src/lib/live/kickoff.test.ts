// Kick-off Event (p. 48) con dadi decisi dal test: npm test
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { resolveKickoff, validateManualDice, type KickoffInput } from './kickoff';
import type { LiveTeamSetup } from './types';

const H = 'home-team';
const A = 'away-team';
const base: LiveTeamSetup = { rerolls: 3, mascot: false, master_chef: false, assistant_coaches: 0, cheerleaders: 0, fan_factor: 3, bribes: 0 };

// I dadi escono in quest'ordine: 2D6 del kick-off, poi il D6 di chi calcia e quello di chi riceve, poi D3/Meteo
const dice = (...values: number[]) => () => {
  const next = values.shift();
  if (next === undefined) throw new Error('Out of dice');
  return next;
};

const input = (home: Partial<LiveTeamSetup> = {}, away: Partial<LiveTeamSetup> = {}, extra: Partial<KickoffInput> = {}): KickoffInput => ({
  drive: 1, kickingTeamId: A, receivingTeamId: H, kickingTurn: 0,
  teams: { [H]: { ...base, ...home }, [A]: { ...base, ...away } }, ...extra,
});

describe('resolveKickoff', () => {
  test('Brilliant Coaching: D6 + Assistant Coaches, vince il più alto', () => {
    const r = resolveKickoff(input({ assistant_coaches: 2 }, { assistant_coaches: 0 }), dice(3, 4, 5, 4));
    assert.equal(r.name, 'Brilliant Coaching');
    assert.deepEqual(r.outcomes, [{ team_id: A, roll: 5, total: 5 }, { team_id: H, roll: 4, total: 6 }]);
    assert.deepEqual(r.winners, [H]);
  });

  test('Brilliant Coaching in parità: entrambe', () => {
    const r = resolveKickoff(input({ assistant_coaches: 1 }), dice(3, 4, 4, 3));
    assert.deepEqual(r.winners, [A, H]);
  });

  test('Cheering Fans: il Team Mascot ritira il natural 1 (p. 144)', () => {
    const r = resolveKickoff(input({ mascot: true, cheerleaders: 1 }), dice(3, 3, 2, 1, 6));
    const home = r.outcomes!.find(o => o.team_id === H)!;
    assert.deepEqual(home, { team_id: H, roll: 6, total: 7, rerolled: 1 });
    assert.deepEqual(r.winners, [H]);
  });

  test('Dodgy Snack: colpito chi fa meno', () => {
    const r = resolveKickoff(input(), dice(5, 6, 2, 5));
    assert.equal(r.name, 'Dodgy Snack');
    assert.deepEqual(r.winners, [A]);
  });

  test('Pitch Invasion: D6 + Fan Factor, poi D3 giocatori', () => {
    const r = resolveKickoff(input({ fan_factor: 5 }, { fan_factor: 2 }), dice(6, 6, 4, 2, 5));
    assert.deepEqual(r.winners, [A], 'A fa 4+2=6, H fa 2+5=7');
    assert.equal(r.d3, 3);
  });

  test('Time-out: arretra se chi calcia è al turno 6-8, altrimenti avanza', () => {
    assert.equal(resolveKickoff(input({}, {}, { kickingTurn: 6 }), dice(1, 2)).turn_shift, -1);
    assert.equal(resolveKickoff(input({}, {}, { kickingTurn: 5 }), dice(2, 1)).turn_shift, 1);
  });

  test('Changing Weather: nuovo 2D6 sul Meteo', () => {
    const r = resolveKickoff(input(), dice(4, 4, 6, 5));
    assert.equal(r.weather_roll, 11);
  });

  test('Solid Defence, Quick Snap, Charge!: D3', () => {
    assert.equal(resolveKickoff(input(), dice(2, 2, 5)).d3, 3);
    assert.equal(resolveKickoff(input(), dice(4, 5, 1)).d3, 1);
  });

  test('dadi tirati al tavolo: nessun dado del server', () => {
    const none = () => { throw new Error('should not roll'); };
    const r = resolveKickoff(input({ mascot: true }, {}, { manual: { dice: [3, 4], rolls: { [A]: 2, [H]: 1 } } }), none);
    assert.deepEqual(r.winners, [A], 'il natural 1 inserito a mano non si ritira: l\'ha già fatto il coach');
  });

  test('dadi a mano non validi', () => {
    assert.ok(validateManualDice({ dice: [0, 7] as [number, number] }, [A, H]));
    assert.ok(validateManualDice({ rolls: { other: 3 } }, [A, H]));
    assert.ok(validateManualDice({ d3: 4 }, [A, H]));
    assert.equal(validateManualDice({ dice: [6, 6], rolls: { [A]: 1 }, d3: 2 }, [A, H]), null);
  });
});
