import { NextResponse } from 'next/server';
import db from '@/lib/db';
import crypto from 'crypto';

export async function GET() {
    try {
        const { rows } = await db.execute(`
            SELECT m.*,
                   th.name as home_name, th.logo_url as home_logo, th.primary_color as home_color,
                   ta.name as away_name, ta.logo_url as away_logo, ta.primary_color as away_color
            FROM matches m
                     JOIN teams th ON m.home_team_id = th.id
                     JOIN teams ta ON m.away_team_id = ta.id
            ORDER BY m.round ASC, m.match_date ASC
        `);

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

        if (home_team_id === away_team_id) {
            return NextResponse.json({ error: 'Home and away teams cannot be the same' }, { status: 400 });
        }

        const id = crypto.randomUUID();

        await db.execute({
            sql: `
                INSERT INTO matches (id, home_team_id, away_team_id, round, match_type, match_date, is_played)
                VALUES (?, ?, ?, ?, ?, ?, 0)
            `,
            args: [
                id,
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