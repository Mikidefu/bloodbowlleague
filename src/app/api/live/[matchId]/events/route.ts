import { NextResponse } from 'next/server';
import { NO_STORE, liveErrorResponse, readJson, sinceParam, writerOf } from '@/lib/live/api';
import type { ClientEventInput } from '@/lib/live/rules';
import { liveSnapshot, recordEvents } from '@/lib/live/server';

// Registra uno o più eventi (body: { events: [...] }, oppure un solo evento).
// Risponde con l'esito di ognuno e con gli eventi successivi a ?since=<seq>.
export async function POST(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  try {
    const { matchId } = await params;
    const actor = await writerOf(request, matchId);
    if (actor instanceof NextResponse) return actor;
    const body = await readJson(request);
    const inputs = (Array.isArray(body.events) ? body.events : [body]) as ClientEventInput[];
    const results = await recordEvents(matchId, actor, inputs);
    return NextResponse.json({ results, ...(await liveSnapshot(matchId, sinceParam(request), actor.role === 'admin')) }, { headers: NO_STORE });
  } catch (error) {
    return liveErrorResponse(error, 'record the event');
  }
}
