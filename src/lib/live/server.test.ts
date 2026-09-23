// Partita dal vivo contro un database SQLite temporaneo (mai quello di produzione): npm test
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import { A, H, MATCH, closeTestDb, seedTestDb } from './testFixtures';

// Import dinamici: db.ts legge le variabili d'ambiente (impostate da testFixtures) appena caricato
const { default: db } = await import('@/lib/db');
const server = await import('./server');
const { liveActor } = await import('./token');
const { LiveRuleError } = await import('./rules');
type Actor = import('./rules').LiveActor;

const admin: Actor = { role: 'admin' };
const seq6 = (...values: number[]) => () => values.shift() ?? 6;

const bearer = (token: string) => new Request('http://test/api', { headers: { authorization: `Bearer ${token}` } });
const eventsOf = async (type: string) => (await server.loadEvents(MATCH)).filter(e => e.type === type);
const rejected = async (promise: Promise<unknown>, status: number) =>
  assert.rejects(promise, (e: unknown) => e instanceof LiveRuleError && e.status === status);

before(() => seedTestDb(db));
after(() => closeTestDb(db));

describe('partita dal vivo sul database', () => {
  let homeToken = '';

  test('avvio: fotografia di squadre e incentivi, tiri dello Chef, idempotente', async () => {
    await server.startLive(MATCH, seq6(4, 1, 5));      // Chef degli ospiti: 4, 1, 5 -> due reroll rubati
    await server.startLive(MATCH, seq6(6, 6, 6));      // seconda chiamata: non cambia niente
    const snap = (await server.liveSnapshot(MATCH, 0, true))!;
    assert.equal((await eventsOf('match_started')).length, 1);
    assert.equal(snap.state.setup!.teams[H].rerolls, 4, '3 + Extra Team Training');
    assert.equal(snap.state.setup!.teams[H].assistant_coaches, 3, '1 + 2 Part-time');
    assert.equal(snap.state.setup!.teams[H].fan_factor, 6, 'Fan Factor di partita');
    assert.equal(snap.state.setup!.teams[A].bribes, 1);
    assert.equal(snap.state.teams[A].rerolls, 4, '2 + 2 dello Chef');
    assert.equal(snap.state.teams[H].rerolls, 2, '4 - 2 rubati dallo Chef');
    assert.match(snap.live.join_code!, /^[A-Z2-9]{6}$/);
    assert.equal((await server.liveSnapshot(MATCH, 0, false))!.live.join_code, undefined, 'il codice lo vede solo l\'admin');
  });

  test('abbinamento: una squadra per telefono, rientro dello stesso telefono, scollegamento', async () => {
    const code = (await server.liveSnapshot(MATCH, 0, true))!.live.join_code!;
    const phone1 = randomUUID();
    const phone2 = randomUUID();
    const joined = await server.joinLive(code.toLowerCase(), H, phone1);
    homeToken = joined.token;
    await rejected(server.joinLive(code, H, phone2), 409);
    // Il telefono che ha preso la squadra la vede come sua (può rientrare), gli altri come presa
    const seenByOwner = await server.lookupJoinCode(code, phone1);
    const seenByOther = await server.lookupJoinCode(code, phone2);
    assert.deepEqual(seenByOwner.teams.map(t => [t.paired, t.mine]), [[false, true], [false, false]]);
    assert.deepEqual(seenByOther.teams.map(t => [t.paired, t.mine]), [[true, false], [false, false]]);
    const again = await server.joinLive(code, H, phone1);
    assert.deepEqual(liveActor(bearer(again.token), MATCH, await server.loadLive(MATCH)), { role: 'companion', teamId: H });
    await rejected(server.joinLive('ZZZZZZ', A, phone2), 404);
    await rejected(server.joinLive(code, 'altra-squadra', phone2), 400);

    // Scollegato dall'admin: il vecchio token non vale più, la squadra torna libera
    await server.unpairTeam(MATCH, H);
    assert.equal(liveActor(bearer(homeToken), MATCH, await server.loadLive(MATCH)), null);
    homeToken = (await server.joinLive(code, H, phone2)).token;
    assert.deepEqual(liveActor(bearer(homeToken), MATCH, await server.loadLive(MATCH)), { role: 'companion', teamId: H });
    assert.equal(liveActor(bearer(homeToken), 'altra-partita', await server.loadLive(MATCH)), null);
  });

  test('kick-off: solo chi calcia, uno solo per drive anche se chiesto due volte insieme', async () => {
    const home: Actor = { role: 'companion', teamId: H };
    await rejected(server.rollKickoff(MATCH, home, randomUUID()), 403);
    const away: Actor = { role: 'companion', teamId: A };
    const results = await Promise.allSettled([
      server.rollKickoff(MATCH, away, randomUUID(), { dice: [3, 4], rolls: { [A]: 2, [H]: 2 } }),
      server.rollKickoff(MATCH, admin, randomUUID(), { dice: [3, 4], rolls: { [A]: 2, [H]: 2 } }),
    ]);
    assert.equal((await eventsOf('kickoff_rolled')).length, 1);
    assert.ok(results.some(r => r.status === 'fulfilled' && r.value.status === 'ok'));
    const state = (await server.liveSnapshot(MATCH))!.state;
    // Brilliant Coaching: ospiti 2 + 0, casa 2 + 3 assistenti -> vince casa
    assert.deepEqual(state.last_kickoff!.winners, [H]);
    assert.equal(state.teams[H].drive_rerolls, 1);
    assert.equal(state.status, 'in_drive');
  });

  test('eventi: idempotenti per id, giocatore della squadra giusta, lotti con esiti separati', async () => {
    const home: Actor = { role: 'companion', teamId: H };
    const turn = { id: randomUUID(), type: 'turn_started' };
    const first = await server.recordEvents(MATCH, home, [turn]);
    const retry = await server.recordEvents(MATCH, home, [turn]);
    assert.equal(first[0].status, 'ok');
    assert.equal(retry[0].status, 'duplicate');
    assert.equal((await eventsOf('turn_started')).length, 1);

    const batch = await server.recordEvents(MATCH, home, [
      { id: randomUUID(), type: 'reroll_used', payload: { kind: 'drive' } },
      { id: randomUUID(), type: 'reroll_used', payload: { kind: 'drive' } },        // il reroll del drive era uno solo
      { id: randomUUID(), type: 'casualty', payload: { player_id: 'pa1' } },          // giocatore degli ospiti
      { id: randomUUID(), type: 'touchdown', payload: { player_id: 'ph1' } },
    ]);
    assert.deepEqual(batch.map(r => r.status), ['ok', 'rejected', 'rejected', 'ok']);
    const state = (await server.liveSnapshot(MATCH))!.state;
    assert.equal(state.teams[H].score, 1);
    assert.deepEqual(state.teams[H].stats.ph1, { touchdowns: 1 });
    assert.equal(state.kicking_team_id, H);
    const seqs = (await server.loadEvents(MATCH)).map(e => e.seq);
    assert.deepEqual(seqs, seqs.map((_, i) => i + 1), 'seq senza buchi né doppioni');
  });

  test('secondo tempo: reroll ricaricati e nuovi tiri dello Chef, un solo inizio tempo', async () => {
    const [a, b] = await Promise.all([
      server.recordEvents(MATCH, admin, [{ id: randomUUID(), type: 'half_started', payload: { half: 2, force: true } }], seq6(1, 1, 1)),
      server.recordEvents(MATCH, { role: 'companion', teamId: H }, [{ id: randomUUID(), type: 'half_started', payload: { half: 2, force: true } }], seq6(1, 1, 1)),
    ]);
    assert.equal((await eventsOf('half_started')).length, 1);
    // L'altra richiesta è un doppione (stesso stato letto) o rifiutata (ha letto il tempo già iniziato)
    const statuses = [a[0].status, b[0].status];
    assert.equal(statuses.filter(s => s === 'ok').length, 1);
    const state = (await server.liveSnapshot(MATCH))!.state;
    assert.equal(state.half, 2);
    assert.equal(state.teams[H].rerolls, 4, 'Chef a vuoto (1, 1, 1): reroll pieni');
    assert.equal(state.teams[A].rerolls, 2);
    assert.equal(state.kicking_team_id, H, 'calcia chi ha ricevuto nel primo tempo');
  });

  test('fine partita: i telefoni non scrivono più; riaprendo si riprende da dove si era', async () => {
    await server.endLive(MATCH);
    assert.equal(liveActor(bearer(homeToken), MATCH, await server.loadLive(MATCH)), null);
    const [r] = await server.recordEvents(MATCH, admin, [{ id: randomUUID(), type: 'casualty', team_id: H }]);
    assert.equal(r.status, 'rejected');
    await server.startLive(MATCH);
    const snap = (await server.liveSnapshot(MATCH))!;
    assert.equal(snap.live.status, 'live');
    assert.equal(snap.state.status, 'awaiting_kickoff');
    assert.equal(snap.state.teams[H].score, 1);
  });

  test('referto salvato: il live vale come chiuso e non accetta più niente', async () => {
    await db.execute({ sql: 'UPDATE matches SET is_played = 1 WHERE id = ?', args: [MATCH] });
    assert.equal((await server.loadLive(MATCH))!.status, 'ended');
    await rejected(server.recordEvents(MATCH, admin, [{ id: randomUUID(), type: 'casualty', team_id: H }]), 409);
    await rejected(server.rollKickoff(MATCH, admin, randomUUID()), 409);
    await rejected(server.startLive(MATCH), 409);
    await db.execute({ sql: 'UPDATE matches SET is_played = 0 WHERE id = ?', args: [MATCH] });
  });

  test('eliminare la partita elimina anche il live (ON DELETE CASCADE)', async () => {
    await db.execute({ sql: 'DELETE FROM match_team_reports WHERE match_id = ?', args: [MATCH] });
    await db.execute({ sql: 'DELETE FROM matches WHERE id = ?', args: [MATCH] });
    assert.equal(await server.loadLive(MATCH), null);
    assert.equal((await server.loadEvents(MATCH)).length, 0);
  });
});
