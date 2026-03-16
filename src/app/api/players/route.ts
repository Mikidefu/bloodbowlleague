import { NextResponse } from 'next/server';
import db from '@/lib/db';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { team_id, name, role, value, skills, ma, st, ag, pa, av, spp } = body;

    if (!team_id || !name || !role || value === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    
    // Skills are stored as JSON array string
    const skillsJson = Array.isArray(skills) ? JSON.stringify(skills) : JSON.stringify([]);

    const stmt = db.prepare(`
      INSERT INTO players (id, team_id, name, role, value, skills, ma, st, ag, pa, av, spp, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')
    `);
    
    stmt.run(
      id, team_id, name, role, value, skillsJson, 
      ma ?? 6, st ?? 3, ag ?? '3+', pa ?? '4+', av ?? '8+', spp ?? 0
    );
    try {
      const newPlayer: any = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
      return NextResponse.json({
      ...newPlayer,
      skills: newPlayer.skills ? JSON.parse(newPlayer.skills) : []
    }, { status: 201 });
  } catch (error) {
    console.error('Error adding player:', error);
    return NextResponse.json({ error: 'Failed to retrieve new player' }, { status: 500 });
  }
  } catch (error) {
    console.error('Error adding player:', error);
    return NextResponse.json({ error: 'Failed to add player' }, { status: 500 });
  }
}
