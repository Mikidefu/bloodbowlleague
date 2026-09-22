import { NextResponse } from 'next/server';
import { NO_STORE, liveErrorResponse, writerOf } from '@/lib/live/api';
import { unpairTeam } from '@/lib/live/server';

// Il telefono lascia la sua squadra (es. ha scelto quella sbagliata): la squadra torna libera.
export async function POST(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  try {
    const { matchId } = await params;
    const actor = await writerOf(request, matchId);
    if (actor instanceof NextResponse) return actor;
    if (actor.role !== 'companion') return NextResponse.json({ error: 'Only a paired phone can leave its team' }, { status: 400, headers: NO_STORE });
    await unpairTeam(matchId, actor.teamId);
    return NextResponse.json({ success: true }, { headers: NO_STORE });
  } catch (error) {
    return liveErrorResponse(error, 'leave the team');
  }
}
