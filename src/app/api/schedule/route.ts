import { NextResponse } from 'next/server';
import db from '@/lib/db';
import crypto from 'crypto';
import { MATCH_TYPES } from '@/lib/matchTypes';
import { getActiveSeason, resolveSeason, seasonNotFound, seasonReadOnly } from '@/lib/seasons';

// Partite di una stagione (?season=<id>, default: stagione attiva)
export async function GET(request: Request) {
    try {
        const season = await resolveSeason(request);
        if (!season) return seasonNotFound();

        const { rows } = await db.execute({
            sql: `
                SELECT m.*,
                       th.name as home_name, th.logo_url as home_logo, th.primary_color as home_color,
                       ta.name as away_name, ta.logo_url as away_logo, ta.primary_color as away_color
                FROM matches m
                         JOIN teams th ON m.home_team_id = th.id
                         JOIN teams ta ON m.away_team_id = ta.id
                WHERE m.season_id = ?
                ORDER BY m.round ASC, m.match_date ASC
            `,
            args: [season.id]
        });

        return NextResponse.json(rows);
    } catch (error) {
        console.error('Error fetching schedule:', error);
        return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { home_team_id, away_team_id, round, match_type, match_date } = body;

        if (!home_team_id || !away_team_id || !round || !match_type) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Semifinali e finali si creano solo dai pulsanti dei playoff, così restano coerenti con la classifica
        const allowedTypes: string[] = [MATCH_TYPES.league, MATCH_TYPES.playoff, MATCH_TYPES.friendly];
        if (!allowedTypes.includes(match_type)) {
            return NextResponse.json({ error: `Invalid match type: ${match_type}` }, { status: 400 });
        }

        if (home_team_id === away_team_id) {
            return NextResponse.json({ error: 'Home and away teams cannot be the same' }, { status: 400 });
        }

        // Le partite nuove appartengono sempre alla stagione attiva, tra squadre iscritte a quella stagione
        const season = await getActiveSeason();
        if (!season) return seasonReadOnly(null);

        const { rows: enrolled } = await db.execute({
            sql: 'SELECT team_id FROM season_teams WHERE season_id = ? AND team_id IN (?, ?)',
            args: [season.id, home_team_id, away_team_id]
        });
        if (enrolled.length !== 2) {
            return NextResponse.json({ error: `Both teams must be taking part in ${season.name}.` }, { status: 400 });
        }

        const id = crypto.randomUUID();

        await db.execute({
            sql: `
                INSERT INTO matches (id, season_id, home_team_id, away_team_id, round, match_type, match_date, is_played)
                VALUES (?, ?, ?, ?, ?, ?, ?, 0)
            `,
            args: [
                id,
                season.id,
                home_team_id,
                away_team_id,
                round,
                match_type,
                match_date || null
            ]
        });

        return NextResponse.json({ success: true }, { status: 201 });
    } catch (error) {
        console.error('Error creating match:', error);
        return NextResponse.json({ error: 'Failed to create match' }, { status: 500 });
    }
}
