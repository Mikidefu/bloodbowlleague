import { NextResponse } from 'next/server';
import db from '@/lib/db';
import crypto from 'crypto';
import { FINAL_TYPES, MATCH_TYPES, SEMIFINAL_TYPES, sqlIn } from '@/lib/matchTypes';

// Genera la finale (vincitrici delle semifinali) e la finale 3°/4° posto (perdenti)
export async function POST() {
  try {
    const { rows: semis } = await db.execute(`
      SELECT m.*, th.name AS home_name, ta.name AS away_name
      FROM matches m
      JOIN teams th ON th.id = m.home_team_id
      JOIN teams ta ON ta.id = m.away_team_id
      WHERE m.match_type IN ${sqlIn(SEMIFINAL_TYPES)}
      ORDER BY m.match_type
    `);

    // 1. Servono esattamente due semifinali, entrambe giocate
    if (semis.length !== 2) {
      return NextResponse.json({ error: 'Semifinals not found: start the Final Four first.' }, { status: 400 });
    }
    if (semis.some(s => !s.is_played)) {
      return NextResponse.json({ error: 'Cannot generate Finals until both Semifinals are played.' }, { status: 400 });
    }

    // 2. Le finali non devono esistere già
    const { rows: [finals] } = await db.execute(`SELECT COUNT(*) AS count FROM matches WHERE match_type IN ${sqlIn(FINAL_TYPES)}`);
    if (Number(finals.count) > 0) {
      return NextResponse.json({ error: 'Finals are already generated.' }, { status: 400 });
    }

    const winners: string[] = [];
    const losers: string[] = [];

    for (const semi of semis) {
      const homeScore = Number(semi.home_score);
      const awayScore = Number(semi.away_score);
      const homeCas = Number(semi.home_casualties);
      const awayCas = Number(semi.away_casualties);

      // In parità di TD decidono le casualties; in parità completa non si può scegliere un vincitore
      const homeWins = homeScore > awayScore || (homeScore === awayScore && homeCas > awayCas);
      const awayWins = awayScore > homeScore || (homeScore === awayScore && awayCas > homeCas);

      if (!homeWins && !awayWins) {
        return NextResponse.json({
          error: `${semi.match_type} (${semi.home_name} vs ${semi.away_name}) ended in a full tie (TD and CAS). Update the result with the overtime outcome first.`
        }, { status: 400 });
      }

      winners.push(String(homeWins ? semi.home_team_id : semi.away_team_id));
      losers.push(String(homeWins ? semi.away_team_id : semi.home_team_id));
    }

    const { rows: [maxRound] } = await db.execute('SELECT MAX(round) AS maxRound FROM matches');
    const nextRound = (Number(maxRound.maxRound) || 0) + 1;

    const insert = 'INSERT INTO matches (id, round, home_team_id, away_team_id, match_type, is_played) VALUES (?, ?, ?, ?, ?, 0)';
    await db.batch([
      { sql: insert, args: [crypto.randomUUID(), nextRound, losers[0], losers[1], MATCH_TYPES.thirdPlace] },
      { sql: insert, args: [crypto.randomUUID(), nextRound, winners[0], winners[1], MATCH_TYPES.final] },
    ], 'write');

    return NextResponse.json({ success: true, round: nextRound });
  } catch (error) {
    console.error('Error generating finals:', error);
    return NextResponse.json({ error: 'Failed to generate finals' }, { status: 500 });
  }
}
