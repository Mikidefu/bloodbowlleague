import { NextResponse } from 'next/server';
import { lockedMatchResponse } from '@/lib/matchApi';
import { NO_STORE, afterResponse, liveErrorResponse } from '@/lib/live/api';
import { sendLivePushes } from '@/lib/live/push';
import { endLive, liveSnapshot } from '@/lib/live/server';

// Chiude la partita dal vivo: i telefoni non possono più scrivere. Solo admin (src/proxy.ts).
export async function POST(_request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  try {
    const { matchId } = await params;
    const locked = await lockedMatchResponse(matchId);
    if (locked) return locked;
    const ended = await endLive(matchId);
    if (ended) afterResponse(() => sendLivePushes(matchId, [ended]));
    return NextResponse.json(await liveSnapshot(matchId, 0, true), { headers: NO_STORE });
  } catch (error) {
    return liveErrorResponse(error, 'end the live match');
  }
}
