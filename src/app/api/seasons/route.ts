import { NextResponse } from 'next/server';
import crypto from 'crypto';
import db from '@/lib/db';
import { CoachInputError, resolveCoachInput } from '@/lib/coaches';
import { getActiveSeason } from '@/lib/seasons';
import { computePlayoffFinishes } from '@/lib/standings';

// Elenco stagioni con partecipanti, avanzamento del calendario e campione (se la finale è stata giocata)
export async function GET() {
  try {
    const { rows } = await db.execute(`
      SELECT s.*,
             (SELECT COUNT(*) FROM season_teams st WHERE st.season_id = s.id) AS teams_count,
             (SELECT COUNT(*) FROM matches m WHERE m.season_id = s.id) AS matches_total,
             (SELECT COUNT(*) FROM matches m WHERE m.season_id = s.id AND m.is_played = 1) AS matches_played
      FROM seasons s
      ORDER BY s.number DESC
    `);

    const seasons = await Promise.all(rows.map(async s => {
      const finishes = await computePlayoffFinishes(String(s.id));
      const championId = [...finishes.entries()].find(([, finish]) => finish === 'champion')?.[0];
      let champion = null;
      if (championId) {
        const { rows: [c] } = await db.execute({
          sql: `SELECT t.id AS team_id, t.name AS team_name, co.name AS coach_name
                FROM teams t
                LEFT JOIN season_teams st ON st.team_id = t.id AND st.season_id = ?
                LEFT JOIN coaches co ON co.id = st.coach_id
                WHERE t.id = ?`,
          args: [s.id, championId],
        });
        champion = c ?? null;
      }
      return {
        id: String(s.id),
        number: Number(s.number),
        name: String(s.name),
        status: String(s.status),
        started_at: s.started_at,
        ended_at: s.ended_at,
        teams_count: Number(s.teams_count),
        matches_total: Number(s.matches_total),
        matches_played: Number(s.matches_played),
        champion,
      };
    }));

    return NextResponse.json(seasons);
  } catch (error) {
    console.error('Error fetching seasons:', error);
    return NextResponse.json({ error: 'Failed to fetch seasons' }, { status: 500 });
  }
}

type SeasonTeamInput = { team_id?: unknown; coach_id?: unknown; new_coach_name?: unknown };

// Avvia una nuova stagione: chiude quella attiva e iscrive le squadre che proseguono, con il loro allenatore.
// Le squadre nuove si creano poi da "Draft team" e vengono iscritte automaticamente alla stagione attiva.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const force = body.force === true;
    const teamsInput: SeasonTeamInput[] = Array.isArray(body.teams) ? body.teams : [];

    const active = await getActiveSeason();

    // Stagione in corso non finita: serve una conferma esplicita
    if (active && !force) {
      const { rows: [pending] } = await db.execute({
        sql: 'SELECT COUNT(*) AS c FROM matches WHERE season_id = ? AND is_played = 0',
        args: [active.id],
      });
      if (Number(pending.c) > 0) {
        return NextResponse.json({
          error: `${active.name} still has ${pending.c} match(es) to play.`,
          incomplete: true,
          pending_matches: Number(pending.c),
        }, { status: 409 });
      }
    }

    // Validazione squadre
    const teamIds = teamsInput.map(t => String(t.team_id ?? ''));
    if (teamIds.some(id => !id)) {
      return NextResponse.json({ error: 'Every team entry needs a team_id' }, { status: 400 });
    }
    if (new Set(teamIds).size !== teamIds.length) {
      return NextResponse.json({ error: 'A team can be enrolled only once per season' }, { status: 400 });
    }
    if (teamIds.length > 0) {
      const { rows: existing } = await db.execute({
        sql: `SELECT id FROM teams WHERE id IN (${teamIds.map(() => '?').join(',')})`,
        args: teamIds,
      });
      if (existing.length !== teamIds.length) {
        return NextResponse.json({ error: 'One or more teams do not exist' }, { status: 400 });
      }
    }

    const { rows: [maxRow] } = await db.execute('SELECT COALESCE(MAX(number), 0) AS n FROM seasons');
    const number = Number(maxRow.n) + 1;
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 60) : `Season ${number}`;
    const seasonId = crypto.randomUUID();

    const statements: { sql: string; args: (string | number | null)[] }[] = [];
    if (active) {
      statements.push({
        sql: "UPDATE seasons SET status = 'completed', ended_at = CURRENT_TIMESTAMP WHERE id = ?",
        args: [active.id],
      });
    }
    statements.push({
      sql: "INSERT INTO seasons (id, number, name, status) VALUES (?, ?, ?, 'active')",
      args: [seasonId, number, name],
    });

    // Lo stesso nuovo allenatore indicato per più squadre viene creato una volta sola
    const createdByName = new Map<string, string>();
    for (const entry of teamsInput) {
      const newName = typeof entry.new_coach_name === 'string' ? entry.new_coach_name.trim().toLowerCase() : '';
      let coachId: string | null;
      if (newName && createdByName.has(newName)) {
        coachId = createdByName.get(newName)!;
      } else {
        const resolved = await resolveCoachInput(entry);
        coachId = resolved.coachId;
        if (resolved.statement) {
          statements.push(resolved.statement);
          createdByName.set(newName, resolved.coachId!);
        }
      }
      statements.push({
        sql: 'INSERT INTO season_teams (season_id, team_id, coach_id) VALUES (?, ?, ?)',
        args: [seasonId, String(entry.team_id), coachId],
      });
    }

    await db.batch(statements, 'write');
    return NextResponse.json({ success: true, id: seasonId, number, name, previous: active?.id ?? null }, { status: 201 });
  } catch (error) {
    if (error instanceof CoachInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error starting season:', error);
    return NextResponse.json({ error: 'Failed to start new season' }, { status: 500 });
  }
}
