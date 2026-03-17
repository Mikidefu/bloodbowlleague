import { NextResponse } from 'next/server';
import db from '@/lib/db';
import crypto from 'crypto';

export async function POST() {
    try {
        // 1. Controllo se le Semifinali sono state giocate tutte
        const { rows: unplayedSemisRows } = await db.execute("SELECT count(*) as count FROM matches WHERE is_played = 0 AND match_type LIKE '%Semifinal%'");
        if (Number(unplayedSemisRows[0].count) > 0) {
            return NextResponse.json({ error: 'Cannot generate Finals until Semifinals are played.' }, { status: 400 });
        }

        // 2. Controllo se le Finali sono già state generate
        const { rows: finalsExistsRows } = await db.execute("SELECT count(*) as count FROM matches WHERE match_type LIKE '%Final%' AND match_type NOT LIKE '%Semifinal%'");
        if (Number(finalsExistsRows[0].count) > 0) {
            return NextResponse.json({ error: 'Finals are already generated.' }, { status: 400 });
        }

        // 3. Recupero i risultati delle Semifinali
        const { rows: semis } = await db.execute("SELECT * FROM matches WHERE match_type LIKE '%Semifinal%'");
        if (semis.length !== 2) {
            return NextResponse.json({ error: 'Could not find 2 Semifinals.' }, { status: 400 });
        }

        const winners: string[] = [];
        const losers: string[] = [];

        for (const semi of semis) {
            // Nota: assicuriamoci che i valori estratti dal DB siano trattati come numeri
            const homeScore = Number(semi.home_score);
            const awayScore = Number(semi.away_score);
            const homeCas = Number(semi.home_casualties);
            const awayCas = Number(semi.away_casualties);

            if (homeScore > awayScore) {
                winners.push(String(semi.home_team_id));
                losers.push(String(semi.away_team_id));
            } else if (awayScore > homeScore) {
                winners.push(String(semi.away_team_id));
                losers.push(String(semi.home_team_id));
            } else {
                // Tiebreaker
                if (homeCas > awayCas) {
                    winners.push(String(semi.home_team_id));
                    losers.push(String(semi.away_team_id));
                } else {
                    winners.push(String(semi.away_team_id));
                    losers.push(String(semi.home_team_id));
                }
            }
        }

        const { rows: maxRoundRows } = await db.execute('SELECT MAX(round) as maxRound FROM matches');
        const nextRound = (Number(maxRoundRows[0].maxRound) || 0) + 1;

        // Utilizziamo db.batch per eseguire gli insert in un'unica transazione sicura
        await db.batch([
            {
                sql: 'INSERT INTO matches (id, round, home_team_id, away_team_id, match_type) VALUES (?, ?, ?, ?, ?)',
                args: [crypto.randomUUID(), nextRound, losers[0], losers[1], '3rd Place Match']
            },
            {
                sql: 'INSERT INTO matches (id, round, home_team_id, away_team_id, match_type) VALUES (?, ?, ?, ?, ?)',
                args: [crypto.randomUUID(), nextRound, winners[0], winners[1], 'Grand Final (Blood Bowl!)']
            }
        ], 'write');

        return NextResponse.json({ success: true, message: 'Finals generated!' });

    } catch (error) {
        console.error('Error generating finals:', error);
        return NextResponse.json({ error: 'Failed to generate finals' }, { status: 500 });
    }
}