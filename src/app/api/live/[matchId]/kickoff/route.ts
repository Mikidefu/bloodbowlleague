import { NextResponse } from 'next/server';
import { NO_STORE, liveErrorResponse, readJson, sinceParam, writerOf } from '@/lib/live/api';
import type { ManualKickoffDice } from '@/lib/live/kickoff';
import { liveSnapshot, rollKickoff } from '@/lib/live/server';

// Kick-off Event (p. 48): lo tira il server, oppure registra i dadi tirati al tavolo (body.manual).
// Può chiamarlo l'admin o il telefono della squadra che calcia; un secondo tiro per lo stesso drive non passa.
export async function POST(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  try {
    const { matchId } = await params;
    const actor = await writerOf(request, matchId);
    if (actor instanceof NextResponse) return actor;
    const body = await readJson(request);
    const manual = body.manual && typeof body.manual === 'object' ? body.manual as ManualKickoffDice : undefined;
    const { status } = await rollKickoff(matchId, actor, body.id, manual);
    return NextResponse.json({ status, ...(await liveSnapshot(matchId, sinceParam(request), actor.role === 'admin')) }, { headers: NO_STORE });
  } catch (error) {
    return liveErrorResponse(error, 'roll the kick-off');
  }
}
