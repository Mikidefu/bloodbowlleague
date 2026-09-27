// Prayers to Nuffle (pp. 142-143): tiri, scelte dei giocatori, profili e SPP. npm test
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { sppEarned } from './leagueRules';
import {
  PRAYERS, parsePrayers, prayerEffects, prayerProblem, prayerSpp, prayerStatFields, primarySkillOptions, profileWithPrayers,
  type PrayerCandidates,
} from './prayers';

const own = ['h1', 'h2', 'h3'];
const opponent = ['a1', 'a2', 'a3', 'a4'];
const candidates: PrayerCandidates = { own, opponent, primarySkills: () => primarySkillOptions(['G', 'S']) };

describe('Prayers to Nuffle: la tabella', () => {
  test('16 risultati, uno per faccia del D16', () => {
    assert.deepEqual(PRAYERS.map(p => p.roll), Array.from({ length: 16 }, (_, i) => i + 1));
  });
});

describe('prayerProblem', () => {
  test('una preghiera per ogni acquisto, niente di più', () => {
    assert.equal(prayerProblem([], 0, candidates), null);
    assert.match(prayerProblem([], 2, candidates)!, /roll the D16/);
    assert.match(prayerProblem([{ roll: 2 }], 2, candidates)!, /roll the D16/);
  });

  test('i doppioni della squadra si ritirano (p. 142)', () => {
    assert.match(prayerProblem([{ roll: 9 }, { roll: 9 }], 2, candidates)!, /rolled twice/);
    assert.equal(prayerProblem([{ roll: 9 }, { roll: 15 }], 2, candidates), null);
  });

  test('il D16 va da 1 a 16', () => {
    assert.match(prayerProblem([{ roll: 17 }], 1, candidates)!, /D16/);
    assert.match(prayerProblem([{ roll: 0 }], 1, candidates)!, /D16/);
  });

  test('Iron Man sceglie un giocatore della squadra, non un avversario', () => {
    assert.match(prayerProblem([{ roll: 4 }], 1, candidates)!, /select 1/);
    assert.match(prayerProblem([{ roll: 4, players: ['a1'] }], 1, candidates)!, /playing this game/);
    assert.equal(prayerProblem([{ roll: 4, players: ['h2'] }], 1, candidates), null);
  });

  test('Bad Habits: il D3 decide quanti avversari', () => {
    assert.match(prayerProblem([{ roll: 6, players: ['a1'] }], 1, candidates)!, /D3/);
    assert.match(prayerProblem([{ roll: 6, d3: 2, players: ['a1'] }], 1, candidates)!, /select 2/);
    assert.match(prayerProblem([{ roll: 6, d3: 2, players: ['a1', 'a1'] }], 1, candidates)!, /twice/);
    assert.equal(prayerProblem([{ roll: 6, d3: 2, players: ['a1', 'a3'] }], 1, candidates), null);
  });

  test('con meno giocatori del D3 bastano quelli che ci sono', () => {
    const few = { ...candidates, opponent: ['a1'] };
    assert.equal(prayerProblem([{ roll: 6, d3: 3, players: ['a1'] }], 1, few), null);
  });

  test('Intensive Training: una skill Primary del giocatore scelto', () => {
    assert.match(prayerProblem([{ roll: 16, players: ['h1'] }], 1, candidates)!, /Primary skill/);
    assert.match(prayerProblem([{ roll: 16, players: ['h1'], skill: 'Dodge' }], 1, candidates)!, /not a Primary/);
    assert.equal(prayerProblem([{ roll: 16, players: ['h1'], skill: 'Guard' }], 1, candidates), null);
  });

  test('chi non sceglie giocatori non ne ha', () => {
    assert.match(prayerProblem([{ roll: 10, players: ['h1'] }], 1, candidates)!, /does not select/);
    assert.match(prayerProblem([{ roll: 4, players: ['h1'], skill: 'Block' }], 1, candidates)!, /does not choose a skill/);
  });
});

describe('SPP con le preghiere (p. 143)', () => {
  const base = { td: 0, cas: 0, int: 0, comp: 0, ttm: 0, landing: 0, mvp: 0 };

  test('senza preghiere: come sempre, e le statistiche delle preghiere non valgono niente', () => {
    assert.equal(sppEarned({ ...base, comp: 2, catches: 3, crowd_cas: 1, foul_cas: 1 }), 2);
    assert.deepEqual(prayerStatFields([]), []);
  });

  test('Perfect Passing: ogni Completion vale 2 SPP', () => {
    assert.equal(sppEarned({ ...base, comp: 3 }, { prayers: [{ roll: 10 }] }), 6);
  });

  test('Dazzling Catching, Fan Interaction e Fouling Frenzy', () => {
    const prayers = [{ roll: 11 }, { roll: 12 }, { roll: 13 }];
    assert.equal(sppEarned({ ...base, catches: 2 }, { prayers }), 2);
    assert.equal(sppEarned({ ...base, crowd_cas: 1 }, { prayers }), 2);
    assert.equal(sppEarned({ ...base, foul_cas: 2 }, { prayers }), 4);
    assert.deepEqual(prayerStatFields(prayers), ['catches', 'crowd_cas', 'foul_cas']);
  });

  test('Brawlin\' Brutes: la Casualty da Foul resta a 2 SPP come dice la preghiera', () => {
    assert.equal(sppEarned({ ...base, cas: 1, foul_cas: 1 }, { brawlinBrutes: true, prayers: [{ roll: 13 }] }), 5);
  });

  test('prayerSpp: valori per azione', () => {
    assert.deepEqual(prayerSpp(null), { completion: 1, catch: 0, crowd: 0, foul: 0 });
  });
});

describe('profili di partita', () => {
  test('Iron Man +1 AV fino a 11+, Greasy Cleats -1 MA fino a 1', () => {
    assert.deepEqual(profileWithPrayers(6, '9+', [{ prayer: 'Iron Man', team_id: 'h', av: 1 }]), { ma: 6, av: '10+', skills: [] });
    assert.deepEqual(profileWithPrayers(6, '11+', [{ prayer: 'Iron Man', team_id: 'h', av: 1 }]).av, '11+');
    assert.deepEqual(profileWithPrayers(1, '8+', [{ prayer: 'Greasy Cleats', team_id: 'a', ma: -1 }]).ma, 1);
  });

  test('gli effetti arrivano ai giocatori giusti, anche dalle preghiere avversarie', () => {
    const effects = prayerEffects({
      home: [{ roll: 5, players: ['h1'] }, { roll: 7, players: ['a2'] }],
      away: [{ roll: 16, players: ['a2'], skill: 'Block' }, { roll: 6, d3: 1, players: ['h1'] }],
    });
    assert.deepEqual(effects.get('h1')!.map(e => e.skill), ['Mighty Blow', 'Loner (2+)']);
    const a2 = profileWithPrayers(5, '10+', effects.get('a2')!);
    assert.deepEqual(a2, { ma: 4, av: '10+', skills: ['Block'] });
  });
});

describe('parsePrayers', () => {
  test('legge il JSON salvato e scarta quello che non torna', () => {
    assert.deepEqual(parsePrayers('[{"roll":4,"players":["h1"]},{"x":1},{"roll":16,"players":["h2"],"skill":" Guard "}]'),
        [{ roll: 4, players: ['h1'] }, { roll: 16, players: ['h2'], skill: 'Guard' }]);
    assert.deepEqual(parsePrayers('non è json'), []);
    assert.deepEqual(parsePrayers(null), []);
  });
});
