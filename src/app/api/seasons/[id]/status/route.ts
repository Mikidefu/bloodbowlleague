import { NextResponse } from 'next/server';
import { closeSeasonStatement, getActiveSeason, getSeason, reopenSeasonStatement } from '@/lib/seasons';
import db from '@/lib/db';

// Cambia lo stato di una stagione. body.action:
//   'pause'  stagione in corso -> in pausa (sola lettura, riprendibile)
//   'cancel' stagione in corso, in pausa o conclusa -> annullata (sola lettura, esclusa dalle carriere)
//   'resume' stagione in pausa o annullata -> in corso. Se esiste già una stagione in corso serve
//            pause_current: true, e quella viene messa in pausa nella stessa operazione.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body.action;

    const season = await getSeason(id);
    if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

    if (action === 'pause') {
      if (season.status !== 'active') {
        return NextResponse.json({ error: 'Only the season in progress can be paused.' }, { status: 409 });
      }
      await db.execute(closeSeasonStatement(id, 'paused'));
      return NextResponse.json({ success: true, status: 'paused' });
    }

    if (action === 'cancel') {
      if (season.status === 'cancelled') {
        return NextResponse.json({ error: `${season.name} is already cancelled.` }, { status: 409 });
      }
      await db.execute(closeSeasonStatement(id, 'cancelled'));
      return NextResponse.json({ success: true, status: 'cancelled' });
    }

    if (action === 'resume') {
      if (season.status !== 'paused' && season.status !== 'cancelled') {
        return NextResponse.json({ error: 'Only paused or cancelled seasons can be resumed.' }, { status: 409 });
      }
      const active = await getActiveSeason();
      if (active && body.pause_current !== true) {
        return NextResponse.json({
          error: `${active.name} is in progress: it will be paused to resume ${season.name}.`,
          active_exists: true,
          active_name: active.name,
        }, { status: 409 });
      }
      // Prima si chiude la stagione in corso: il database ammette una sola stagione attiva
      const statements = [];
      if (active) statements.push(closeSeasonStatement(active.id, 'paused'));
      statements.push(reopenSeasonStatement(id));
      await db.batch(statements, 'write');
      return NextResponse.json({ success: true, status: 'active', paused: active?.id ?? null });
    }

    return NextResponse.json({ error: 'Invalid action: use pause, cancel or resume' }, { status: 400 });
  } catch (error) {
    console.error('Error changing season status:', error);
    return NextResponse.json({ error: 'Failed to change season status' }, { status: 500 });
  }
}
