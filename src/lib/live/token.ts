// Chi scrive nel registro di una partita: l'admin (cookie di sessione) o un companion (token di squadra).
//
// Il token del companion vale per una sola partita e una sola squadra, e porta il nonce dell'abbinamento:
// "Scollega" dal web cambia il nonce, e il token del vecchio telefono smette di valere subito.

import crypto from 'crypto';
import { ADMIN_COOKIE, signData, verifyData, verifySessionToken } from '@/lib/auth';
import type { LiveActor } from './rules';

export const COMPANION_TOKEN_HOURS = 12;

type CompanionClaims = { m: string; t: string; n: string };

export const newNonce = () => crypto.randomBytes(12).toString('base64url');

// Codice di 6 caratteri da digitare (o nel QR): senza 0/O e 1/I, che al tavolo si confondono
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const newJoinCode = () => Array.from(crypto.randomBytes(6), b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
export const normalizeJoinCode = (v: unknown) => (typeof v === 'string' ? v.toUpperCase().replace(/[^A-Z0-9]/g, '') : '');

export const companionToken = (matchId: string, teamId: string, nonce: string) =>
  signData({ m: matchId, t: teamId, n: nonce } satisfies CompanionClaims, COMPANION_TOKEN_HOURS * 3600);

type LiveRow = { home_team_id: string; away_team_id: string; home_nonce: string | null; away_nonce: string | null; status: string };

function cookieValue(request: Request, name: string) {
  const header = request.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export const isAdminRequest = (request: Request) => verifySessionToken(cookieValue(request, ADMIN_COOKIE));

// L'attore della richiesta, o null se non può scrivere su questa partita.
// Una richiesta col token di squadra è sempre del companion, anche se il telefono ha il cookie admin
// (l'admin che gioca con la sua squadra): così vale lo stesso per tutti e uno scollegamento si vede.
export function liveActor(request: Request, matchId: string, live: LiveRow | null): LiveActor | null {
  const auth = request.headers.get('authorization') ?? '';
  if (!auth) return isAdminRequest(request) ? { role: 'admin' } : null;
  const claims = auth.startsWith('Bearer ') ? verifyData<CompanionClaims>(auth.slice(7)) : null;
  if (!claims || !live || claims.m !== matchId || live.status !== 'live') return null;
  const nonce = claims.t === live.home_team_id ? live.home_nonce : claims.t === live.away_team_id ? live.away_nonce : null;
  return nonce && nonce === claims.n ? { role: 'companion', teamId: claims.t } : null;
}
