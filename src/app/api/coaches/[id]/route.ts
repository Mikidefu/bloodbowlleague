import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { computeCoachCareers } from '@/lib/coaches';

// Carriera completa di un allenatore: totali e dettaglio per stagione
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [career] = await computeCoachCareers(id);
    if (!career) return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
    return NextResponse.json(career);
  } catch (error) {
    console.error('Error fetching coach:', error);
    return NextResponse.json({ error: 'Failed to fetch coach' }, { status: 500 });
  }
}

// Rinomina un allenatore
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
    if (!name) return NextResponse.json({ error: 'Coach name is required' }, { status: 400 });
    if (name.length > 60) return NextResponse.json({ error: 'Coach name is too long (max 60 characters)' }, { status: 400 });

    const { rows: [clash] } = await db.execute({
      sql: 'SELECT id FROM coaches WHERE name = ? COLLATE NOCASE AND id <> ?',
      args: [name, id],
    });
    if (clash) return NextResponse.json({ error: `Another coach is already called "${name}"` }, { status: 409 });

    const result = await db.execute({ sql: 'UPDATE coaches SET name = ? WHERE id = ?', args: [name, id] });
    if (result.rowsAffected === 0) return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error renaming coach:', error);
    return NextResponse.json({ error: 'Failed to rename coach' }, { status: 500 });
  }
}

// Elimina un allenatore solo se non ha mai allenato: la sua storia nelle stagioni va conservata
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { rows: [usage] } = await db.execute({ sql: 'SELECT COUNT(*) AS c FROM season_teams WHERE coach_id = ?', args: [id] });
    if (Number(usage.c) > 0) {
      return NextResponse.json({ error: 'This coach has a season history and cannot be deleted.' }, { status: 409 });
    }
    const result = await db.execute({ sql: 'DELETE FROM coaches WHERE id = ?', args: [id] });
    if (result.rowsAffected === 0) return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting coach:', error);
    return NextResponse.json({ error: 'Failed to delete coach' }, { status: 500 });
  }
}
