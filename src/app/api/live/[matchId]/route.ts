import { NextResponse } from 'next/server';
import { lockedMatchResponse } from '@/lib/matchApi';
import { NO_STORE, liveErrorResponse, sinceParam } from '@/lib/live/api';
import { liveSnapshot, resetLive } from '@/lib/live/server';
import { isAdminRequest } from '@/lib/live/token';

// Stato della partita dal vivo e gli eventi successivi a ?since=<seq> (polling di web e companion).
// Pubblico in lettura come il resto del sito; il codice di abbinamento lo riceve solo l'admin.
export async function GET(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  try {
    const { matchId } = await params;
    const snapshot = await liveSnapshot(matchId, sinceParam(request), isAdminRequest(request));
    // Non ancora avviata: è uno stato normale (il web e il telefono aspettano), non un errore
    if (!snapshot) return NextResponse.json({ live: null, seq: 0, events: [] }, { headers: NO_STORE });
    return NextResponse.json(snapshot, { headers: NO_STORE });
  } catch (error) {
    return liveErrorResponse(error, 'load the live match');
  }
}

// Azzera il live: registro e abbinamenti. Solo admin (src/proxy.ts); il referto della partita non si tocca.
export async function DELETE(_request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  try {
    const { matchId } = await params;
    const locked = await lockedMatchResponse(matchId);
    if (locked) return locked;
    await resetLive(matchId);
    return NextResponse.json({ success: true }, { headers: NO_STORE });
  } catch (error) {
    return liveErrorResponse(error, 'reset the live match');
  }
}
