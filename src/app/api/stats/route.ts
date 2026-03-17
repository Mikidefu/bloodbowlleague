import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    // Eseguiamo tutte le query simultaneamente per abbattere i tempi di caricamento
    const [standingsRes, scorersRes, killersRes, mvpsRes, sppRes] = await Promise.all([
      // 1. Team Standings
      db.execute(`
        SELECT 
          t.id, t.name, t.logo_url, t.primary_color, t.secondary_color,
          COUNT(m.id) as played,
          SUM(CASE WHEN m.home_team_id = t.id AND m.home_score > m.away_score THEN 1 
                   WHEN m.away_team_id = t.id AND m.away_score > m.home_score THEN 1 ELSE 0 END) as wins,
          SUM(CASE WHEN m.home_score = m.away_score THEN 1 ELSE 0 END) as draws,
          SUM(CASE WHEN m.home_team_id = t.id AND m.home_score < m.away_score THEN 1 
                   WHEN m.away_team_id = t.id AND m.away_score < m.home_score THEN 1 ELSE 0 END) as losses,
          SUM(CASE WHEN m.home_team_id = t.id THEN m.home_score ELSE m.away_score END) as td_for,
          SUM(CASE WHEN m.home_team_id = t.id THEN m.away_score ELSE m.home_score END) as td_against,
          SUM(CASE WHEN m.home_team_id = t.id THEN m.home_casualties ELSE m.away_casualties END) as cas_for,
          SUM(CASE WHEN m.home_team_id = t.id THEN m.away_casualties ELSE m.home_casualties END) as cas_against
        FROM teams t
        LEFT JOIN matches m ON (t.id = m.home_team_id OR t.id = m.away_team_id) AND m.is_played = 1
        GROUP BY t.id
      `),

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
      `)
    ]);

    // Processiamo e calcoliamo i punti in memoria, forzando i tipi numerici per sicurezza
    const teamStandings = standingsRes.rows.map((t: any) => {
      const wins = Number(t.wins || 0);
      const draws = Number(t.draws || 0);
      const losses = Number(t.losses || 0);
      const td_for = Number(t.td_for || 0);
      const td_against = Number(t.td_against || 0);
      const cas_for = Number(t.cas_for || 0);
      const cas_against = Number(t.cas_against || 0);

      return {
        ...t,
        played: Number(t.played || 0),
        wins,
        draws,
        losses,
        td_for,
        td_against,
        cas_for,
        cas_against,
        points: (wins * 3) + (draws * 1),
        td_diff: td_for - td_against, // Errore di battitura corretto qui
        cas_diff: cas_for - cas_against,
      };
    }).sort((a: any, b: any) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.td_diff !== a.td_diff) return b.td_diff - a.td_diff;
      return b.cas_diff - a.cas_diff;
    });

    return NextResponse.json({
      standings: teamStandings,
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