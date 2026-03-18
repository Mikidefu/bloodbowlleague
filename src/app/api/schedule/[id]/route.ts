import { NextResponse } from 'next/server';
import db from '@/lib/db';
import crypto from 'crypto';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Recupero info base del match
    const { rows: matchRows } = await db.execute({
      sql: `
        SELECT m.*,
               th.name as home_name, th.logo_url as home_logo, th.primary_color as home_color,
               ta.name as away_name, ta.logo_url as away_logo, ta.primary_color as away_color
        FROM matches m
               JOIN teams th ON m.home_team_id = th.id
               JOIN teams ta ON m.away_team_id = ta.id
        WHERE m.id = ?
      `,
      args: [id]
    });

    const match = matchRows[0];
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

    // Recupero parallelo per maggiore velocità
    // AGGIUNTA: jersey_number nel SELECT
    const [homePlayersRes, awayPlayersRes, statsRes] = await Promise.all([
      db.execute({ sql: 'SELECT id, jersey_number, name, role, status, team_id, mng, dead FROM players WHERE team_id = ?', args: [match.home_team_id] }),
      db.execute({ sql: 'SELECT id, jersey_number, name, role, status, team_id, mng, dead FROM players WHERE team_id = ?', args: [match.away_team_id] }),
      db.execute({ sql: 'SELECT * FROM player_stats WHERE match_id = ?', args: [id] })
    ]);

    return NextResponse.json({
      ...match,
      homePlayers: homePlayersRes.rows,
      awayPlayers: awayPlayersRes.rows,
      stats: statsRes.rows
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
    const { home_score, away_score, home_casualties, away_casualties, playerStats, match_date } = body;

    const statements = [];

    // 1. Update match scores and status
    statements.push({
      sql: `
        UPDATE matches
        SET home_score = ?, away_score = ?, home_casualties = ?, away_casualties = ?, is_played = 1, played_at = CURRENT_TIMESTAMP, match_date = ?
        WHERE id = ?
      `,
      args: [home_score ?? 0, away_score ?? 0, home_casualties ?? 0, away_casualties ?? 0, match_date || null, id]
    });

    // 2. Delete existing stats for this match
    statements.push({
      sql: 'DELETE FROM player_stats WHERE match_id = ?',
      args: [id]
    });

    // 3. Elaborazione statistiche giocatori
    for (const stat of playerStats) {
      const spp = (stat.td * 3) + (stat.cas * 2) + (stat.int * 2) + (stat.comp * 1) + (stat.mvp * 5);

      if (spp > 0) {
        statements.push({
          sql: `
            INSERT INTO player_stats (id, match_id, player_id, touchdowns, casualties, interceptions, completions, mvp, spp_earned)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          args: [crypto.randomUUID(), id, stat.player_id, stat.td, stat.cas, stat.int, stat.comp, stat.mvp, spp]
        });
      }

      // 4. Update status and recalculate SPP
      const isDead = stat.status === 'Dead' ? 1 : 0;
      const isMng = stat.status === 'Injured' ? 1 : 0;

      statements.push({
        sql: 'UPDATE players SET status = ?, mng = ?, dead = ? WHERE id = ?',
        args: [stat.status || 'Active', isMng, isDead, stat.player_id]
      });

      statements.push({
        sql: `
          UPDATE players
          SET spp = (SELECT COALESCE(SUM(spp_earned), 0) FROM player_stats WHERE player_id = ?)
          WHERE id = ?
        `,
        args: [stat.player_id, stat.player_id]
      });
    }

    // Esegue tutta l'operazione in modo atomico e sicuro
    await db.batch(statements, 'write');

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to save match results' }, { status: 500 });
  }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Troviamo i giocatori coinvolti prima di cancellare
    const { rows: playersToRecalc } = await db.execute({
      sql: 'SELECT DISTINCT player_id FROM player_stats WHERE match_id = ?',
      args: [id]
    });

    // 2. Prepariamo l'array delle transazioni
    const statements = [];

    // ELIMINAZIONE ESPLICITA DELLE STATS (più sicuro del CASCADE)
    statements.push({
      sql: 'DELETE FROM player_stats WHERE match_id = ?',
      args: [id]
    });

    // Eliminazione del match
    statements.push({
      sql: 'DELETE FROM matches WHERE id = ?',
      args: [id]
    });

    // Ricalcolo SPP per ogni giocatore coinvolto (ora le stat della partita non esistono più)
    for (const p of playersToRecalc) {
      statements.push({
        sql: `
          UPDATE players 
          SET spp = (SELECT COALESCE(SUM(spp_earned), 0) FROM player_stats WHERE player_id = ?)
          WHERE id = ?
        `,
        args: [p.player_id, p.player_id]
      });
    }

    // Eseguiamo tutto insieme
    await db.batch(statements, 'write');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting match:', error);
    return NextResponse.json({ error: 'Failed to delete match' }, { status: 500 });
  }
}