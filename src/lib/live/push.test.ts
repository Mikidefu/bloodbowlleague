// Notifiche push: chi riceve cosa, e il ciclo sul database con un servizio push finto: npm test
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import { A, H, MATCH, closeTestDb, seedTestDb } from './testFixtures';
import { planPushes, MAX_PUSHES_PER_BATCH, type PushTarget } from './pushPlan';
import type { LiveEvent } from './types';

const { default: db } = await import('@/lib/db');
const server = await import('./server');
const push = await import('./push');

const names = { teams: { [H]: 'Casa', [A]: 'Ospiti' }, players: {} };
const ev = (type: LiveEvent['type'], team_id: string | null, payload: Record<string, unknown>, source: LiveEvent['source']): LiveEvent =>
  ({ id: randomUUID(), seq: 1, type, team_id, payload, source });
const kick = (winners: string[], requested_by: 'admin' | 'companion', kicking = A) =>
  ev('kickoff_rolled', kicking, { drive: 1, kicking_team_id: kicking, dice: [3, 4], total: 7, name: 'Brilliant Coaching', winners, requested_by }, 'server');
const target = (team_id: string, language: 'it' | 'en' = 'it'): PushTarget => ({ endpoint: `https://push.example/${team_id}`, team_id, language });

describe('planPushes', () => {
  test('Brilliant Coaching tirato dal telefono degli ospiti: la casa che vince riceve la notifica, gli ospiti no', () => {
    const e = kick([H], 'companion');
    const plan = planPushes(MATCH, [e], [e], [target(H), target(A)], names);
    assert.deepEqual(plan.map(p => p.target.team_id), [H]);
    assert.match(plan[0].message.body, /Hai vinto un Team Re-roll/);
    assert.equal(plan[0].message.url, `/companion/${MATCH}`);
    assert.equal(plan[0].message.title, 'Blood Bowl · Casa');
  });

  test('kick-off tirato dal web: lo sanno entrambi', () => {
    const e = kick([H], 'admin');
    assert.equal(planPushes(MATCH, [e], [e], [target(H), target(A)], names).length, 2);
  });

  test('ognuno nella sua lingua', () => {
    const e = kick([A], 'admin');
    const [en] = planPushes(MATCH, [e], [e], [target(A, 'en')], names);
    assert.match(en.message.body, /You won a Team Re-roll/);
  });

  test('le proprie azioni dal telefono non tornano indietro come notifica', () => {
    const e = ev('touchdown', H, {}, 'companion');
    assert.deepEqual(planPushes(MATCH, [e], [e], [target(H)], names), []);
    assert.equal(planPushes(MATCH, [e], [e], [target(A)], names).length, 1, 'l\'avversario invece lo sa');
  });

  test('tanti avvisi insieme (coda offline): un solo riepilogo', () => {
    const many = Array.from({ length: MAX_PUSHES_PER_BATCH + 2 }, () => ev('reroll_used', H, { kind: 'team' }, 'admin'));
    const plan = planPushes(MATCH, many, many, [target(H)], names);
    assert.equal(plan.length, 1);
    assert.match(plan[0].message.body, /^5 novità/);
  });
});

describe('cifratura vera (senza rete)', () => {
  test('con chiavi VAPID reali web-push prepara una richiesta cifrata per un abbonamento come quelli del browser', async () => {
    const { default: webpush } = await import('web-push');
    const { createECDH, randomBytes } = await import('node:crypto');
    const vapid = webpush.generateVAPIDKeys();
    const phone = createECDH('prime256v1');
    phone.generateKeys();
    const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/test', keys: { p256dh: phone.getPublicKey('base64url'), auth: randomBytes(16).toString('base64url') } };
    const details = webpush.generateRequestDetails(sub, JSON.stringify({ title: 't', body: 'b' }), {
      TTL: 600, urgency: 'high', vapidDetails: { subject: 'https://bloodbowlleaguetrivium.vercel.app', publicKey: vapid.publicKey, privateKey: vapid.privateKey },
    });
    assert.equal(details.method, 'POST');
    assert.equal(details.headers['Content-Encoding'], 'aes128gcm');
    assert.match(String(details.headers.Authorization), /^vapid t=.+, k=/);
    assert.ok((details.body as Buffer).length > 0);
  });
});

describe('abbonamenti e invio sul database', () => {
  const sent: { endpoint: string; payload: string }[] = [];
  const dead = new Set<string>();
  const fakeSend = async (sub: { endpoint: string }, payload: string) => {
    if (dead.has(sub.endpoint)) throw Object.assign(new Error('Gone'), { statusCode: 410 });
    sent.push({ endpoint: sub.endpoint, payload });
  };
  const subscription = (endpoint: string) => ({ endpoint, keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' } });
  const count = async () => Number((await db.execute('SELECT COUNT(*) AS n FROM push_subscriptions')).rows[0].n);

  before(async () => {
    await seedTestDb(db);
    await server.startLive(MATCH, () => 1);
  });
  after(() => closeTestDb(db));

  test('senza chiavi VAPID le notifiche sono spente e non si salva niente', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    assert.equal(push.pushPublicKey(), null);
    await assert.rejects(push.savePushSubscription(MATCH, H, { subscription: subscription('https://push.example/h') }), (e: { status?: number }) => e.status === 503);
    await push.sendLivePushes(MATCH, ['qualsiasi'], fakeSend);
    assert.equal(sent.length, 0);
  });

  test('abbonamento valido salvato; indirizzo non https rifiutato; lo stesso telefono si sposta, non si duplica', async () => {
    process.env.VAPID_PUBLIC_KEY = 'test-public';
    process.env.VAPID_PRIVATE_KEY = 'test-private';
    await push.savePushSubscription(MATCH, H, { subscription: subscription('https://push.example/h'), language: 'it' });
    await push.savePushSubscription(MATCH, A, { subscription: subscription('https://push.example/a') });
    await assert.rejects(push.savePushSubscription(MATCH, H, { subscription: subscription('http://push.example/x') }), (e: { status?: number }) => e.status === 400);
    await push.savePushSubscription(MATCH, H, { subscription: subscription('https://push.example/h'), language: 'en' });
    assert.equal(await count(), 2);
  });

  test('un kick-off del web arriva a entrambi; un abbonamento morto (410) si cancella', async () => {
    const id = randomUUID();
    await server.rollKickoff(MATCH, { role: 'admin' }, id, { dice: [3, 4], rolls: { [A]: 1, [H]: 6 } });
    dead.add('https://push.example/a');
    await push.sendLivePushes(MATCH, [id], fakeSend);
    assert.deepEqual(sent.map(s => s.endpoint), ['https://push.example/h']);
    assert.match(JSON.parse(sent[0].payload).body, /You won a Team Re-roll/, 'la casa si era abbonata in inglese');
    assert.equal(await count(), 1, 'l\'abbonamento degli ospiti (410) è stato tolto');
  });

  test('un errore del servizio push non rompe niente', async () => {
    const id = randomUUID();
    await server.recordEvents(MATCH, { role: 'admin' }, [{ id, type: 'bribe_used', team_id: A }]).catch(() => null);
    await push.sendLivePushes(MATCH, [id], async () => { throw new Error('rete giù'); });
  });

  test('scollegare la squadra toglie anche le sue notifiche', async () => {
    await server.unpairTeam(MATCH, H);
    assert.equal(await count(), 0);
  });
});
