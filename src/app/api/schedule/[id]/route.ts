import { NextResponse } from 'next/server';
import db from '@/lib/db';
import crypto from 'crypto';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get match and team basics
    const match = db.prepare(`
      SELECT m.*, 
        th.name as home_name, th.logo_url as home_logo, th.primary_color as home_color,
        ta.name as away_name, ta.logo_url as away_logo, ta.primary_color as away_color
      FROM matches m
      JOIN teams th ON m.home_team_id = th.id
      JOIN teams ta ON m.away_team_id = ta.id
      WHERE m.id = ?
    `).get(id) as any;

    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

    // Get players for both teams
    const homePlayers = db.prepare('SELECT id, name, role, status, team_id FROM players WHERE team_id = ?').all(match.home_team_id);
    const awayPlayers = db.prepare('SELECT id, name, role, status, team_id FROM players WHERE team_id = ?').all(match.away_team_id);

    // Get existing stats if played
    const stats = db.prepare('SELECT * FROM player_stats WHERE match_id = ?').all(id);

    return NextResponse.json({
      ...match,
      homePlayers,
      awayPlayers,
      stats
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch match' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { home_score, away_score, home_casualties, away_casualties, playerStats } = body;

    // Run within transaction
    const updateMatch = db.transaction(() => {
      // 1. Update match scores and status
      db.prepare(`
        UPDATE matches 
        SET home_score = ?, away_score = ?, home_casualties = ?, away_casualties = ?, is_played = 1, played_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(home_score, away_score, home_casualties, away_casualties, id);

      // 2. Delete existing stats for this match (if re-saving)
      db.prepare('DELETE FROM player_stats WHERE match_id = ?').run(id);

      // 3. Insert new player stats
      const insertStat = db.prepare(`
        INSERT INTO player_stats (id, match_id, player_id, touchdowns, casualties, interceptions, completions, mvp, spp_earned)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const stat of playerStats) {
        // Calculate SPP: TD=3, CAS=2, INT=2, COMP=1, MVP=5
        const spp = (stat.td * 3) + (stat.cas * 2) + (stat.int * 2) + (stat.comp * 1) + (stat.mvp * 5);

        // Only insert if there's actual activity to save DB space
        if (spp > 0) {
          insertStat.run(
            crypto.randomUUID(), id, stat.player_id, 
            stat.td, stat.cas, stat.int, stat.comp, stat.mvp, spp
          );
        }

        // 4. Update the player's status and recalculate full lifetime SPP
        db.prepare('UPDATE players SET status = ? WHERE id = ?').run(stat.status || 'Active', stat.player_id);
        
        db.prepare(`
          UPDATE players 
          SET spp = (SELECT COALESCE(SUM(spp_earned), 0) FROM player_stats WHERE player_id = ?)
          WHERE id = ?
        `).run(stat.player_id, stat.player_id);
      }
    });

    updateMatch();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to save match results' }, { status: 500 });
  }
}
