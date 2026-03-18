import { NextResponse } from 'next/server';
import db from '@/lib/db';
import crypto from 'crypto';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        // Di default parte dal round 1, ma ora possiamo dirgli di partire dal round X
        const { start_round = 1 } = body;

        // Recupera tutti i team attivi
        const { rows: teams } = await db.execute('SELECT id FROM teams');

        if (teams.length < 2) {
            return NextResponse.json({ error: 'Not enough teams to generate schedule' }, { status: 400 });
        }

        const teamIds = teams.map(t => t.id);

        // Se i team sono dispari, aggiungiamo un "BYE" fittizio per far riposare una squadra a turno
        if (teamIds.length % 2 !== 0) {
            teamIds.push('BYE');
        }

        const numTeams = teamIds.length;
        const numRounds = numTeams - 1;
        const half = numTeams / 2;

        const matchesToInsert = [];

        // Algoritmo Standard di Berger per i gironi all'italiana
        for (let round = 0; round < numRounds; round++) {
            const currentRoundNumber = round + 1;

            // Genera il calendario in memoria, ma lo salva SOLO se il round è >= a quello richiesto
            if (currentRoundNumber >= start_round) {
                for (let i = 0; i < half; i++) {
                    const home = teamIds[i];
                    const away = teamIds[numTeams - 1 - i];

                    // Ignoriamo le partite contro il "BYE" (squadra che riposa)
                    if (home !== 'BYE' && away !== 'BYE') {

                        // Alterniamo chi gioca in casa e fuori per bilanciare
                        const isEvenRound = round % 2 === 0;
                        const finalHome = isEvenRound ? home : away;
                        const finalAway = isEvenRound ? away : home;

                        matchesToInsert.push({
                            sql: `INSERT INTO matches (id, home_team_id, away_team_id, round, match_type, is_played) VALUES (?, ?, ?, ?, 'League', 0)`,
                            args: [crypto.randomUUID(), finalHome as string, finalAway as string, currentRoundNumber]
                        });
                    }
                }
            }

            // Rotazione array per il prossimo round (fissando il primo elemento)
            teamIds.splice(1, 0, teamIds.pop() as any);
        }

        if (matchesToInsert.length > 0) {
            await db.batch(matchesToInsert, 'write');
        }

        return NextResponse.json({ success: true, matches_created: matchesToInsert.length });
    } catch (error) {
        console.error('Error generating schedule:', error);
        return NextResponse.json({ error: 'Failed to generate schedule' }, { status: 500 });
    }
}