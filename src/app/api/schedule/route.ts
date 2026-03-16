import { NextResponse } from 'next/server';
import db from '@/lib/db';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const teams = db.prepare('SELECT id FROM teams').all() as { id: string }[];
    
    if (teams.length < 2) {
      return NextResponse.json({ error: 'Need at least 2 teams to generate a schedule' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const action = body.action || 'auto-fill'; // 'auto-fill' or 'manual'

    if (action === 'manual') {
      const { round, home_team_id, away_team_id } = body;
      if (!round || !home_team_id || !away_team_id) {
        return NextResponse.json({ error: 'Missing match details' }, { status: 400 });
      }

      const existingMatch = db.prepare('SELECT id FROM matches WHERE round = ? AND ((home_team_id = ? AND away_team_id = ?) OR (home_team_id = ? AND away_team_id = ?))').get(round, home_team_id, away_team_id, away_team_id, home_team_id);
      if (existingMatch) {
        return NextResponse.json({ error: 'These teams already play each other in this round' }, { status: 400 });
      }

      db.prepare(`
        INSERT INTO matches (id, round, home_team_id, away_team_id, match_type)
        VALUES (?, ?, ?, ?, 'Regular Season')
      `).run(crypto.randomUUID(), round, home_team_id, away_team_id);

      return NextResponse.json({ success: true });
    }

    // Auto-fill logic
    // First, get all existing matches
    const existingMatches = db.prepare('SELECT round, home_team_id, away_team_id FROM matches WHERE match_type = "Regular Season"').all() as any[];

    // We will generate a complete double round-robin, and then only add matches that don't already exist somewhere.
    const teamIds = teams.map(t => t.id);
    if (teamIds.length % 2 !== 0) {
      teamIds.push('BYE'); // Dummy team for odd numbers
    }

    const numTeams = teamIds.length;
    const numRounds = numTeams - 1;
    const halfSize = numTeams / 2;
    
    const matchesToInsert: { requested_round: number, home: string, away: string }[] = [];
    
    // Generate First Half (Round 1 to N-1)
    let currentTeamIds = [...teamIds];
    
    for (let round = 1; round <= numRounds; round++) {
      for (let i = 0; i < halfSize; i++) {
        const home = currentTeamIds[i];
        const away = currentTeamIds[numTeams - 1 - i];
        
        if (home !== 'BYE' && away !== 'BYE') {
           // Alternate home/away based on round for fairness
           if (i === 0 && round % 2 === 0) {
              matchesToInsert.push({ requested_round: round, home: away, away: home });
           } else {
              matchesToInsert.push({ requested_round: round, home, away });
           }
        }
      }
      
      // Rotate array (keep first element fixed)
      const first = currentTeamIds[0];
      const last = currentTeamIds.pop()!;
      currentTeamIds = [first, last, ...currentTeamIds.slice(1)];
    }

    // Generate Second Half (Double Round Robin) -> switch home and away
    const firstHalfMatches = [...matchesToInsert];
    for (const match of firstHalfMatches) {
      matchesToInsert.push({
        requested_round: match.requested_round + numRounds,
        home: match.away,
        away: match.home
      });
    }

    // Now filter out matches that HAVE ALREADY BEEN PLAYED (or scheduled) AT ALL in the entire season.
    // In a double round robin, team A plays team B twice (once home, once away).
    // If user created A vs B manually (Home: A, Away: B), we shouldn't auto-schedule another Home: A, Away: B.
    
    let addedCount = 0;

    const insertMatch = db.prepare(`
      INSERT INTO matches (id, round, home_team_id, away_team_id, match_type)
      VALUES (?, ?, ?, ?, 'Regular Season')
    `);

    db.transaction(() => {
        for (const generated of matchesToInsert) {
            // Check if THIS EXACT matchup (Home vs Away) already exists ANYWHERE in the season
            const alreadyScheduledExact = existingMatches.some(em => 
                em.home_team_id === generated.home && em.away_team_id === generated.away
            );

            if (!alreadyScheduledExact) {
                // Determine which round to put it in. We try to put it in generated.requested_round.
                // But what if one of the teams already plays in that round manually?
                // For a robust auto-fill, we'd need a more complex bipartite matching.
                // For simplicity here, we'll assign it to the requested_round, but let's shift it if there's a conflict.
                let targetRound = generated.requested_round;
                let conflict = true;
                
                while(conflict) {
                     const teamHasMatchInRound = existingMatches.some(em => 
                         em.round === targetRound && 
                         (em.home_team_id === generated.home || em.away_team_id === generated.home ||
                          em.home_team_id === generated.away || em.away_team_id === generated.away)
                     );
                     
                     if (!teamHasMatchInRound) {
                         conflict = false;
                     } else {
                         targetRound++;
                     }
                }

                // We found a round!
                insertMatch.run(crypto.randomUUID(), targetRound, generated.home, generated.away);
                
                // Track it so we don't conflict with ourselves in the next loop iterations
                existingMatches.push({
                    round: targetRound, 
                    home_team_id: generated.home, 
                    away_team_id: generated.away
                });

                addedCount++;
            }
        }
    })();

    return NextResponse.json({ success: true, added: addedCount });
  } catch (error) {
    console.error('Error generating schedule:', error);
    return NextResponse.json({ error: 'Failed to generate schedule' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const matches = db.prepare(`
      SELECT 
        m.*,
        th.name as home_name, th.logo_url as home_logo, th.primary_color as home_color,
        ta.name as away_name, ta.logo_url as away_logo, ta.primary_color as away_color
      FROM matches m
      JOIN teams th ON m.home_team_id = th.id
      JOIN teams ta ON m.away_team_id = ta.id
      ORDER BY m.round ASC
    `).all();

    return NextResponse.json(matches);
  } catch (error) {
    console.error('Error fetching schedule:', error);
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 });
  }
}
