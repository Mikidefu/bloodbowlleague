import { NextResponse } from 'next/server';
import db from '@/lib/db';
import crypto from 'crypto';

export async function POST() {
  try {
    // 1. Check if regular season is done
    const unplayedRegular = db.prepare("SELECT count(*) as count FROM matches WHERE is_played = 0 AND match_type = 'Regular Season'").get() as any;
    if (unplayedRegular.count > 0) {
      return NextResponse.json({ error: 'Cannot start playoffs until regular season is fully played.' }, { status: 400 });
    }

    // 2. Ensure playoffs haven't already been generated
    const playoffExists = db.prepare("SELECT count(*) as count FROM matches WHERE match_type LIKE '%Semifinal%'").get() as any;
    if (playoffExists.count > 0) {
      return NextResponse.json({ error: 'Playoffs are already generated.' }, { status: 400 });
    }

    // 3. Get Top 4 Teams (Same logic as standings)
    const teamStandings = db.prepare(`
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
    `).all().map((t: any) => ({
      ...t,
      points: (t.wins * 3) + (t.draws * 1),
      td_diff: t.td_for - t.td_against,
      cas_diff: t.cas_for - t.cas_against,
    })).sort((a: any, b: any) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.td_diff !== a.td_diff) return b.td_diff - a.td_diff;
      return b.cas_diff - a.cas_diff;
    });

    if (teamStandings.length < 4) {
      return NextResponse.json({ error: 'Not enough teams for a Final Four.' }, { status: 400 });
    }

    const top4 = teamStandings.slice(0, 4);

    // Get max round to append playoffs
    const maxRoundRecord = db.prepare('SELECT MAX(round) as maxRound FROM matches').get() as any;
    const nextRound = (maxRoundRecord.maxRound || 0) + 1;

    // Create Semifinal 1: 1st vs 4th
    // Create Semifinal 2: 2nd vs 3rd
    const insertMatch = db.prepare(`
      INSERT INTO matches (id, round, home_team_id, away_team_id, match_type)
      VALUES (?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      insertMatch.run(crypto.randomUUID(), nextRound, top4[0].id, top4[3].id, 'Semifinal 1 (1st vs 4th)');
      insertMatch.run(crypto.randomUUID(), nextRound, top4[1].id, top4[2].id, 'Semifinal 2 (2nd vs 3rd)');
    })();

    return NextResponse.json({ success: true, message: 'Semifinals generated!' });

  } catch (error) {
    console.error('Error generating playoffs:', error);
    return NextResponse.json({ error: 'Failed to generate playoffs' }, { status: 500 });
  }
}
