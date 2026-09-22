import { NextResponse } from 'next/server';
import { lockedMatchResponse } from '@/lib/matchApi';
import { NO_STORE, liveErrorResponse } from '@/lib/live/api';
import { liveSnapshot, startLive } from '@/lib/live/server';

// Avvia (o riapre) la partita dal vivo. Solo admin: lo garantisce src/proxy.ts.
export async function POST(_request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  try {
    const { matchId } = await params;
    const locked = await lockedMatchResponse(matchId);
    if (locked) return locked;
    await startLive(matchId);
    return NextResponse.json(await liveSnapshot(matchId, 0, true), { headers: NO_STORE });
  } catch (error) {
    return liveErrorResponse(error, 'start the live match');
  }
}
