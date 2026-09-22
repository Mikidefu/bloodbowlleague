import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { deleteMatchStatements } from '@/lib/matchRules';
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

        // 2. Eliminiamo una partita alla volta annullandone gli effetti (Treasury, fan, infortuni, Journeymen, SPP):
        //    ogni partita legge lo stato lasciato dalla precedente
        for (const match of matches) {
            await db.batch(await deleteMatchStatements(String(match.id)), 'write');
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting round:', error);
        return NextResponse.json({ error: 'Failed to delete round' }, { status: 500 });
    }
}
