import { NextResponse } from 'next/server';
import db from '@/lib/db';
import crypto from 'crypto';

export async function GET() {
    try {
        const { rows: matches } = await db.execute(`
      SELECT 
        m.*,
        th.name as home_name, th.logo_url as home_logo, th.primary_color as home_color,
        ta.name as away_name, ta.logo_url as away_logo, ta.primary_color as away_color
      FROM matches m
      JOIN teams th ON m.home_team_id = th.id
      JOIN teams ta ON m.away_team_id = ta.id
      ORDER BY m.round ASC
    `);

        return NextResponse.json(matches);
    } catch (error) {
        console.error('Error fetching schedule:', error);
        return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { rows: teams } = await db.execute('SELECT id FROM teams');

        if (teams.length < 2) {
            return NextResponse.json({ error: 'Need at least 2 teams to generate a schedule' }, { status: 400 });
        }

        const body = await request.json().catch(() => ({}));
        const action = body.action || 'auto-fill';

        if (action === 'manual') {
            const { round, home_team_id, away_team_id } = body;
            if (!round || !home_team_id || !away_team_id) {
                return NextResponse.json({ error: 'Missing match details' }, { status: 400 });
            }

            const { rows: existingMatchRows } = await db.execute({
                sql: 'SELECT id FROM matches WHERE round = ? AND ((home_team_id = ? AND away_team_id = ?) OR (home_team_id = ? AND away_team_id = ?))',
                args: [round, home_team_id, away_team_id, away_team_id, home_team_id]
            });

            if (existingMatchRows.length > 0) {
                return NextResponse.json({ error: 'These teams already play each other in this round' }, { status: 400 });
            }

            await db.execute({
                sql: `
          INSERT INTO matches (id, round, home_team_id, away_team_id, match_type)
          VALUES (?, ?, ?, ?, 'Regular Season')
        `,
                args: [crypto.randomUUID(), round, home_team_id, away_team_id]
            });

            return NextResponse.json({ success: true });
        }

        // Auto-fill logic
        const { rows: existingMatchesRaw } = await db.execute('SELECT round, home_team_id, away_team_id FROM matches WHERE match_type = "Regular Season"');
        // Creiamo una copia mutabile in memoria
        const existingMatches = [...existingMatchesRaw] as any[];

        const teamIds = teams.map((t: any) => String(t.id));
        if (teamIds.length % 2 !== 0) {
            teamIds.push('BYE');
        }

        const numTeams = teamIds.length;
        const numRounds = numTeams - 1;
        const halfSize = numTeams / 2;

        const matchesToInsert: { requested_round: number, home: string, away: string }[] = [];

        let currentTeamIds = [...teamIds];

        // Generazione girone di andata
        for (let round = 1; round <= numRounds; round++) {
            for (let i = 0; i < halfSize; i++) {
                const home = currentTeamIds[i];
                const away = currentTeamIds[numTeams - 1 - i];

                if (home !== 'BYE' && away !== 'BYE') {
                    if (i === 0 && round % 2 === 0) {
                        matchesToInsert.push({ requested_round: round, home: away, away: home });
                    } else {
                        matchesToInsert.push({ requested_round: round, home, away });
                    }
                }
            }

            const first = currentTeamIds[0];
            const last = currentTeamIds.pop()!;
            currentTeamIds = [first, last, ...currentTeamIds.slice(1)];
        }

        // Generazione girone di ritorno
        const firstHalfMatches = [...matchesToInsert];
        for (const match of firstHalfMatches) {
            matchesToInsert.push({
                requested_round: match.requested_round + numRounds,
                home: match.away,
                away: match.home
            });
        }

        let addedCount = 0;
        const statements = []; // Array per la transazione batch

        for (const generated of matchesToInsert) {
            const alreadyScheduledExact = existingMatches.some(em =>
                em.home_team_id === generated.home && em.away_team_id === generated.away
            );

            if (!alreadyScheduledExact) {
                let targetRound = generated.requested_round;
                let conflict = true;

                while(conflict) {
                    const teamHasMatchInRound = existingMatches.some(em =>
                        Number(em.round) === targetRound &&
                        (em.home_team_id === generated.home || em.away_team_id === generated.home ||
                            em.home_team_id === generated.away || em.away_team_id === generated.away)
                    );

                    if (!teamHasMatchInRound) {
                        conflict = false;
                    } else {
                        targetRound++;
                    }
                }

                // Aggiungiamo la query all'array delle transazioni
                statements.push({
                    sql: `
              INSERT INTO matches (id, round, home_team_id, away_team_id, match_type)
              VALUES (?, ?, ?, ?, 'Regular Season')
            `,
                    args: [crypto.randomUUID(), targetRound, generated.home, generated.away]
                });

                // Tracciamo il match localmente per le successive iterazioni del ciclo JS
                existingMatches.push({
                    round: targetRound,
                    home_team_id: generated.home,
                    away_team_id: generated.away
                });

                addedCount++;
            }
        }

        // Se ci sono match da inserire, li salviamo in blocco
        if (statements.length > 0) {
            await db.batch(statements, 'write');
        }

        return NextResponse.json({ success: true, added: addedCount });
    } catch (error) {
        console.error('Error generating schedule:', error);
        return NextResponse.json({ error: 'Failed to generate schedule' }, { status: 500 });
    }
}