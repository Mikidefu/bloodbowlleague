import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const existing: any = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({
      ...existing,
      skills: existing.skills ? JSON.parse(existing.skills) : []
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

    const skillsJson = skills ? JSON.stringify(skills) : undefined;

    const stmt = db.prepare(`
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
    `);
    
    stmt.run(
      name, role, value, status, skillsJson, 
      ma, st, ag, pa, av, spp, 
      id
    );
    
    const updatedPlayer: any = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
    if (!updatedPlayer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({
      ...updatedPlayer,
      skills: updatedPlayer.skills ? JSON.parse(updatedPlayer.skills) : []
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
    const stmt = db.prepare('DELETE FROM players WHERE id = ?');
    stmt.run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting player:', error);
    return NextResponse.json({ error: 'Failed to delete player' }, { status: 500 });
  }
}
