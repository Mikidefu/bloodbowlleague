import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    // Team Standings (3 pts for win, 1 for tie, 0 for loss)
    // Order by Points DESC, TD Diff DESC, CAS Diff DESC
    const teamStandings = db.prepare(`
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

    // Top Scorers (TDs)
    const topScorers = db.prepare(`
      SELECT p.id, p.name, t.name as team_name, t.primary_color, SUM(s.touchdowns) as total_td
      FROM players p
      JOIN teams t ON p.team_id = t.id
      JOIN player_stats s ON p.id = s.player_id
      GROUP BY p.id
      HAVING total_td > 0
      ORDER BY total_td DESC
      LIMIT 10
    `).all();

    // Top Killers (CAS)
    const topKillers = db.prepare(`
      SELECT p.id, p.name, t.name as team_name, t.primary_color, SUM(s.casualties) as total_cas
      FROM players p
      JOIN teams t ON p.team_id = t.id
      JOIN player_stats s ON p.id = s.player_id
      GROUP BY p.id
      HAVING total_cas > 0
      ORDER BY total_cas DESC
      LIMIT 10
    `).all();

    // Most MVPs
    const topMvps = db.prepare(`
      SELECT p.id, p.name, t.name as team_name, t.primary_color, SUM(s.mvp) as total_mvp
      FROM players p
      JOIN teams t ON p.team_id = t.id
      JOIN player_stats s ON p.id = s.player_id
      GROUP BY p.id
      HAVING total_mvp > 0
      ORDER BY total_mvp DESC
      LIMIT 10
    `).all();

    // Most SPP (Experience)
    const topSpp = db.prepare(`
      SELECT p.id, p.name, t.name as team_name, t.primary_color, SUM(s.spp_earned) as total_spp
      FROM players p
      JOIN teams t ON p.team_id = t.id
      JOIN player_stats s ON p.id = s.player_id
      GROUP BY p.id
      HAVING total_spp > 0
      ORDER BY total_spp DESC
      LIMIT 10
    `).all();

    return NextResponse.json({
      standings: teamStandings,
      playerStats: {
        scorers: topScorers,
        killers: topKillers,
        mvps: topMvps,
        spp: topSpp
      }
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
