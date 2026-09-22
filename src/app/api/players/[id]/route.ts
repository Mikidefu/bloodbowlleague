import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { LIMITS } from '@/lib/leagueRules';
import { getPosition, getRoster } from '@/lib/rosters';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { rows } = await db.execute({ sql: 'SELECT * FROM players WHERE id = ?', args: [id] });
    const existing = rows[0];
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const skillsQuery = await db.execute({
      sql: `SELECT s.* FROM skills s JOIN skills_players sp ON s.id = sp.skill_id WHERE sp.player_id = ?`,
      args: [id]
    });

    return NextResponse.json({
      ...existing,
      skills: skillsQuery.rows,
      mng: !!existing.mng,
      dead: !!existing.dead
    });
  } catch (error) {
    console.error('Error fetching player:', error);
    return NextResponse.json({ error: 'Failed to fetch player' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    // Gli SPP non si modificano da qui: sono calcolati (vedi lib/spp.ts) e spesi tramite /advance
    const { jersey_number, name, role, value, primary_skills, secondary_skills, advancements, status, skills, ma, st, ag, pa, av, mng, dead } = body;

    const { rows: [player] } = await db.execute({
      sql: 'SELECT p.*, t.roster FROM players p JOIN teams t ON t.id = p.team_id WHERE p.id = ?',
      args: [id],
    });
    if (!player) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Temporarily Retiring (p. 99): solo per chi ha subito un Lasting Injury
    let tempRetired: number | null = null;
    if (body.temp_retired !== undefined) {
      tempRetired = body.temp_retired ? 1 : 0;
      if (tempRetired) {
        const { rows: [li] } = await db.execute({ sql: "SELECT 1 FROM player_injuries WHERE player_id = ? AND result = 'LI' LIMIT 1", args: [id] });
        if (!li) return NextResponse.json({ error: 'Only a player who suffered a Lasting Injury can be Temporarily Retiring (p. 99)' }, { status: 400 });
      }
    }

    // Collegamento a una posizione del roster (squadre create prima dei roster)
    let positionKey: string | null = null;
    let hiringFee: number | null = null;
    if (body.position_key) {
      const position = getPosition(getRoster(player.roster as string | null), body.position_key);
      if (!position) return NextResponse.json({ error: 'Unknown position for this Team Roster' }, { status: 400 });
      positionKey = position.key;
      hiringFee = position.cost;
    }

    await db.execute({
      sql: `
        UPDATE players
        SET jersey_number = COALESCE(?, jersey_number), name = COALESCE(?, name), role = COALESCE(?, role), value = COALESCE(?, value),
            primary_skills = COALESCE(?, primary_skills), secondary_skills = COALESCE(?, secondary_skills), advancements = COALESCE(?, advancements),
            status = COALESCE(?, status), ma = COALESCE(?, ma), st = COALESCE(?, st), ag = COALESCE(?, ag), pa = COALESCE(?, pa), av = COALESCE(?, av),
            mng = COALESCE(?, mng), dead = COALESCE(?, dead), temp_retired = COALESCE(?, temp_retired),
            position_key = COALESCE(?, position_key), hiring_fee = COALESCE(?, hiring_fee)
        WHERE id = ?
      `,
      args: [
        jersey_number ?? null, name ?? null, role ?? null, value ?? null,
        primary_skills ?? null, secondary_skills ?? null, advancements ?? null,
        status ?? null, ma ?? null, st ?? null, ag ?? null, pa ?? null, av ?? null,
        mng !== undefined ? (mng ? 1 : 0) : null, dead !== undefined ? (dead ? 1 : 0) : null, tempRetired,
        positionKey, hiringFee, id
      ]
    });

    if (skills !== undefined && Array.isArray(skills)) {
      await db.execute({ sql: 'DELETE FROM skills_players WHERE player_id = ?', args: [id] });
      for (const skillId of skills) {
        await db.execute({ sql: `INSERT INTO skills_players (player_id, skill_id) VALUES (?, ?)`, args: [id, skillId] });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating player:', error);
    return NextResponse.json({ error: 'Failed to update player' }, { status: 500 });
  }
}

// Licenziamento (p. 99, step 3).
// - Non si può scendere sotto 11 giocatori disponibili per la prossima partita.
// - Il Team Captain si licenzia solo se ha subito una riduzione delle caratteristiche (p. 155).
// Chi ha uno storico (statistiche, avanzamenti, infortuni) resta nel database come "ha lasciato la squadra";
// un giocatore senza storico (es. inserito per errore) viene eliminato.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { rows: [player] } = await db.execute({ sql: 'SELECT * FROM players WHERE id = ?', args: [id] });
    if (!player) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (!player.dead && !player.left_team) {
      const isEligible = (p: Record<string, unknown>) => !p.dead && !p.left_team && !p.mng && !p.temp_retired && !p.journeyman;
      if (isEligible(player)) {
        const { rows: teammates } = await db.execute({ sql: 'SELECT * FROM players WHERE team_id = ?', args: [String(player.team_id)] });
        const eligible = teammates.filter(isEligible).length;
        if (eligible - 1 < LIMITS.minPlayers) {
          return NextResponse.json({ error: `Players may not be fired if it would take the number of players eligible for the next game below ${LIMITS.minPlayers} (p. 99)` }, { status: 400 });
        }
      }
      if (player.is_captain) {
        const { rows: [reduced] } = await db.execute({ sql: "SELECT 1 FROM player_injuries WHERE player_id = ? AND result = 'LI' AND stat_applied = 1 LIMIT 1", args: [id] });
        if (!reduced) return NextResponse.json({ error: 'A Team Captain can only be fired after an injury that reduced one of their characteristics (p. 155)' }, { status: 400 });
      }
    }

    const { rows: [history] } = await db.execute({
      sql: `SELECT (SELECT COUNT(*) FROM player_stats WHERE player_id = ?) + (SELECT COUNT(*) FROM player_advancements WHERE player_id = ?)
                 + (SELECT COUNT(*) FROM player_injuries WHERE player_id = ?) AS n`,
      args: [id, id, id],
    });
    if (Number(history.n) > 0) {
      await db.execute({ sql: 'UPDATE players SET left_team = 1, journeyman = 0, is_captain = 0 WHERE id = ?', args: [id] });
    } else {
      await db.execute({ sql: 'DELETE FROM players WHERE id = ?', args: [id] });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting player:', error);
    return NextResponse.json({ error: 'Failed to delete player' }, { status: 500 });
  }
}
