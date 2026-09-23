// Parti comuni delle route /api/live: errori, stagione bloccata, chi sta scrivendo.

import { NextResponse, after } from 'next/server';
import { lockedMatchResponse } from '@/lib/matchApi';
import { LiveRuleError, type LiveActor } from './rules';
import { loadLive } from './server';
import { liveActor } from './token';

export const NO_STORE = { 'Cache-Control': 'no-store' };

// Lavoro da fare dopo la risposta (notifiche push). Fuori da una richiesta Next (nei test) si fa subito.
export function afterResponse(task: () => Promise<unknown>) {
  try {
    after(task);
  } catch {
    void task();
  }
}

export function liveErrorResponse(error: unknown, what: string) {
  if (error instanceof LiveRuleError) return NextResponse.json({ error: error.message }, { status: error.status, headers: NO_STORE });
  console.error(`Live match: failed to ${what}:`, error);
  return NextResponse.json({ error: `Failed to ${what}` }, { status: 500, headers: NO_STORE });
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  } catch {
    return {};
  }
}

export const sinceParam = (request: Request) => Math.max(0, Number(new URL(request.url).searchParams.get('since')) || 0);

// Scrittura su una partita dal vivo: stagione attiva, e admin o telefono abbinato a quella partita.
// Restituisce l'attore, oppure la risposta d'errore da inviare.
export async function writerOf(request: Request, matchId: string): Promise<LiveActor | NextResponse> {
  const locked = await lockedMatchResponse(matchId);
  if (locked) return locked;
  const actor = liveActor(request, matchId, await loadLive(matchId));
  return actor ?? NextResponse.json({ error: 'Not paired with this match: scan the code again' }, { status: 401, headers: NO_STORE });
}
