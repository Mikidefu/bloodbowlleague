// Partita Non classificata: si gioca come in campionato ma alla fine resta solo il risultato.
// Contro un database SQLite temporaneo (mai quello di produzione): npm test
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';
import { closeTestDb } from './live/testFixtures';

// Import dinamici: db.ts legge le variabili d'ambiente (impostate da testFixtures) appena caricato
const { default: db } = await import('@/lib/db');
const { applyPregame, applyResult, deleteMatchStatements, simulateResult, RuleError } = await import('./matchRules');
const { computeStandings } = await import('./standings');
const { liveStartPayload } = await import('./live/setup');
type ResultInput = import('./matchRules').ResultInput;

const H = 'humans';    // 10 giocatori disponibili + uno che salta la partita: serve un Journeyman
const A = 'orcs';      // 12 giocatori, post-partita di lega ancora aperto, un giocatore con un avanzamento obbligatorio
const C = 'orcs-2';    // 12 giocatori
const U1 = 'unranked-1';
const U2 = 'unranked-2';
const L1 = 'league-1';  // A-C, già giocata: A deve ancora tirare gli Expensive Mistakes
const L2 = 'league-2';  // H-C, da giocare

const players = (team: string, prefix: string, n: number, pos: string, ma: number, av: string) =>
  Array.from({ length: n }, (_, i) => `('${prefix}${i + 1}', '${team}', '${prefix.toUpperCase()}${i + 1}', 'Lineman', '${pos}', 50000, ${i + 1}, ${ma}, 3, '3+', '4+', '${av}')`);

before(async () => {
  await db.executeMultiple(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  await db.execute('PRAGMA foreign_keys = ON');
  await db.batch([
    `INSERT INTO seasons (id, number, name, status) VALUES ('s1', 1, 'Stagione 1', 'active')`,
    `INSERT INTO teams (id, name, race, roster, fan_factor, treasury) VALUES ('${H}', 'Umani', 'Human', 'human', 3, 100000)`,
    `INSERT INTO teams (id, name, race, roster, fan_factor, treasury) VALUES ('${A}', 'Orchi', 'Orc', 'orc', 2, 150000)`,
    `INSERT INTO teams (id, name, race, roster, fan_factor, treasury) VALUES ('${C}', 'Altri Orchi', 'Orc', 'orc', 2, 0)`,
    `INSERT INTO season_teams (season_id, team_id) VALUES ('s1', '${H}'), ('s1', '${A}'), ('s1', '${C}')`,
    `INSERT INTO players (id, team_id, name, role, position_key, value, jersey_number, ma, st, ag, pa, av) VALUES
       ${[...players(H, 'h', 10, 'human-lineman', 6, '9+'), ...players(A, 'a', 12, 'orc-lineman', 5, '10+'), ...players(C, 'c', 12, 'orc-lineman', 5, '10+')].join(', ')}`,
    `INSERT INTO players (id, team_id, name, role, position_key, value, jersey_number, mng, mng_match_id, status)
       VALUES ('h11', '${H}', 'H11', 'Lineman', 'human-lineman', 50000, 11, 1, 'old-match', 'Injured')`,
    // 15 SPP senza avanzamenti: in campionato dovrebbe prima prendere un avanzamento (p. 96)
    `UPDATE players SET spp = 15, spp_base = 15 WHERE id = 'a1'`,
    `INSERT INTO matches (id, round, home_team_id, away_team_id, season_id, match_type, is_played, rules_applied, pregame_done, home_score, away_score)
       VALUES ('${L1}', 1, '${A}', '${C}', 's1', 'League', 1, 1, 1, 1, 0)`,
    `INSERT INTO match_team_reports (match_id, team_id, fan_factor) VALUES ('${L1}', '${A}', 3)`,
    `INSERT INTO match_team_reports (match_id, team_id, fan_factor, mistake_result) VALUES ('${L1}', '${C}', 3, 'skipped')`,
    `INSERT INTO matches (id, round, home_team_id, away_team_id, season_id, match_type) VALUES ('${U1}', 0, '${H}', '${A}', 's1', 'Unranked')`,
    `INSERT INTO matches (id, round, home_team_id, away_team_id, season_id, match_type) VALUES ('${U2}', 0, '${A}', '${H}', 's1', 'Unranked')`,
    `INSERT INTO matches (id, round, home_team_id, away_team_id, season_id, match_type) VALUES ('${L2}', 2, '${H}', '${C}', 's1', 'League')`,
  ], 'write');
});
after(() => closeTestDb(db));

const ruleError = (pattern: RegExp) => (e: unknown) => e instanceof RuleError && pattern.test(e.message);
const one = async (sql: string, args: (string | number)[] = []) => (await db.execute({ sql, args })).rows[0];
const count = async (sql: string, args: (string | number)[] = []) => Number((await one(sql, args)).n);
const treasury = async (id: string) => Number((await one('SELECT treasury FROM teams WHERE id = ?', [id])).treasury);
const journeymen = (matchId: string) => count('SELECT COUNT(*) AS n FROM players WHERE journeyman = 1 AND journeyman_match_id = ?', [matchId]);

// Gli Orchi hanno il CTV più alto (600.000 contro 550.000): comprano Extra Team Training dalla Treasury,
// gli Umani usano la Petty Cash
const unrankedPregame = {
  weather_roll: 7,
  kicking_team_id: A,
  teams: {
    [H]: { fair_weather: 2, journeyman_position: 'human-lineman', inducements: [{ key: 'part_time_assistant_coaches', qty: 2 }] },
    [A]: { fair_weather: 1, inducements: [{ key: 'extra_team_training', qty: 1 }] },
  },
};

const report: ResultInput = {
  outcome: 'played',
  home_score: 2, away_score: 1, home_casualties: 1, away_casualties: 0,
  playerStats: [
    { player_id: 'h1', td: 2, cas: 0, int: 0, comp: 0, ttm: 0, landing: 0, mvp: 1 },
    { player_id: 'h2', td: 0, cas: 0, int: 0, comp: 0, ttm: 0, landing: 0, mvp: 0, injury: { result: 'DEAD' } },
    { player_id: 'a2', td: 1, cas: 0, int: 0, comp: 0, ttm: 0, landing: 0, mvp: 0 },
    { player_id: 'a3', td: 0, cas: 0, int: 0, comp: 0, ttm: 0, landing: 0, mvp: 1, injury: { result: 'LI', stat: 'ma' } },
  ],
  teams: { [H]: { df_roll: 6 }, [A]: { df_roll: 1 } },
};

describe('Pre-partita di una Non classificata', () => {
  test('non aspetta il post-partita di lega e non scala la Treasury', async () => {
    await applyPregame(U1, unrankedPregame);
    assert.equal(await treasury(A), 150000);
    assert.equal(await treasury(H), 100000);
    const orcs = await one('SELECT treasury_spent, ctv FROM match_team_reports WHERE match_id = ? AND team_id = ?', [U1, A]);
    assert.equal(Number(orcs.treasury_spent), 100000);
    const humans = await one('SELECT petty_cash, ctv FROM match_team_reports WHERE match_id = ? AND team_id = ?', [U1, H]);
    assert.equal(Number(humans.petty_cash), 150000);
    assert.equal(Number(humans.ctv), 550000);
    assert.equal(await journeymen(U1), 1);
  });

  test('rifacendolo la Treasury resta la stessa (non c\'è niente da restituire)', async () => {
    await applyPregame(U1, unrankedPregame);
    assert.equal(await treasury(A), 150000);
    assert.equal(await journeymen(U1), 1);
  });

  test('una partita di lega in parallelo non conta i Journeymen della Non classificata', async () => {
    await applyPregame(L2, { weather_roll: 7, kicking_team_id: C, teams: { [H]: { fair_weather: 1, journeyman_position: 'human-lineman' }, [C]: { fair_weather: 1 } } });
    const humans = await one('SELECT ctv FROM match_team_reports WHERE match_id = ? AND team_id = ?', [L2, H]);
    assert.equal(Number(humans.ctv), 550000);
    assert.equal(await journeymen(L2), 1);
  });

  test('la partita dal vivo non prevede supplementari', () => {
    const match = { home_team_id: H, away_team_id: A, kicking_team_id: A, match_type: 'Unranked' };
    assert.equal(liveStartPayload(match, new Map(), new Map()).knockout, false);
  });
});

describe('Referto di una Non classificata', () => {
  test('la simulazione fa i conti del campionato senza scrivere niente', async () => {
    const sim = await simulateResult(U1, report);
    assert.equal(sim.home_score, 2);
    assert.equal(sim.away_score, 1);
    const humans = sim.teams.find(t => t.team_id === H)!;
    const orcs = sim.teams.find(t => t.team_id === A)!;
    // Fan Attendance 8 (5 + 3): metà più i TD, più 1 senza Stalling, per 10.000
    assert.deepEqual([humans.result, humans.winnings, humans.dedicated_fans, humans.df_change], ['win', 70000, 3, 1]);
    assert.deepEqual([orcs.result, orcs.winnings, orcs.dedicated_fans, orcs.df_change], ['loss', 60000, 2, -1]);
    const h1 = sim.players.find(p => p.player_id === 'h1')!;
    assert.deepEqual([h1.spp, h1.spp_earned, h1.mvp, h1.can_advance], [0, 10, true, true]);
    assert.equal(sim.players.find(p => p.player_id === 'a2')!.spp_earned, 2);   // Brawlin' Brutes: TD a 2 SPP
    assert.deepEqual(sim.players.find(p => p.player_id === 'a3')!.injury, { result: 'LI', stat: 'ma', applied: true, hatred: null });
    assert.equal(sim.players.find(p => p.player_id === 'h2')!.injury?.result, 'DEAD');

    assert.equal(await count('SELECT COUNT(*) AS n FROM player_stats WHERE match_id = ?', [U1]), 0);
    assert.equal(Number((await one(`SELECT ma FROM players WHERE id = 'a3'`)).ma), 5);
    assert.equal(Number((await one(`SELECT is_played FROM matches WHERE id = ?`, [U1])).is_played), 0);
  });

  test('una Non classificata si gioca o si concede: non esiste "non giocata"', async () => {
    await assert.rejects(simulateResult(U1, { ...report, outcome: 'forfeit_both' }), ruleError(/either played or conceded/));
  });

  test('il referto sbagliato si rifiuta come in campionato', async () => {
    const twoMvps = { ...report, playerStats: [...report.playerStats!, { player_id: 'h3', td: 0, cas: 0, int: 0, comp: 0, ttm: 0, landing: 0, mvp: 1 }] };
    await assert.rejects(simulateResult(U1, twoMvps), ruleError(/at most 1 MVP/));
  });

  test('chiudendola resta solo il risultato', async () => {
    await db.batch([
      `INSERT INTO match_live (match_id, join_code) VALUES ('${U1}', 'ABC123')`,
      `INSERT INTO match_events (id, match_id, seq, type, source) VALUES ('e1', '${U1}', 1, 'match_started', 'server')`,
      `INSERT INTO push_subscriptions (endpoint, match_id, team_id, p256dh, auth) VALUES ('https://push.example/1', '${U1}', '${H}', 'k', 'a')`,
    ], 'write');
    const sim = await applyResult(U1, { ...report, match_date: '2026-09-28T21:00' });
    assert.equal(sim?.teams.find(t => t.team_id === H)?.winnings, 70000);

    const match = await one('SELECT * FROM matches WHERE id = ?', [U1]);
    assert.deepEqual(
      [match.is_played, match.rules_applied, match.home_score, match.away_score, match.home_casualties, match.outcome, match.match_date].map(v => (typeof v === 'bigint' ? Number(v) : v)),
      [1, 0, 2, 1, 1, 'played', '2026-09-28T21:00'],
    );
    for (const table of ['match_team_reports', 'player_stats', 'player_injuries', 'match_live', 'match_events', 'push_subscriptions']) {
      assert.equal(await count(`SELECT COUNT(*) AS n FROM ${table} WHERE match_id = ?`, [U1]), 0, table);
    }
    // I Journeymen della Non classificata se ne vanno, quelli della partita di lega restano
    assert.equal(await journeymen(U1), 0);
    assert.equal(await journeymen(L2), 1);
    // Squadre e giocatori come prima
    assert.deepEqual([await treasury(H), await treasury(A)], [100000, 150000]);
    const fans = await db.execute(`SELECT id, fan_factor FROM teams WHERE id IN ('${H}', '${A}') ORDER BY id`);
    assert.deepEqual(fans.rows.map(r => [r.id, Number(r.fan_factor)]), [[H, 3], [A, 2]]);
    const touched = await db.execute(`SELECT id, spp, ma, dead, mng, mng_match_id FROM players WHERE id IN ('h1', 'h2', 'a3', 'h11') ORDER BY id`);
    assert.deepEqual(touched.rows.map(r => [r.id, Number(r.spp), Number(r.ma), Number(r.dead), Number(r.mng), r.mng_match_id]), [
      ['a3', 0, 5, 0, 0, null], ['h1', 0, 6, 0, 0, null], ['h11', 0, 6, 0, 1, 'old-match'], ['h2', 0, 6, 0, 0, null],
    ]);
  });

  test('non conta in classifica', async () => {
    const standings = await computeStandings('s1');
    const played = Object.fromEntries(standings.map(s => [s.id, s.played]));
    assert.deepEqual(played, { [H]: 0, [A]: 1, [C]: 1 });
  });

  test('chiusa, si corregge solo il punteggio', async () => {
    await assert.rejects(simulateResult(U1, report), ruleError(/already closed/));
    await applyResult(U1, { ...report, home_score: 3, away_score: 1, home_casualties: 2, away_casualties: 0 });
    const match = await one('SELECT home_score, away_score, home_casualties, is_played FROM matches WHERE id = ?', [U1]);
    assert.deepEqual([match.home_score, match.away_score, match.home_casualties, match.is_played].map(Number), [3, 1, 2, 1]);
    assert.equal(await count('SELECT COUNT(*) AS n FROM player_stats WHERE match_id = ?', [U1]), 0);
  });
});

describe('Eliminare una Non classificata', () => {
  test('a metà partita non restituisce Treasury mai spesa', async () => {
    const pregame = {
      weather_roll: 7, kicking_team_id: H,
      teams: {
        [A]: { fair_weather: 1, inducements: [{ key: 'extra_team_training', qty: 1 }] },
        [H]: { fair_weather: 1, journeyman_position: 'human-lineman' },
      },
    };
    await applyPregame(U2, pregame);
    assert.equal(await treasury(A), 150000);
    await db.batch(await deleteMatchStatements(U2), 'write');
    assert.equal(await treasury(A), 150000);
    assert.equal(await journeymen(U2), 0);
    assert.equal(await journeymen(L2), 1);
    assert.equal(await count('SELECT COUNT(*) AS n FROM matches WHERE id = ?', [U2]), 0);
  });
});
