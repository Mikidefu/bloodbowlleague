// Notifiche push della companion con l'app chiusa (Web Push con chiavi VAPID). Solo server.
//
// Senza VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY la funzione è semplicemente spenta: la companion non offre
// l'opzione e nessuna scrittura fallisce. Un invio che non riesce non tocca mai la partita: si registra e basta,
// e gli abbonamenti che il servizio push dà per morti (404/410) si cancellano.

import webpush from 'web-push';
import db from '@/lib/db';
import { LiveRuleError } from './rules';
import { planPushes, type PushMessage, type PushTarget } from './pushPlan';
import { loadEvents } from './server';

type Row = Record<string, unknown>;
export type PushSender = (subscription: webpush.PushSubscription, payload: string) => Promise<unknown>;

// Chi gestisce i servizi push (Google, Apple, Mozilla) vuole un contatto: basta l'indirizzo del sito
const DEFAULT_SUBJECT = 'https://bloodbowlleaguetrivium.vercel.app';
const TTL_SECONDS = 600;   // una notifica di partita vecchia di 10 minuti non serve più

export const pushPublicKey = () => (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY ? process.env.VAPID_PUBLIC_KEY : null);

const fail = (message: string, status = 400): never => { throw new LiveRuleError(message, status); };
const isB64url = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max && /^[A-Za-z0-9_-]+=*$/.test(v);

export async function savePushSubscription(matchId: string, teamId: string, body: Record<string, unknown>) {
  if (!pushPublicKey()) fail('Push notifications are not configured', 503);
  const sub = body.subscription as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | undefined;
  const endpoint = sub?.endpoint;
  if (typeof endpoint !== 'string' || endpoint.length > 1000 || !endpoint.startsWith('https://')) fail('Invalid push subscription');
  if (!isB64url(sub?.keys?.p256dh, 200) || !isB64url(sub?.keys?.auth, 100)) fail('Invalid push subscription keys');
  const language = body.language === 'en' ? 'en' : 'it';
  // Lo stesso telefono che segue un'altra partita (o squadra) sposta il suo abbonamento: uno per telefono
  await db.execute({
    sql: `INSERT INTO push_subscriptions (endpoint, match_id, team_id, p256dh, auth, language) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(endpoint) DO UPDATE SET match_id = excluded.match_id, team_id = excluded.team_id,
            p256dh = excluded.p256dh, auth = excluded.auth, language = excluded.language, created_at = CURRENT_TIMESTAMP`,
    args: [endpoint as string, matchId, teamId, sub!.keys!.p256dh as string, sub!.keys!.auth as string, language],
  });
}

export async function deletePushSubscription(matchId: string, teamId: string, endpoint: unknown) {
  if (typeof endpoint !== 'string') fail('Invalid push subscription');
  await db.execute({ sql: 'DELETE FROM push_subscriptions WHERE endpoint = ? AND match_id = ? AND team_id = ?', args: [endpoint as string, matchId, teamId] });
}

// Invia gli avvisi per gli eventi appena registrati (e quelli derivati, es. i tiri dello Chef). Non lancia mai.
export async function sendLivePushes(matchId: string, eventIds: string[], send?: PushSender) {
  try {
    const publicKey = pushPublicKey();
    if (!publicKey || !eventIds.length) return;
    const { rows: subs } = await db.execute({ sql: 'SELECT * FROM push_subscriptions WHERE match_id = ?', args: [matchId] });
    if (!subs.length) return;

    const [events, names] = await Promise.all([loadEvents(matchId), loadNames(matchId)]);
    const ids = new Set(eventIds);
    const fresh = events.filter(e => ids.has(e.id) || ids.has(String(e.payload.cause ?? '')));
    const targets: (PushTarget & { keys: { p256dh: string; auth: string } })[] = subs.map((s: Row) => ({
      endpoint: String(s.endpoint), team_id: String(s.team_id), language: s.language === 'en' ? 'en' : 'it',
      keys: { p256dh: String(s.p256dh), auth: String(s.auth) },
    }));
    const plan = planPushes(matchId, fresh, events, targets, names);
    const sender = send ?? defaultSender(publicKey);

    await Promise.all(plan.map(async ({ target, message }) => {
      const full = targets.find(t => t.endpoint === target.endpoint)!;
      try {
        await sender({ endpoint: full.endpoint, keys: full.keys }, JSON.stringify(message satisfies PushMessage));
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.execute({ sql: 'DELETE FROM push_subscriptions WHERE endpoint = ?', args: [full.endpoint] });
        } else {
          console.error('Live match: push notification failed:', status ?? error);
        }
      }
    }));
  } catch (error) {
    console.error('Live match: push notifications skipped:', error);
  }
}

function defaultSender(publicKey: string): PushSender {
  const vapidDetails = { subject: process.env.VAPID_SUBJECT || DEFAULT_SUBJECT, publicKey, privateKey: process.env.VAPID_PRIVATE_KEY! };
  return (subscription, payload) => webpush.sendNotification(subscription, payload, { TTL: TTL_SECONDS, urgency: 'high', vapidDetails });
}

async function loadNames(matchId: string) {
  const [teams, players] = await Promise.all([
    db.execute({ sql: 'SELECT t.id, t.name FROM teams t JOIN matches m ON t.id IN (m.home_team_id, m.away_team_id) WHERE m.id = ?', args: [matchId] }),
    db.execute({ sql: 'SELECT p.id, p.name FROM players p JOIN matches m ON p.team_id IN (m.home_team_id, m.away_team_id) WHERE m.id = ?', args: [matchId] }),
  ]);
  return {
    teams: Object.fromEntries(teams.rows.map(r => [String(r.id), String(r.name)])),
    players: Object.fromEntries(players.rows.map(r => [String(r.id), String(r.name)])),
  };
}
