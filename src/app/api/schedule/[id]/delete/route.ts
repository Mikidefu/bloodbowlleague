import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Troviamo i giocatori coinvolti prima di cancellare
    const { rows: playersToRecalc } = await db.execute({
      sql: 'SELECT DISTINCT player_id FROM player_stats WHERE match_id = ?',
      args: [id]
    });

    // 2. Prepariamo l'array delle transazioni
    const statements = [];

    // Il player_stats va in cascade delete in SQLite, ma cancelliamo il match
    statements.push({
      sql: 'DELETE FROM matches WHERE id = ?',
      args: [id]
    });

    // Aggiungiamo il ricalcolo per ogni giocatore coinvolto
    for (const p of playersToRecalc) {
      statements.push({
        sql: `
          UPDATE players 
          SET spp = (SELECT COALESCE(SUM(spp_earned), 0) FROM player_stats WHERE player_id = ?)
          WHERE id = ?
        `,
        args: [p.player_id, p.player_id]
      });
    }

    // Eseguiamo tutto insieme
    await db.batch(statements, 'write');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting match:', error);
    return NextResponse.json({ error: 'Failed to delete match' }, { status: 500 });
  }
}