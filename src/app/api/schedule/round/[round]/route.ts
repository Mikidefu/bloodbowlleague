import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ round: string }> }
) {
    try {
        const { round } = await params;

        // 1. Troviamo tutti i match di questa giornata
        const { rows: matches } = await db.execute({
            sql: 'SELECT id FROM matches WHERE round = ?',
            args: [round]
        });

        if (matches.length === 0) {
            return NextResponse.json({ success: true }); // Niente da cancellare
        }

        const matchIds = matches.map(m => m.id);
        const matchIdsPlaceholders = matchIds.map(() => '?').join(',');

        // 2. Troviamo tutti i giocatori che hanno statistiche in queste partite
        const { rows: playersToRecalc } = await db.execute({
            sql: `SELECT DISTINCT player_id FROM player_stats WHERE match_id IN (${matchIdsPlaceholders})`,
            args: matchIds
        });

        const statements = [];

        // 3. Eliminiamo tutte le stats di queste partite
        statements.push({
            sql: `DELETE FROM player_stats WHERE match_id IN (${matchIdsPlaceholders})`,
            args: matchIds
        });

        // 4. Eliminiamo i match
        statements.push({
            sql: 'DELETE FROM matches WHERE round = ?',
            args: [round]
        });

        // 5. Ricalcoliamo gli SPP per tutti i giocatori coinvolti
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

        // Eseguiamo in blocco
        await db.batch(statements, 'write');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting round:', error);
        return NextResponse.json({ error: 'Failed to delete round' }, { status: 500 });
    }
}