import { NextResponse } from 'next/server';
import db from '@/lib/db';
import crypto from 'crypto';

export async function POST() {
  try {
    // 1. Controllo se la regular season è finita
    const { rows: unplayedRegularRows } = await db.execute("SELECT count(*) as count FROM matches WHERE is_played = 0 AND match_type = 'Regular Season'");
    if (Number(unplayedRegularRows[0].count) > 0) {
      return NextResponse.json({ error: 'Cannot start playoffs until regular season is fully played.' }, { status: 400 });
    }

    // 2. Controllo che i playoff non siano già stati generati
    const { rows: playoffExistsRows } = await db.execute("SELECT count(*) as count FROM matches WHERE match_type LIKE '%Semifinal%'");
    if (Number(playoffExistsRows[0].count) > 0) {
      return NextResponse.json({ error: 'Playoffs are already generated.' }, { status: 400 });
    }

    // 3. Calcolo della classifica per estrarre la Top 4
    const { rows: rawStandings } = await db.execute(`
      SELECT
        t.id, t.name,
        SUM(CASE WHEN m.home_team_id = t.id AND m.home_score > m.away_score THEN 1
                 WHEN m.away_team_id = t.id AND m.away_score > m.home_score THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN m.home_score = m.away_score THEN 1 ELSE 0 END) as draws,
        SUM(CASE WHEN m.home_team_id = t.id THEN m.home_score ELSE m.away_score END) as td_for,
        SUM(CASE WHEN m.home_team_id = t.id THEN m.away_score ELSE m.home_score END) as td_against,
        SUM(CASE WHEN m.home_team_id = t.id THEN m.home_casualties ELSE m.away_casualties END) as cas_for,
        SUM(CASE WHEN m.home_team_id = t.id THEN m.away_casualties ELSE m.home_casualties END) as cas_against
      FROM teams t
             LEFT JOIN matches m ON (t.id = m.home_team_id OR t.id = m.away_team_id) AND m.is_played = 1 AND m.match_type = 'Regular Season'
      GROUP BY t.id
    `);

    // Mappiamo e calcoliamo i punti forzando i tipi numerici per sicurezza
    const teamStandings = rawStandings.map((t: any) => ({
      ...t,
      wins: Number(t.wins || 0),
      draws: Number(t.draws || 0),
      points: (Number(t.wins || 0) * 3) + (Number(t.draws || 0) * 1),
      td_diff: Number(t.td_for || 0) - Number(t.td_against || 0),
      cas_diff: Number(t.cas_for || 0) - Number(t.cas_against || 0),
    })).sort((a: any, b: any) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.td_diff !== a.td_diff) return b.td_diff - a.td_diff;
      return b.cas_diff - a.cas_diff;
    });

    if (teamStandings.length < 4) {
      return NextResponse.json({ error: 'Not enough teams for a Final Four.' }, { status: 400 });
    }

    const top4 = teamStandings.slice(0, 4);

    const { rows: maxRoundRows } = await db.execute('SELECT MAX(round) as maxRound FROM matches');
    const nextRound = (Number(maxRoundRows[0].maxRound) || 0) + 1;

    // Batch transaction per creare le Semifinali contemporaneamente
    await db.batch([
      {
        sql: 'INSERT INTO matches (id, round, home_team_id, away_team_id, match_type) VALUES (?, ?, ?, ?, ?)',
        args: [crypto.randomUUID(), nextRound, top4[0].id, top4[3].id, 'Semifinal 1 (1st vs 4th)']
      },
      {
        sql: 'INSERT INTO matches (id, round, home_team_id, away_team_id, match_type) VALUES (?, ?, ?, ?, ?)',
        args: [crypto.randomUUID(), nextRound, top4[1].id, top4[2].id, 'Semifinal 2 (2nd vs 3rd)']
      }
    ], 'write');

    return NextResponse.json({ success: true, message: 'Semifinals generated!' });

  } catch (error) {
    console.error('Error generating playoffs:', error);
    return NextResponse.json({ error: 'Failed to generate playoffs' }, { status: 500 });
  }
}