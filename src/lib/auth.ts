import crypto from 'crypto';

// Sessione admin stateless: il cookie contiene "<scadenza>.<firma HMAC>".
// La chiave deriva da ADMIN_PASSWORD, quindi cambiando la password tutte le sessioni decadono.
export const ADMIN_COOKIE = 'bbl_admin';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 giorni, in secondi

function getKey(): Buffer | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  return crypto.createHash('sha256').update(`bbl-session:${password}`).digest();
}

function sign(payload: string, key: Buffer) {
  return crypto.createHmac('sha256', key).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

export function isAuthConfigured() {
  return !!process.env.ADMIN_PASSWORD;
}

export function checkPassword(candidate: string) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  // Confronto tra hash per evitare di rivelare la lunghezza della password
  const a = crypto.createHash('sha256').update(candidate).digest('hex');
  const b = crypto.createHash('sha256').update(password).digest('hex');
  return safeEqual(a, b);
}

export function createSessionToken() {
  const key = getKey();
  if (!key) throw new Error('ADMIN_PASSWORD is not set');
  const expires = String(Math.floor(Date.now() / 1000) + SESSION_MAX_AGE);
  return `${expires}.${sign(expires, key)}`;
}

export function verifySessionToken(token: string | undefined) {
  const key = getKey();
  if (!key || !token) return false;
  const [expires, signature] = token.split('.');
  if (!expires || !signature) return false;
  if (Number(expires) < Date.now() / 1000) return false;
  return safeEqual(signature, sign(expires, key));
}

// Dati firmati a breve scadenza (usati per i tiri degli avanzamenti: il server tira,
// il giocatore sceglie tra i risultati e il server verifica che siano davvero i suoi).
export function signData(data: unknown, maxAgeSeconds = 900) {
  const key = getKey();
  if (!key) throw new Error('ADMIN_PASSWORD is not set');
  const payload = Buffer.from(JSON.stringify({ d: data, exp: Math.floor(Date.now() / 1000) + maxAgeSeconds })).toString('base64url');
  return `${payload}.${sign(payload, key)}`;
}

export function verifyData<T>(token: string | undefined): T | null {
  const key = getKey();
  if (!key || !token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !safeEqual(signature, sign(payload, key))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { d: T; exp: number };
    return parsed.exp > Date.now() / 1000 ? parsed.d : null;
  } catch {
    return null;
  }
}
