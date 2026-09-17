import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { computeStandings } from '@/lib/standings';
import { resolveSeason, seasonNotFound } from '@/lib/seasons';

// Classifica e statistiche di una stagione (?season=<id>, default: stagione attiva)
export async function GET(request: Request) {
  try {
    const season = await resolveSeason(request);
    if (!season) return seasonNotFound();

    // Migliori giocatori della stagione per una statistica (solo partite di quella stagione)
    const leaders = (column: string, alias: string) => db.execute({
      sql: `
        SELECT p.id, p.name, t.name as team_name, t.primary_color, SUM(s.${column}) as ${alias}
        FROM player_stats s
        JOIN matches m ON m.id = s.match_id AND m.season_id = ?
        JOIN players p ON p.id = s.player_id
        JOIN teams t ON p.team_id = t.id
        GROUP BY p.id
        HAVING ${alias} > 0
        ORDER BY ${alias} DESC
        LIMIT 10
      `,
      args: [season.id]
    });

    // Eseguiamo tutte le query simultaneamente per abbattere i tempi di caricamento
    const [teamStandings, scorersRes, killersRes, mvpsRes, sppRes, totalsRes] = await Promise.all([
      // 1. Team Standings (solo partite di campionato)
      computeStandings(season.id),
      // 2-5. Top Scorers (TD), Top Killers (CAS), Most MVPs, Most SPP
      leaders('touchdowns', 'total_td'),
      leaders('casualties', 'total_cas'),
      leaders('mvp', 'total_mvp'),
      leaders('spp_earned', 'total_spp'),
      // 6. Totali della stagione (tutte le partite giocate, di qualsiasi tipo)
      db.execute({
        sql: `
          SELECT COUNT(*) AS matches_played,
                 COALESCE(SUM(home_casualties + away_casualties), 0) AS casualties
          FROM matches
          WHERE is_played = 1 AND season_id = ?
        `,
        args: [season.id]
      })
    ]);

    return NextResponse.json({
      season,
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
