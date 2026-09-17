import { NextResponse } from 'next/server';
import db from '@/lib/db';
import crypto from 'crypto';
import { LEAGUE_MATCH_TYPES, MATCH_TYPES, sqlIn } from '@/lib/matchTypes';
import { getActiveSeason, seasonReadOnly } from '@/lib/seasons';

const pairKey = (a: string, b: string) => [a, b].sort().join('|');

// Genera il girone all'italiana della stagione attiva, tra le squadre iscritte
export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        // Di default parte dal round 1, ma si può chiedere di generare solo i round da X in poi
        const startRound = Number(body.start_round ?? 1);
        if (!Number.isInteger(startRound) || startRound < 1) {
            return NextResponse.json({ error: 'Start round must be a positive integer' }, { status: 400 });
        }

        const season = await getActiveSeason();
        if (!season) return seasonReadOnly(null);

        // Ordine stabile: generando in due momenti diversi si ottiene lo stesso tabellone
        const { rows: teams } = await db.execute({
            sql: `SELECT t.id, t.name FROM season_teams st JOIN teams t ON t.id = st.team_id
                  WHERE st.season_id = ? ORDER BY t.created_at ASC, t.id ASC`,
            args: [season.id]
        });
        if (teams.length < 2) {
            return NextResponse.json({ error: `Not enough teams in ${season.name} to generate a schedule` }, { status: 400 });
        }
        const teamNames = new Map(teams.map(t => [String(t.id), String(t.name)]));

        const { rows: existingLeague } = await db.execute({
            sql: `SELECT home_team_id, away_team_id, round FROM matches
                  WHERE season_id = ? AND match_type IN ${sqlIn(LEAGUE_MATCH_TYPES)}`,
            args: [season.id]
        });

        // 1. Non generare sopra giornate di campionato già presenti
        const occupiedRounds = [...new Set(existingLeague.map(m => Number(m.round)).filter(r => r >= startRound))].sort((a, b) => a - b);
        if (occupiedRounds.length > 0) {
            return NextResponse.json({
                error: `League matches already exist in round(s) ${occupiedRounds.join(', ')}. Delete those rounds or choose a later start round.`
            }, { status: 409 });
        }

        const teamIds = teams.map(t => String(t.id));

        // Se i team sono dispari, aggiungiamo un "BYE" fittizio per far riposare una squadra a turno
        if (teamIds.length % 2 !== 0) {
            teamIds.push('BYE');
        }

        const numTeams = teamIds.length;
        const numRounds = numTeams - 1;
        const half = numTeams / 2;

        const fixtures: { home: string; away: string; round: number }[] = [];

        // Algoritmo Standard di Berger per i gironi all'italiana
        for (let round = 0; round < numRounds; round++) {
            const currentRoundNumber = round + 1;

            // Genera il calendario in memoria, ma lo salva SOLO se il round è >= a quello richiesto
            if (currentRoundNumber >= startRound) {
                for (let i = 0; i < half; i++) {
                    const home = teamIds[i];
                    const away = teamIds[numTeams - 1 - i];

                    // Ignoriamo le partite contro il "BYE" (squadra che riposa)
                    if (home !== 'BYE' && away !== 'BYE') {
                        // Alterniamo chi gioca in casa e fuori per bilanciare
                        const isEvenRound = round % 2 === 0;
                        fixtures.push({
                            home: isEvenRound ? home : away,
                            away: isEvenRound ? away : home,
                            round: currentRoundNumber,
                        });
                    }
                }
            }

            // Rotazione array per il prossimo round (fissando il primo elemento)
            teamIds.splice(1, 0, teamIds.pop() as string);
        }

        // 2. Se generando "da metà" un accoppiamento è già stato giocato, il tabellone non combacia
        //    (es. squadre aggiunte o rimosse nel frattempo): meglio fermarsi che creare doppioni
        const existingPairs = new Set(existingLeague.map(m => pairKey(String(m.home_team_id), String(m.away_team_id))));
        const duplicates = fixtures.filter(f => existingPairs.has(pairKey(f.home, f.away)));
        if (duplicates.length > 0) {
            const example = duplicates[0];
            return NextResponse.json({
                error: `${duplicates.length} generated fixture(s) already exist in the league (e.g. ${teamNames.get(example.home)} vs ${teamNames.get(example.away)}). The teams changed since the first rounds were created: add the remaining matches manually.`
            }, { status: 409 });
        }

        if (fixtures.length > 0) {
            await db.batch(fixtures.map(f => ({
                sql: 'INSERT INTO matches (id, season_id, home_team_id, away_team_id, round, match_type, is_played) VALUES (?, ?, ?, ?, ?, ?, 0)',
                args: [crypto.randomUUID(), season.id, f.home, f.away, f.round, MATCH_TYPES.league]
            })), 'write');
        }

        return NextResponse.json({ success: true, matches_created: fixtures.length });
    } catch (error) {
        console.error('Error generating schedule:', error);
        return NextResponse.json({ error: 'Failed to generate schedule' }, { status: 500 });
    }
}
