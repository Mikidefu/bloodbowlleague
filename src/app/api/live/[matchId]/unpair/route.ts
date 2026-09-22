import { NextResponse } from 'next/server';
import { NO_STORE, liveErrorResponse, readJson } from '@/lib/live/api';
import { unpairTeam } from '@/lib/live/server';

// Scollega il telefono di una squadra (perso, scarico, squadra sbagliata). Solo admin (src/proxy.ts).
export async function POST(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  try {
    const { matchId } = await params;
    await unpairTeam(matchId, (await readJson(request)).team_id);
    return NextResponse.json({ success: true }, { headers: NO_STORE });
  } catch (error) {
    return liveErrorResponse(error, 'disconnect the phone');
  }
}
