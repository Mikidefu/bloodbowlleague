import { NextResponse } from 'next/server';
import db from '@/lib/db';
import crypto from 'crypto';
import { computeStandings } from '@/lib/standings';
import { LEAGUE_MATCH_TYPES, MATCH_TYPES, SEMIFINAL_TYPES, sqlIn } from '@/lib/matchTypes';
import { getActiveSeason, seasonReadOnly } from '@/lib/seasons';

// Genera le semifinali della Final Four della stagione attiva: 1ª vs 4ª e 2ª vs 3ª della classifica di campionato
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const force = body.force === true;

    const season = await getActiveSeason();
    if (!season) return seasonReadOnly(null);

    const { rows: [league] } = await db.execute({
      sql: `SELECT COUNT(*) AS total, SUM(CASE WHEN is_played = 0 THEN 1 ELSE 0 END) AS unplayed
            FROM matches WHERE season_id = ? AND match_type IN ${sqlIn(LEAGUE_MATCH_TYPES)}`,
      args: [season.id]
    });

    // 1. Serve un campionato giocato per intero
    if (Number(league.total) === 0) {
      return NextResponse.json({ error: 'There are no league matches: generate and play the season first.' }, { status: 400 });
    }
    if (Number(league.unplayed) > 0) {
      return NextResponse.json({ error: `Cannot start playoffs: ${league.unplayed} league match(es) still to be played.` }, { status: 400 });
    }

    // 2. Le semifinali non devono esistere già
    const { rows: [semis] } = await db.execute({
      sql: `SELECT COUNT(*) AS count FROM matches WHERE season_id = ? AND match_type IN ${sqlIn(SEMIFINAL_TYPES)}`,
      args: [season.id]
    });
    if (Number(semis.count) > 0) {
      return NextResponse.json({ error: 'Playoffs are already generated.' }, { status: 400 });
    }

    // 3. Top 4 dalla stessa classifica mostrata nella pagina Standings
    const standings = await computeStandings(season.id);
    if (standings.length < 4) {
      return NextResponse.json({ error: 'Not enough teams for a Final Four.' }, { status: 400 });
    }

    // 4. Girone incompleto (qualche coppia di squadre non si è mai affrontata):
    //    si procede solo con conferma esplicita, per non avviare i playoff a stagione in corso
    const { rows: leaguePairs } = await db.execute({
      sql: `SELECT DISTINCT MIN(home_team_id, away_team_id) AS a, MAX(home_team_id, away_team_id) AS b
            FROM matches WHERE season_id = ? AND match_type IN ${sqlIn(LEAGUE_MATCH_TYPES)}`,
      args: [season.id]
    });
    const teamIds = new Set(standings.map(t => t.id));
    const metPairs = leaguePairs.filter(p => teamIds.has(String(p.a)) && teamIds.has(String(p.b))).length;
    const totalPairs = (standings.length * (standings.length - 1)) / 2;
    if (metPairs < totalPairs && !force) {
      const neverPlayed = standings.filter(t => standings[0].played > 0 && t.played === 0).map(t => t.name);
      return NextResponse.json({
        error: `The round robin is not complete: ${metPairs} of ${totalPairs} fixtures played.`
            + (neverPlayed.length ? ` Never played: ${neverPlayed.join(', ')}.` : ''),
        incomplete: true,
        fixtures_played: metPairs,
        fixtures_total: totalPairs,
      }, { status: 409 });
    }

    const top4 = standings.slice(0, 4);

    const { rows: [maxRound] } = await db.execute({ sql: 'SELECT MAX(round) AS maxRound FROM matches WHERE season_id = ?', args: [season.id] });
    const nextRound = (Number(maxRound.maxRound) || 0) + 1;

    const insert = 'INSERT INTO matches (id, season_id, round, home_team_id, away_team_id, match_type, is_played) VALUES (?, ?, ?, ?, ?, ?, 0)';
    await db.batch([
      { sql: insert, args: [crypto.randomUUID(), season.id, nextRound, top4[0].id, top4[3].id, MATCH_TYPES.semifinal1] },
      { sql: insert, args: [crypto.randomUUID(), season.id, nextRound, top4[1].id, top4[2].id, MATCH_TYPES.semifinal2] },
    ], 'write');

    return NextResponse.json({ success: true, round: nextRound, qualified: top4.map(t => t.name) });
  } catch (error) {
    console.error('Error generating playoffs:', error);
    return NextResponse.json({ error: 'Failed to generate playoffs' }, { status: 500 });
  }
}
