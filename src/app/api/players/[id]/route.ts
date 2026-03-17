import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Turso restituisce un array 'rows', prendiamo il primo elemento [0]
    const { rows } = await db.execute({
      sql: 'SELECT * FROM players WHERE id = ?',
      args: [id]
    });

    const existing = rows[0];
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({
      ...existing,
      skills: existing.skills ? JSON.parse(existing.skills as string) : []
    });
  } catch (error) {
    console.error('Error fetching player:', error);
    return NextResponse.json({ error: 'Failed to fetch player' }, { status: 500 });
  }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, role, value, status, skills, ma, st, ag, pa, av, spp } = body;

    // Attenzione: Turso richiede null, non accetta undefined
    const skillsJson = skills ? JSON.stringify(skills) : null;

    await db.execute({
      sql: `
        UPDATE players 
        SET name = COALESCE(?, name),
            role = COALESCE(?, role),
            value = COALESCE(?, value),
            status = COALESCE(?, status),
            skills = COALESCE(?, skills),
            ma = COALESCE(?, ma),
            st = COALESCE(?, st),
            ag = COALESCE(?, ag),
            pa = COALESCE(?, pa),
            av = COALESCE(?, av),
            spp = COALESCE(?, spp)
        WHERE id = ?
      `,
      args: [
        name ?? null,
        role ?? null,
        value ?? null,
        status ?? null,
        skillsJson,
        ma ?? null,
        st ?? null,
        ag ?? null,
        pa ?? null,
        av ?? null,
        spp ?? null,
        id
      ]
    });

    const { rows } = await db.execute({
      sql: 'SELECT * FROM players WHERE id = ?',
      args: [id]
    });

    const updatedPlayer = rows[0];
    if (!updatedPlayer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({
      ...updatedPlayer,
      skills: updatedPlayer.skills ? JSON.parse(updatedPlayer.skills as string) : []
    });
  } catch (error) {
    console.error('Error updating player:', error);
    return NextResponse.json({ error: 'Failed to update player' }, { status: 500 });
  }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await db.execute({
      sql: 'DELETE FROM players WHERE id = ?',
      args: [id]
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting player:', error);
    return NextResponse.json({ error: 'Failed to delete player' }, { status: 500 });
  }
}