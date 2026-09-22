import { NextResponse } from 'next/server';
import { lockedMatchResponse } from '@/lib/matchApi';
import { NO_STORE, liveErrorResponse, readJson } from '@/lib/live/api';
import { joinLive } from '@/lib/live/server';

// Il telefono entra in una partita col codice (o il QR) e sceglie la squadra: riceve il token di squadra.
// Pubblica: la protegge il codice, che vale solo finché la partita è dal vivo.
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const joined = await joinLive(body.code, body.team_id, body.device_id);
    const locked = await lockedMatchResponse(joined.match_id);
    if (locked) return locked;
    return NextResponse.json(joined, { headers: NO_STORE });
  } catch (error) {
    return liveErrorResponse(error, 'join the match');
  }
}
