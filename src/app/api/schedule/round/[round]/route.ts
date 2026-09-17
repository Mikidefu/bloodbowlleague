import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { recalcSppStatement } from '@/lib/spp';
import { getActiveSeason, seasonReadOnly } from '@/lib/seasons';

// Elimina una giornata della stagione attiva (i numeri di giornata si ripetono in ogni stagione)
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ round: string }> }
) {
    try {
        const { round } = await params;

        const season = await getActiveSeason();
        if (!season) return seasonReadOnly(null);

        // 1. Troviamo tutti i match di questa giornata
        const { rows: matches } = await db.execute({
            sql: 'SELECT id FROM matches WHERE round = ? AND season_id = ?',
            args: [round, season.id]
        });

        if (matches.length === 0) {
            return NextResponse.json({ success: true }); // Niente da cancellare
        }

        const matchIds = matches.map(m => String(m.id));
        const matchIdsPlaceholders = matchIds.map(() => '?').join(',');

        // 2. Troviamo tutti i giocatori che hanno statistiche in queste partite
        const { rows: playersToRecalc } = await db.execute({
            sql: `SELECT DISTINCT player_id FROM player_stats WHERE match_id IN (${matchIdsPlaceholders})`,
            args: matchIds
        });

        const statements = [
            // 3. Eliminiamo tutte le stats di queste partite
            { sql: `DELETE FROM player_stats WHERE match_id IN (${matchIdsPlaceholders})`, args: matchIds },
            // 4. Eliminiamo i match
            { sql: `DELETE FROM matches WHERE id IN (${matchIdsPlaceholders})`, args: matchIds },
            // 5. Ricalcoliamo gli SPP per tutti i giocatori coinvolti
            ...playersToRecalc.map(p => recalcSppStatement(String(p.player_id))),
        ];

        // Eseguiamo in blocco
        await db.batch(statements, 'write');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting round:', error);
        return NextResponse.json({ error: 'Failed to delete round' }, { status: 500 });
    }
}
