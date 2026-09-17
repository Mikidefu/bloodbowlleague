import { NextResponse } from 'next/server';
import db from '@/lib/db';

export type SeasonStatus = 'active' | 'completed';

export type Season = {
  id: string;
  number: number;
  name: string;
  status: SeasonStatus;
  started_at: string | null;
  ended_at: string | null;
};

const toSeason = (row: Record<string, unknown> | undefined): Season | null =>
  row
    ? {
        id: String(row.id),
        number: Number(row.number),
        name: String(row.name),
        status: row.status === 'completed' ? 'completed' : 'active',
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

// Le stagioni concluse sono in sola lettura: calendario e risultati si modificano solo nella stagione attiva
export const seasonReadOnly = (season: Season | null) =>
  NextResponse.json(
    { error: season ? `${season.name} is completed: its matches are read-only.` : 'There is no active season.' },
    { status: 409 }
  );
