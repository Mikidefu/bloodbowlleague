import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { RuleError } from '@/lib/matchRules';
import { describeSeasonStatus, toSeasonStatus } from '@/lib/seasons';

// Risultati e partite si modificano solo nella stagione attiva.
// Restituisce la risposta d'errore da inviare, oppure null se la partita è modificabile.
export async function lockedMatchResponse(matchId: string) {
  const { rows: [row] } = await db.execute({
    sql: 'SELECT s.name, s.status, s.closed_reason FROM matches m LEFT JOIN seasons s ON s.id = m.season_id WHERE m.id = ?',
    args: [matchId]
  });
  if (!row) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  if (row.status !== 'active') {
    const status = describeSeasonStatus(toSeasonStatus(row.status, row.closed_reason));
    return NextResponse.json({ error: `${row.name ?? 'This season'} is ${status}: its matches are read-only.` }, { status: 409 });
  }
  return null;
}

export const ruleErrorResponse = (err: unknown) =>
  err instanceof RuleError ? NextResponse.json({ error: err.message }, { status: err.status }) : null;

