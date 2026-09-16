import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { computeStandings } from '@/lib/standings';

export async function GET() {
  try {
    // Eseguiamo tutte le query simultaneamente per abbattere i tempi di caricamento
    const [teamStandings, scorersRes, killersRes, mvpsRes, sppRes, totalsRes] = await Promise.all([
      // 1. Team Standings (solo partite di campionato)
      computeStandings(),

      // 2. Top Scorers (TDs)
      db.execute(`
        SELECT p.id, p.name, t.name as team_name, t.primary_color, SUM(s.touchdowns) as total_td
        FROM players p
        JOIN teams t ON p.team_id = t.id
        JOIN player_stats s ON p.id = s.player_id
        GROUP BY p.id
        HAVING total_td > 0
        ORDER BY total_td DESC
        LIMIT 10
      `),

      // 3. Top Killers (CAS)
      db.execute(`
        SELECT p.id, p.name, t.name as team_name, t.primary_color, SUM(s.casualties) as total_cas
        FROM players p
        JOIN teams t ON p.team_id = t.id
        JOIN player_stats s ON p.id = s.player_id
        GROUP BY p.id
        HAVING total_cas > 0
        ORDER BY total_cas DESC
        LIMIT 10
      `),

      // 4. Most MVPs
      db.execute(`
        SELECT p.id, p.name, t.name as team_name, t.primary_color, SUM(s.mvp) as total_mvp
        FROM players p
        JOIN teams t ON p.team_id = t.id
        JOIN player_stats s ON p.id = s.player_id
        GROUP BY p.id
        HAVING total_mvp > 0
        ORDER BY total_mvp DESC
        LIMIT 10
      `),

      // 5. Most SPP (Experience)
      db.execute(`
        SELECT p.id, p.name, t.name as team_name, t.primary_color, SUM(s.spp_earned) as total_spp
        FROM players p
        JOIN teams t ON p.team_id = t.id
        JOIN player_stats s ON p.id = s.player_id
        GROUP BY p.id
        HAVING total_spp > 0
        ORDER BY total_spp DESC
        LIMIT 10
      `),

      // 6. Totali di lega (tutte le partite giocate, di qualsiasi tipo)
      db.execute(`
        SELECT COUNT(*) AS matches_played,
               COALESCE(SUM(home_casualties + away_casualties), 0) AS casualties
        FROM matches
        WHERE is_played = 1
      `)
    ]);

    return NextResponse.json({
      standings: teamStandings,
      totals: {
        teams: teamStandings.length,
        matches_played: Number(totalsRes.rows[0].matches_played),
        casualties: Number(totalsRes.rows[0].casualties)
      },
      playerStats: {
        scorers: scorersRes.rows,
        killers: killersRes.rows,
        mvps: mvpsRes.rows,
        spp: sppRes.rows
      }
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}