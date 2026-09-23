import { NextResponse } from 'next/server';
import { lockedMatchResponse } from '@/lib/matchApi';
import { NO_STORE, liveErrorResponse, readJson } from '@/lib/live/api';
import { joinLive, lookupJoinCode } from '@/lib/live/server';

// Il telefono inserisce il codice (o apre il QR) e vede le due squadre, con quelle già prese.
export async function GET(request: Request) {
  try {
    const code = new URL(request.url).searchParams.get('code');
    return NextResponse.json(await lookupJoinCode(code), { headers: NO_STORE });
  } catch (error) {
    return liveErrorResponse(error, 'find the match');
  }
}

// Poi sceglie la squadra e riceve il token di squadra.
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
