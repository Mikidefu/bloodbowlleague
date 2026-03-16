import { NextResponse } from 'next/server';
import db from '@/lib/db';
import crypto from 'crypto';

export async function POST() {
  try {
    // 1. Check if Semifinals are fully played
    const unplayedSemis = db.prepare("SELECT count(*) as count FROM matches WHERE is_played = 0 AND match_type LIKE '%Semifinal%'").get() as any;
    if (unplayedSemis.count > 0) {
      return NextResponse.json({ error: 'Cannot generate Finals until Semifinals are played.' }, { status: 400 });
    }

    // 2. Ensure Finals haven't already been generated
    const finalsExists = db.prepare("SELECT count(*) as count FROM matches WHERE match_type LIKE '%Final%' AND match_type NOT LIKE '%Semifinal%'").get() as any;
    if (finalsExists.count > 0) {
      return NextResponse.json({ error: 'Finals are already generated.' }, { status: 400 });
    }

    // 3. Get Semifinal results
    const semis = db.prepare("SELECT * FROM matches WHERE match_type LIKE '%Semifinal%'").all() as any[];
    if (semis.length !== 2) {
      return NextResponse.json({ error: 'Could not find 2 Semifinals.' }, { status: 400 });
    }

    const winners: string[] = [];
    const losers: string[] = [];

    for (const semi of semis) {
      if (semi.home_score > semi.away_score) {
        winners.push(semi.home_team_id);
        losers.push(semi.away_team_id);
      } else if (semi.away_score > semi.home_score) {
         winners.push(semi.away_team_id);
         losers.push(semi.home_team_id);
      } else {
         // Tiebreaker: normally in BB overtime or casualties would decide. Let's fallback to casualties
         if (semi.home_casualties > semi.away_casualties) {
            winners.push(semi.home_team_id);
            losers.push(semi.away_team_id);
         } else {
            // Ultimate fallback (away wins ties)
            winners.push(semi.away_team_id);
            losers.push(semi.home_team_id);
         }
      }
    }

    const maxRoundRecord = db.prepare('SELECT MAX(round) as maxRound FROM matches').get() as any;
    const nextRound = (maxRoundRecord.maxRound || 0) + 1;

    const insertMatch = db.prepare(`
      INSERT INTO matches (id, round, home_team_id, away_team_id, match_type)
      VALUES (?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      // 3rd place match
      insertMatch.run(crypto.randomUUID(), nextRound, losers[0], losers[1], '3rd Place Match');
      // Grand Final
      insertMatch.run(crypto.randomUUID(), nextRound, winners[0], winners[1], 'Grand Final (Blood Bowl!)');
    })();

    return NextResponse.json({ success: true, message: 'Finals generated!' });

  } catch (error) {
    console.error('Error generating finals:', error);
    return NextResponse.json({ error: 'Failed to generate finals' }, { status: 500 });
  }
}
