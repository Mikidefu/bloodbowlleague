'use client';
// Cosa ricorda il telefono: il suo id (per rientrare nella stessa squadra) e l'abbinamento alla partita.
// Tutto in localStorage, sempre dentro try/catch: in navigazione privata può non esserci.

import { newEventId } from './useLiveMatch';

export type CompanionSession = { match_id: string; team_id: string; token: string; code: string };

const DEVICE_KEY = 'bbl-companion-device';
const SESSION_KEY = 'bbl-companion-session';
export const queueKey = (matchId: string) => `bbl-companion-queue-${matchId}`;

// Senza localStorage la sessione vive in memoria: basta per passare dalla scelta della squadra al tabellone
let memory: CompanionSession | null = null;

export function deviceId(): string {
  try {
    const saved = localStorage.getItem(DEVICE_KEY);
    if (saved) return saved;
    const id = newEventId();
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return newEventId();
  }
}

// Il token scade (12 ore): la scadenza sta nel payload firmato, leggibile senza la chiave
function tokenExpired(token: string) {
  try {
    const payload = JSON.parse(atob(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export function readSession(): CompanionSession | null {
  let s: CompanionSession | null = memory;
  try { s = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') ?? memory; } catch { /* resta quella in memoria */ }
  return s && s.match_id && s.team_id && s.token && !tokenExpired(s.token) ? s : null;
}

export function saveSession(session: CompanionSession) {
  memory = session;
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* resta solo per questa pagina */ }
}

export function clearSession() {
  memory = null;
  try { localStorage.removeItem(SESSION_KEY); } catch { /* niente da togliere */ }
}
