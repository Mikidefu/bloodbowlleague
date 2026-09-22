import { NextResponse } from 'next/server';
import { NO_STORE, liveErrorResponse, sinceParam } from '@/lib/live/api';
import { liveSnapshot } from '@/lib/live/server';
import { isAdminRequest } from '@/lib/live/token';

// Stato della partita dal vivo e gli eventi successivi a ?since=<seq> (polling di web e companion).
// Pubblico in lettura come il resto del sito; il codice di abbinamento lo riceve solo l'admin.
export async function GET(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  try {
    const { matchId } = await params;
    const snapshot = await liveSnapshot(matchId, sinceParam(request), isAdminRequest(request));
    if (!snapshot) return NextResponse.json({ error: 'The live match has not started' }, { status: 404, headers: NO_STORE });
    return NextResponse.json(snapshot, { headers: NO_STORE });
  } catch (error) {
    return liveErrorResponse(error, 'load the live match');
  }
}
