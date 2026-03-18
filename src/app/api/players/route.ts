import { NextResponse } from 'next/server';
import db from '@/lib/db';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { team_id, jersey_number, name, role, value, skills, primary_skills, secondary_skills, ma, st, ag, pa, av, spp, mng, dead } = body;

    if (!team_id || !name || !role || value === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const id = crypto.randomUUID();

    await db.execute({
      sql: `
        INSERT INTO players (id, team_id, jersey_number, name, role, value, primary_skills, secondary_skills, advancements, ma, st, ag, pa, av, spp, status, mng, dead)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)
      `,
      args: [
        id, team_id, jersey_number ?? null, name, role, value,
        primary_skills ?? null, secondary_skills ?? null,
        ma ?? 6, st ?? 3, ag ?? '3+', pa ?? '4+', av ?? '8+', spp ?? 0,
        mng ? 1 : 0, dead ? 1 : 0
      ]
    });

    if (Array.isArray(skills) && skills.length > 0) {
      for (const skillId of skills) {
        await db.execute({
          sql: `INSERT INTO skills_players (player_id, skill_id) VALUES (?, ?)`,
          args: [id, skillId]
        });
      }
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Error adding player:', error);
    return NextResponse.json({ error: 'Failed to add player' }, { status: 500 });
  }
}