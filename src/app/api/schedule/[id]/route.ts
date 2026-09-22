import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { seasonStatusSql } from '@/lib/seasons';
import { applyResult, deleteMatchStatements } from '@/lib/matchRules';
import { lockedMatchResponse, ruleErrorResponse } from '@/lib/matchApi';
import { computeTeamValue } from '@/lib/teamValue';
import { flag, toMatchPlayer, toPlayerInjury, toPlayerStats } from '@/lib/players';

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
               ta.name as away_name, ta.logo_url as away_logo, ta.primary_color as away_color,
               s.name as season_name, ${seasonStatusSql('s')} as season_status
        FROM matches m
               JOIN teams th ON m.home_team_id = th.id
               JOIN teams ta ON m.away_team_id = ta.id
               LEFT JOIN seasons s ON s.id = m.season_id
        WHERE m.id = ?
      `,
      args: [id]
    });

    const match = matchRows[0];
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

    const [teamsRes, playersRes, statsRes, reportsRes, injuriesRes] = await Promise.all([
      db.execute({ sql: 'SELECT * FROM teams WHERE id IN (?, ?)', args: [match.home_team_id, match.away_team_id] }),
      db.execute({ sql: 'SELECT * FROM players WHERE team_id IN (?, ?) ORDER BY jersey_number, created_at', args: [match.home_team_id, match.away_team_id] }),
      db.execute({ sql: 'SELECT * FROM player_stats WHERE match_id = ?', args: [id] }),
      db.execute({ sql: 'SELECT * FROM match_team_reports WHERE match_id = ?', args: [id] }),
      db.execute({ sql: 'SELECT * FROM player_injuries WHERE match_id = ?', args: [id] }),
    ]);

    const reports = reportsRes.rows;
    const parseIds = (value: unknown) => { try { return value ? JSON.parse(String(value)) as string[] : []; } catch { return []; } };
    const recovered = new Set(reports.flatMap(r => parseIds(r.recovered_player_ids)));
    const quit = new Set(reports.flatMap(r => parseIds(r.quit_player_ids)));
    const released = new Set(reports.flatMap(r => parseIds(r.released_player_ids)));
    const diedHere = new Set(injuriesRes.rows.filter(i => i.result === 'DEAD').map(i => String(i.player_id)));
    const statPlayers = new Set(statsRes.rows.map(s => String(s.player_id)));

    // Chi compare nel referto e se poteva giocare questa partita
    const players = playersRes.rows
        .filter(p => {
          const pid = String(p.id);
          if (statPlayers.has(pid) || diedHere.has(pid) || quit.has(pid) || released.has(pid)) return true;
          if (flag(p.journeyman) && p.journeyman_match_id !== id) return false;
          return !flag(p.left_team) && !flag(p.dead);
        })
        .map(p => {
          const missed = match.rules_applied
              ? recovered.has(String(p.id))
              : flag(p.mng) && p.mng_match_id !== id;
          // Non disponibile per questa partita: saltava per infortunio o è Temporarily Retiring
          return toMatchPlayer(p, missed ? 'mng' : flag(p.temp_retired) ? 'retired' : null);
        });

    const teams = teamsRes.rows.map(t => ({
      id: t.id, name: t.name, roster: t.roster, team_league: t.team_league, favoured_of: t.favoured_of,
      dedicated_fans: Number(t.fan_factor || 0), treasury: Number(t.treasury || 0), apothecary: flag(t.apothecary),
      ...computeTeamValue(t, playersRes.rows.filter(p => p.team_id === t.id)),
    }));

    return NextResponse.json({
      ...match,
      teams,
      reports,
      injuries: injuriesRes.rows.map(toPlayerInjury),
      homePlayers: players.filter(p => p.team_id === match.home_team_id),
      awayPlayers: players.filter(p => p.team_id === match.away_team_id),
      stats: statsRes.rows.map(toPlayerStats)
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

    const locked = await lockedMatchResponse(id);
    if (locked) return locked;

    // Cambio della sola data: non tocca risultato, statistiche né stato "giocata"
    if (body.date_only) {
      await db.execute({ sql: 'UPDATE matches SET match_date = ? WHERE id = ?', args: [body.match_date || null, id] });
      return NextResponse.json({ success: true });
    }

    // Referto e sequenza post-partita (vedi lib/matchRules.ts)
    await applyResult(id, body);
    return NextResponse.json({ success: true });
  } catch (err) {
    const ruleResponse = ruleErrorResponse(err);
    if (ruleResponse) return ruleResponse;
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

    const locked = await lockedMatchResponse(id);
    if (locked) return locked;

    // Elimina la partita annullando Treasury, fan, infortuni, Journeymen e SPP che aveva prodotto
    await db.batch(await deleteMatchStatements(id), 'write');

    return NextResponse.json({ success: true });
  } catch (error) {
    const ruleResponse = ruleErrorResponse(error);
    if (ruleResponse) return ruleResponse;
    console.error('Error deleting match:', error);
    return NextResponse.json({ error: 'Failed to delete match' }, { status: 500 });
  }
}
