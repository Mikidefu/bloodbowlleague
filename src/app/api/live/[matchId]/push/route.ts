import { NextResponse } from 'next/server';
import { NO_STORE, liveErrorResponse, readJson, writerOf } from '@/lib/live/api';
import { deletePushSubscription, pushPublicKey, savePushSubscription } from '@/lib/live/push';

// Chiave pubblica VAPID per abbonarsi; null se le notifiche push non sono configurate sul server.
export async function GET() {
  return NextResponse.json({ publicKey: pushPublicKey() }, { headers: NO_STORE });
}

// Il telefono abbinato si abbona alle notifiche della sua squadra (body: { subscription, language }).
export async function POST(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  try {
    const { matchId } = await params;
    const actor = await writerOf(request, matchId);
    if (actor instanceof NextResponse) return actor;
    if (actor.role !== 'companion') return NextResponse.json({ error: 'Only a paired phone can subscribe' }, { status: 400, headers: NO_STORE });
    await savePushSubscription(matchId, actor.teamId, await readJson(request));
    return NextResponse.json({ success: true }, { headers: NO_STORE });
  } catch (error) {
    return liveErrorResponse(error, 'save the push subscription');
  }
}

// Niente più notifiche su questo telefono (body: { endpoint }).
export async function DELETE(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  try {
    const { matchId } = await params;
    const actor = await writerOf(request, matchId);
    if (actor instanceof NextResponse) return actor;
    if (actor.role !== 'companion') return NextResponse.json({ error: 'Only a paired phone can unsubscribe' }, { status: 400, headers: NO_STORE });
    await deletePushSubscription(matchId, actor.teamId, (await readJson(request)).endpoint);
    return NextResponse.json({ success: true }, { headers: NO_STORE });
  } catch (error) {
    return liveErrorResponse(error, 'remove the push subscription');
  }
}
