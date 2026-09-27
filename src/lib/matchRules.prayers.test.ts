// Prayers to Nuffle dal pre-partita al referto, contro un database SQLite temporaneo (mai quello di produzione): npm test
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';
import { closeTestDb } from './live/testFixtures';

// Import dinamici: db.ts legge le variabili d'ambiente (impostate da testFixtures) appena caricato
const { default: db } = await import('@/lib/db');
const { applyPregame, applyResult, RuleError } = await import('./matchRules');
type PregameInput = import('./matchRules').PregameInput;

const H = 'humans';
const A = 'orcs';
const M = 'prayer-match';

// Umani con 10 giocatori (un Journeyman) e CTV più basso: la Petty Cash paga due preghiere.
// Orchi con 12 giocatori: una preghiera dalla Treasury.
before(async () => {
  await db.executeMultiple(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  const humans = Array.from({ length: 10 }, (_, i) =>
    `('h${i + 1}', '${H}', 'Umano ${i + 1}', 'Human Lineman', 'human-lineman', 50000, ${i + 1}, 6, 3, '3+', '4+', '9+', 'G')`);
  const orcs = Array.from({ length: 12 }, (_, i) =>
    `('a${i + 1}', '${A}', 'Orco ${i + 1}', 'Orc Lineman', 'orc-lineman', 50000, ${i + 1}, 5, 3, '3+', '4+', '10+', 'G, S')`);
  await db.batch([
    `INSERT INTO seasons (id, number, name, status) VALUES ('s1', 1, 'Stagione 1', 'active')`,
    `INSERT INTO teams (id, name, race, roster, rerolls, fan_factor, treasury) VALUES ('${H}', 'Umani', 'Human', 'human', 0, 2, 0)`,
    `INSERT INTO teams (id, name, race, roster, rerolls, fan_factor, treasury) VALUES ('${A}', 'Orchi', 'Orc', 'orc', 0, 2, 50000)`,
    `INSERT INTO players (id, team_id, name, role, position_key, value, jersey_number, ma, st, ag, pa, av, primary_skills) VALUES ${[...humans, ...orcs].join(', ')}`,
    `INSERT INTO matches (id, round, home_team_id, away_team_id, season_id, match_type) VALUES ('${M}', 1, '${H}', '${A}', 's1', 'League')`,
  ], 'write');
});
after(() => closeTestDb(db));

const pregame = (home: PregameInput['teams'][string]['prayers'], away: PregameInput['teams'][string]['prayers']): PregameInput => ({
  weather_roll: 7,
  kicking_team_id: A,
  teams: {
    [H]: { fair_weather: 2, journeyman_position: 'human-lineman', inducements: [{ key: 'prayers', qty: 2 }], prayers: home },
    [A]: { fair_weather: 1, inducements: [{ key: 'prayers', qty: 1 }], prayers: away },
  },
});
const ruleError = (pattern: RegExp) => (e: unknown) => e instanceof RuleError && pattern.test(e.message);
const reportPrayers = async (teamId: string) => {
  const { rows } = await db.execute({ sql: 'SELECT prayers FROM match_team_reports WHERE match_id = ? AND team_id = ?', args: [M, teamId] });
  return JSON.parse(String(rows[0].prayers));
};
const stats = (id: string, v: Partial<Record<string, number>>) =>
  ({ player_id: id, td: 0, cas: 0, int: 0, comp: 0, ttm: 0, landing: 0, mvp: 0, ...v });

describe('Prayers to Nuffle nel pre-partita', () => {
  test('senza tiro, con doppioni o con giocatori sbagliati non si salva', async () => {
    await assert.rejects(applyPregame(M, pregame(undefined, [{ roll: 9 }])), ruleError(/Umani: roll the D16/));
    await assert.rejects(applyPregame(M, pregame([{ roll: 9 }, { roll: 9 }], [{ roll: 9 }])), ruleError(/rolled twice/));
    await assert.rejects(applyPregame(M, pregame([{ roll: 10 }, { roll: 4, players: ['a1'] }], [{ roll: 9 }])), ruleError(/Iron Man/));
    await assert.rejects(applyPregame(M, pregame([{ roll: 10 }, { roll: 9 }], [{ roll: 6, d3: 2, players: ['a1', 'a2'] }])), ruleError(/Orchi: Bad Habits/));
  });

  test('si salvano per squadra; un Journeyman appena creato si può scegliere', async () => {
    await applyPregame(M, pregame([{ roll: 10 }, { roll: 4, players: ['journeyman:1'] }], [{ roll: 6, d3: 2, players: ['h1', 'h2'] }]));
    const { rows: [journeyman] } = await db.execute({ sql: `SELECT id FROM players WHERE team_id = ? AND journeyman = 1`, args: [H] });
    assert.deepEqual(await reportPrayers(H), [{ roll: 10 }, { roll: 4, players: [String(journeyman.id)] }]);
    assert.deepEqual(await reportPrayers(A), [{ roll: 6, d3: 2, players: ['h1', 'h2'] }]);
  });

  test('rifacendo il pre-partita il nuovo Journeyman prende il posto del vecchio', async () => {
    await applyPregame(M, pregame([{ roll: 10 }, { roll: 4, players: ['journeyman:1'] }], [{ roll: 16, players: ['a3'], skill: 'Guard' }]));
    const { rows } = await db.execute({ sql: `SELECT id FROM players WHERE team_id = ? AND journeyman = 1`, args: [H] });
    assert.equal(rows.length, 1);
    assert.deepEqual((await reportPrayers(H))[1].players, [String(rows[0].id)]);
    assert.deepEqual(await reportPrayers(A), [{ roll: 16, players: ['a3'], skill: 'Guard' }]);
  });
});

describe('Prayers to Nuffle nel referto', () => {
  const spp = async (playerId: string) =>
    Number((await db.execute({ sql: 'SELECT spp_earned FROM player_stats WHERE match_id = ? AND player_id = ?', args: [M, playerId] })).rows[0]?.spp_earned);

  test('le statistiche delle preghiere si segnano solo con la preghiera', async () => {
    await assert.rejects(applyResult(M, { outcome: 'played', playerStats: [stats('h3', { catches: 1 })] }), ruleError(/Dazzling Catching/));
  });

  test('Perfect Passing raddoppia gli SPP dei passaggi completati, solo per chi l\'ha tirato', async () => {
    await applyResult(M, { outcome: 'played', playerStats: [stats('h3', { comp: 2 }), stats('a1', { comp: 2 })] });
    assert.equal(await spp('h3'), 4);
    assert.equal(await spp('a1'), 2);
    const { rows: [player] } = await db.execute(`SELECT spp FROM players WHERE id = 'h3'`);
    assert.equal(Number(player.spp), 4);
  });
});
