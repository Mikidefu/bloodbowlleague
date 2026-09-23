// Route /api/live con proxy davanti, come le vede un telefono o il browser dell'admin: npm test
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import { A, H, MATCH, closeTestDb, seedTestDb } from '@/lib/live/testFixtures';

const { default: db } = await import('@/lib/db');
const { NextRequest } = await import('next/server');
const { proxy } = await import('@/proxy');
const { ADMIN_COOKIE, createSessionToken } = await import('@/lib/auth');
const live = await import('./[matchId]/route');
const start = await import('./[matchId]/start/route');
const events = await import('./[matchId]/events/route');
const kickoff = await import('./[matchId]/kickoff/route');
const leave = await import('./[matchId]/leave/route');
const end = await import('./[matchId]/end/route');
const join = await import('./join/route');

type Handler = (request: Request, ctx: { params: Promise<{ matchId: string }> }) => Promise<Response>;
type Call = { method?: string; body?: unknown; token?: string; admin?: boolean };

// Una richiesta passa prima dal proxy (come in produzione), poi dalla route
async function call(path: string, handler: Handler | ((request: Request) => Promise<Response>), { method = 'POST', body, token, admin }: Call = {}) {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (admin) headers.set('cookie', `${ADMIN_COOKIE}=${createSessionToken()}`);
  const init = { method, headers, body: body === undefined ? undefined : JSON.stringify(body) };
  const url = `http://localhost${path}`;
  const gate = proxy(new NextRequest(url, init));
  if (gate.status !== 200) return { status: gate.status, json: await gate.json() };
  const response = await (handler as Handler)(new Request(url, init), { params: Promise.resolve({ matchId: MATCH }) });
  return { status: response.status, json: await response.json() };
}

before(() => seedTestDb(db));
after(() => closeTestDb(db));

describe('/api/live', () => {
  let code = '';
  let awayToken = '';

  test('prima dell\'avvio la lettura risponde 200 con live null (non è un errore)', async () => {
    const res = await call(`/api/live/${MATCH}`, live.GET, { method: 'GET' });
    assert.equal(res.status, 200);
    assert.equal(res.json.live, null);
  });

  test('avvio solo admin: il proxy blocca chiunque altro', async () => {
    const anonymous = await call(`/api/live/${MATCH}/start`, start.POST);
    assert.equal(anonymous.status, 401);
    const res = await call(`/api/live/${MATCH}/start`, start.POST, { admin: true });
    assert.equal(res.status, 200);
    code = res.json.live.join_code;
    assert.match(code, /^[A-Z2-9]{6}$/);
  });

  test('lettura pubblica senza codice di abbinamento', async () => {
    const res = await call(`/api/live/${MATCH}?since=0`, live.GET, { method: 'GET' });
    assert.equal(res.status, 200);
    assert.equal(res.json.live.join_code, undefined);
    assert.equal(res.json.state.status, 'awaiting_kickoff');
  });

  test('il telefono entra col codice e scrive solo per la sua squadra', async () => {
    const joined = await call('/api/live/join', join.POST, { body: { code, team_id: A, device_id: randomUUID() } });
    assert.equal(joined.status, 200);
    awayToken = joined.json.token;

    const noToken = await call(`/api/live/${MATCH}/events`, events.POST, { body: { id: randomUUID(), type: 'casualty' } });
    assert.equal(noToken.status, 401);

    const kick = await call(`/api/live/${MATCH}/kickoff?since=0`, kickoff.POST, { token: awayToken, body: { id: randomUUID() } });
    assert.equal(kick.status, 200);
    assert.equal(kick.json.status, 'ok');
    assert.equal(kick.json.state.status, 'in_drive');

    const other = await call(`/api/live/${MATCH}/events`, events.POST, { token: awayToken, body: { id: randomUUID(), type: 'casualty', team_id: H } });
    assert.equal(other.json.results[0].status, 'rejected');

    const since = kick.json.seq;
    const mine = await call(`/api/live/${MATCH}/events?since=${since}`, events.POST, { token: awayToken, body: { events: [{ id: randomUUID(), type: 'casualty', payload: { player_id: 'pa1' } }] } });
    assert.equal(mine.json.results[0].status, 'ok');
    assert.deepEqual(mine.json.events.map((e: { type: string }) => e.type), ['casualty'], 'solo gli eventi dopo since');
  });

  test('token falsificato: rifiutato (quello di un\'altra partita lo verifica server.test.ts)', async () => {
    const forged = await call(`/api/live/${MATCH}/events`, events.POST, { token: `${awayToken}x`, body: { id: randomUUID(), type: 'casualty' } });
    assert.equal(forged.status, 401);
  });

  test('col token di squadra vale il telefono anche se c\'è il cookie admin', async () => {
    const both = await call(`/api/live/${MATCH}/events`, events.POST, { token: awayToken, admin: true, body: { id: randomUUID(), type: 'casualty', team_id: H } });
    assert.equal(both.json.results[0].status, 'rejected', 'il telefono degli ospiti non scrive per la casa, cookie admin o no');
    const read = await call(`/api/live/${MATCH}`, live.GET, { method: 'GET', token: awayToken, admin: true });
    assert.equal(read.json.me, A);
    assert.equal(read.json.live.join_code, undefined);
  });

  test('avvio, chiusura e scollegamento restano chiusi ai telefoni', async () => {
    for (const path of ['start', 'end', 'unpair']) {
      const res = await call(`/api/live/${MATCH}/${path}`, start.POST, { token: awayToken, body: {} });
      assert.equal(res.status, 401, path);
    }
  });

  test('regole di gioco dal telefono: errore con codice, da tradurre', async () => {
    const res = await call(`/api/live/${MATCH}/events`, events.POST, { token: awayToken, body: { id: randomUUID(), type: 'turn_started' } });
    assert.equal(res.json.results[0].status, 'rejected');
    assert.equal(res.json.results[0].code, 'not_your_turn', 'dopo il kick-off tocca a chi riceve');
    assert.equal(res.json.results[0].params.team, H);
  });

  test('il telefono lascia la squadra e il suo token smette di valere', async () => {
    assert.equal((await call(`/api/live/${MATCH}/leave`, leave.POST, { token: awayToken })).status, 200);
    const after = await call(`/api/live/${MATCH}/events`, events.POST, { token: awayToken, body: { id: randomUUID(), type: 'casualty' } });
    assert.equal(after.status, 401);
  });

  test('partita chiusa: il telefono riceve "partita chiusa" (409), non "scollegato"', async () => {
    const found = (await call('/api/live/join?code=' + code, join.GET as unknown as Handler, { method: 'GET' })).json;
    assert.ok(found.teams);
    const joined = await call('/api/live/join', join.POST, { body: { code, team_id: H, device_id: randomUUID() } });
    await call(`/api/live/${MATCH}/end`, end.POST, { admin: true });
    const res = await call(`/api/live/${MATCH}/events`, events.POST, { token: joined.json.token, body: { id: randomUUID(), type: 'casualty' } });
    assert.equal(res.status, 409);
    assert.equal(res.json.code, 'match_ended');
  });
});
