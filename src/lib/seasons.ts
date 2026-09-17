import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { recalcSppStatement } from '@/lib/spp';

// Stato effettivo di una stagione.
// Nel database: status 'active' = in corso; status 'completed' = chiusa, con il motivo in closed_reason
// ('completed' conclusa, 'paused' in pausa, 'cancelled' annullata). Vedi scripts/migrate-season-status.mjs.
export type SeasonStatus = 'active' | 'completed' | 'paused' | 'cancelled';
export type CloseReason = Exclude<SeasonStatus, 'active'>;

export type Season = {
  id: string;
  number: number;
  name: string;
  status: SeasonStatus;
  started_at: string | null;
  ended_at: string | null;
};

// Frammento SQL che calcola lo stato effettivo (alias della tabella seasons come parametro)
export const seasonStatusSql = (alias = 's') =>
  `CASE WHEN ${alias}.status = 'active' THEN 'active' ELSE COALESCE(${alias}.closed_reason, 'completed') END`;

export const toSeasonStatus = (status: unknown, closedReason: unknown): SeasonStatus => {
  if (status === 'active') return 'active';
  return closedReason === 'paused' || closedReason === 'cancelled' ? closedReason : 'completed';
};

// Stato già calcolato in SQL con seasonStatusSql
export const parseSeasonStatus = (value: unknown): SeasonStatus =>
  value === 'active' || value === 'paused' || value === 'cancelled' ? value : 'completed';

// Le stagioni annullate restano consultabili ma non contano nelle carriere degli allenatori
export const countsInCareer = (status: SeasonStatus) => status !== 'cancelled';

const toSeason = (row: Record<string, unknown> | undefined): Season | null =>
  row
    ? {
        id: String(row.id),
        number: Number(row.number),
        name: String(row.name),
        status: toSeasonStatus(row.status, row.closed_reason),
        started_at: (row.started_at as string) ?? null,
        ended_at: (row.ended_at as string) ?? null,
      }
    : null;

export async function getActiveSeason(): Promise<Season | null> {
  const { rows } = await db.execute("SELECT * FROM seasons WHERE status = 'active' LIMIT 1");
  return toSeason(rows[0]);
}

export async function getSeason(id: string): Promise<Season | null> {
  const { rows } = await db.execute({ sql: 'SELECT * FROM seasons WHERE id = ?', args: [id] });
  return toSeason(rows[0]);
}

// Stagione richiesta con ?season=<id>; senza parametro si usa quella attiva
export async function resolveSeason(request: Request): Promise<Season | null> {
  const seasonId = new URL(request.url).searchParams.get('season');
  return seasonId ? getSeason(seasonId) : getActiveSeason();
}

export const seasonNotFound = () =>
  NextResponse.json({ error: 'Season not found' }, { status: 404 });

const STATUS_LABEL: Record<SeasonStatus, string> = {
  active: 'in progress',
  completed: 'completed',
  paused: 'paused',
  cancelled: 'cancelled',
};

export const describeSeasonStatus = (status: SeasonStatus) => STATUS_LABEL[status];

// Calendario e risultati si modificano solo nella stagione attiva
export const seasonReadOnly = (season: Season | null) =>
  NextResponse.json(
    { error: season ? `${season.name} is ${describeSeasonStatus(season.status)}: its matches are read-only.` : 'There is no active season.' },
    { status: 409 }
  );

type Statement = { sql: string; args: (string | number | null)[] };

// Chiude una stagione (conclusa, in pausa o annullata): diventa di sola lettura, dati conservati
export const closeSeasonStatement = (seasonId: string, reason: CloseReason): Statement => ({
  sql: "UPDATE seasons SET status = 'completed', closed_reason = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?",
  args: [reason, seasonId],
});

// Riapre una stagione (in pausa o annullata) come stagione attiva
export const reopenSeasonStatement = (seasonId: string): Statement => ({
  sql: "UPDATE seasons SET status = 'active', closed_reason = NULL, ended_at = NULL WHERE id = ?",
  args: [seasonId],
});

// Elimina definitivamente una stagione: partite, statistiche delle partite e iscrizioni.
// Le squadre e i giocatori restano; gli SPP guadagnati in quelle partite vengono tolti.
export async function deleteSeasonStatements(seasonId: string): Promise<Statement[]> {
  const { rows: players } = await db.execute({
    sql: `SELECT DISTINCT ps.player_id FROM player_stats ps JOIN matches m ON m.id = ps.match_id WHERE m.season_id = ?`,
    args: [seasonId],
  });
  return [
    { sql: 'DELETE FROM player_stats WHERE match_id IN (SELECT id FROM matches WHERE season_id = ?)', args: [seasonId] },
    { sql: 'DELETE FROM matches WHERE season_id = ?', args: [seasonId] },
    { sql: 'DELETE FROM season_teams WHERE season_id = ?', args: [seasonId] },
    { sql: 'DELETE FROM seasons WHERE id = ?', args: [seasonId] },
    ...players.map(p => recalcSppStatement(String(p.player_id))),
  ];
}
