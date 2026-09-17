import { NextResponse } from 'next/server';
import crypto from 'crypto';
import db from '@/lib/db';
import { CoachInputError, resolveCoachInput } from '@/lib/coaches';
import { closeSeasonStatement, deleteSeasonStatements, getActiveSeason, toSeasonStatus } from '@/lib/seasons';
import { computePlayoffFinishes } from '@/lib/standings';

// Campione di una stagione (se la finale è stata giocata), con il suo allenatore
async function findChampion(seasonId: string) {
  const finishes = await computePlayoffFinishes(seasonId);
  const championId = [...finishes.entries()].find(([, finish]) => finish === 'champion')?.[0];
  if (!championId) return null;
  const { rows: [c] } = await db.execute({
    sql: `SELECT t.id AS team_id, t.name AS team_name, co.name AS coach_name
          FROM teams t
          LEFT JOIN season_teams st ON st.team_id = t.id AND st.season_id = ?
          LEFT JOIN coaches co ON co.id = st.coach_id
          WHERE t.id = ?`,
    args: [seasonId, championId],
  });
  return c ?? null;
}

// Elenco stagioni con stato, partecipanti, avanzamento del calendario e campione
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

    const seasons = await Promise.all(rows.map(async s => ({
      id: String(s.id),
      number: Number(s.number),
      name: String(s.name),
      status: toSeasonStatus(s.status, s.closed_reason),
      started_at: s.started_at,
      ended_at: s.ended_at,
      teams_count: Number(s.teams_count),
      matches_total: Number(s.matches_total),
      matches_played: Number(s.matches_played),
      champion: await findChampion(String(s.id)),
    })));

    return NextResponse.json(seasons);
  } catch (error) {
    console.error('Error fetching seasons:', error);
    return NextResponse.json({ error: 'Failed to fetch seasons' }, { status: 500 });
  }
}

type SeasonTeamInput = { team_id?: unknown; coach_id?: unknown; new_coach_name?: unknown };

// Cosa fare della stagione in corso quando non ha ancora un campione
const PREVIOUS_ACTIONS = ['pause', 'cancel', 'delete'] as const;
type PreviousAction = typeof PREVIOUS_ACTIONS[number];

// Avvia una nuova stagione e iscrive le squadre che proseguono, con il loro allenatore.
// La stagione in corso:
//   - con un campione viene conclusa (se restano partite non giocate serve force: true);
//   - senza campione serve una decisione esplicita in previous_action: 'pause' | 'cancel' | 'delete'.
// Le squadre nuove si creano poi da "Draft team" e vengono iscritte automaticamente alla stagione attiva.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const force = body.force === true;
    const previousAction = PREVIOUS_ACTIONS.includes(body.previous_action) ? body.previous_action as PreviousAction : null;
    const teamsInput: SeasonTeamInput[] = Array.isArray(body.teams) ? body.teams : [];

    const active = await getActiveSeason();
    const activeChampion = active ? await findChampion(active.id) : null;

    if (active) {
      const { rows: [pending] } = await db.execute({
        sql: 'SELECT COUNT(*) AS c FROM matches WHERE season_id = ? AND is_played = 0',
        args: [active.id],
      });
      const pendingMatches = Number(pending.c);

      if (!activeChampion && !previousAction) {
        return NextResponse.json({
          error: `${active.name} has no champion yet: choose whether to pause, cancel or delete it.`,
          needs_decision: true,
          season_name: active.name,
          pending_matches: pendingMatches,
        }, { status: 409 });
      }
      if (activeChampion && pendingMatches > 0 && !force) {
        return NextResponse.json({
          error: `${active.name} still has ${pendingMatches} match(es) to play.`,
          incomplete: true,
          pending_matches: pendingMatches,
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

    const statements: { sql: string; args: (string | number | null)[] }[] = [];
    const deletingActive = !!active && !activeChampion && previousAction === 'delete';

    if (active) {
      if (activeChampion) statements.push(closeSeasonStatement(active.id, 'completed'));
      else if (previousAction === 'pause') statements.push(closeSeasonStatement(active.id, 'paused'));
      else if (previousAction === 'cancel') statements.push(closeSeasonStatement(active.id, 'cancelled'));
      else if (deletingActive) statements.push(...await deleteSeasonStatements(active.id));
    }

    // Numero progressivo: se la stagione in corso viene eliminata, la nuova ne riprende il numero
    const { rows: [maxRow] } = await db.execute({
      sql: 'SELECT COALESCE(MAX(number), 0) AS n FROM seasons WHERE id <> ?',
      args: [deletingActive ? active!.id : ''],
    });
    const number = Number(maxRow.n) + 1;
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 60) : `Season ${number}`;
    const seasonId = crypto.randomUUID();

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
    return NextResponse.json({
      success: true, id: seasonId, number, name,
      previous: active ? { id: active.id, outcome: activeChampion ? 'completed' : previousAction } : null,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof CoachInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error starting season:', error);
    return NextResponse.json({ error: 'Failed to start new season' }, { status: 500 });
  }
}
