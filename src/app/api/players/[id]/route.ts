import { NextResponse } from 'next/server';
import db from '@/lib/db';

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
    return NextResponse.json({ error: 'Failed to fetch player' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { jersey_number, name, role, value, primary_skills, secondary_skills, advancements, status, skills, ma, st, ag, pa, av, spp, mng, dead } = body;

    await db.execute({
      sql: `
        UPDATE players
        SET jersey_number = COALESCE(?, jersey_number), name = COALESCE(?, name), role = COALESCE(?, role), value = COALESCE(?, value),
            primary_skills = COALESCE(?, primary_skills), secondary_skills = COALESCE(?, secondary_skills), advancements = COALESCE(?, advancements),
            status = COALESCE(?, status), ma = COALESCE(?, ma), st = COALESCE(?, st), ag = COALESCE(?, ag), pa = COALESCE(?, pa), av = COALESCE(?, av),
            spp = COALESCE(?, spp), mng = COALESCE(?, mng), dead = COALESCE(?, dead)
        WHERE id = ?
      `,
      args: [
        jersey_number ?? null, name ?? null, role ?? null, value ?? null,
        primary_skills ?? null, secondary_skills ?? null, advancements ?? null,
        status ?? null, ma ?? null, st ?? null, ag ?? null, pa ?? null, av ?? null, spp ?? null,
        mng !== undefined ? (mng ? 1 : 0) : null, dead !== undefined ? (dead ? 1 : 0) : null, id
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
    return NextResponse.json({ error: 'Failed to update player' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.execute({ sql: 'DELETE FROM players WHERE id = ?', args: [id] });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete player' }, { status: 500 });
  }
}