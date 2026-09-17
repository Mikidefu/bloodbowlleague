import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { deleteSeasonStatements, getSeason } from '@/lib/seasons';

// Rinomina una stagione
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return NextResponse.json({ error: 'Season name is required' }, { status: 400 });
    if (name.length > 60) return NextResponse.json({ error: 'Season name is too long (max 60 characters)' }, { status: 400 });

    const result = await db.execute({ sql: 'UPDATE seasons SET name = ? WHERE id = ?', args: [name, id] });
    if (result.rowsAffected === 0) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error renaming season:', error);
    return NextResponse.json({ error: 'Failed to rename season' }, { status: 500 });
  }
}

// Elimina definitivamente una stagione non conclusa (in corso, in pausa o annullata):
// partite, statistiche di quelle partite e iscrizioni. Squadre, giocatori e allenatori restano.
// Le stagioni concluse con un campione sono storia della lega: vanno prima annullate.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const season = await getSeason(id);
    if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
    if (season.status === 'completed') {
      return NextResponse.json({ error: `${season.name} is completed: cancel it first if you really want to delete it.` }, { status: 409 });
    }

    const { rows: [counts] } = await db.execute({
      sql: `SELECT (SELECT COUNT(*) FROM matches WHERE season_id = ?) AS matches,
                   (SELECT COUNT(*) FROM player_stats WHERE match_id IN (SELECT id FROM matches WHERE season_id = ?)) AS stats`,
      args: [id, id],
    });

    await db.batch(await deleteSeasonStatements(id), 'write');
    return NextResponse.json({ success: true, deleted_matches: Number(counts.matches), deleted_player_stats: Number(counts.stats) });
  } catch (error) {
    console.error('Error deleting season:', error);
    return NextResponse.json({ error: 'Failed to delete season' }, { status: 500 });
  }
}
