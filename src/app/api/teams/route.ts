import { NextResponse } from 'next/server';
import db from '@/lib/db';
import path from 'path';
import { writeFile, mkdir } from 'fs/promises';
import crypto from 'crypto';

export async function GET() {
  try {
    const { rows: teams } = await db.execute('SELECT * FROM teams ORDER BY name ASC');
    return NextResponse.json(teams);
  } catch (error) {
    console.error('Error fetching teams:', error);
    return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const name = formData.get('name')?.toString();
    if (!name) {
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
    }

    let logo_url = formData.get('logo_url')?.toString() || null;
    const primary_color = formData.get('primary_color')?.toString() || null;
    const secondary_color = formData.get('secondary_color')?.toString() || null;

    // Gestione File Logo (temporanea per sviluppo locale)
    const logoFile = formData.get('logo_file') as File | null;
    if (logoFile && logoFile.size > 0) {
      const bytes = await logoFile.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const originalName = logoFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
      const filename = `${Date.now()}-${originalName}`;
      const uploadDir = path.join(process.cwd(), 'public/uploads/logos');

      try {
        await mkdir(uploadDir, { recursive: true });
      } catch (e) {
        // Ignore if exists
      }

      const filepath = path.join(uploadDir, filename);
      await writeFile(filepath, buffer);

      logo_url = `/uploads/logos/${filename}`;
    }

    const newTeamId = crypto.randomUUID();

    await db.execute({
      sql: `
        INSERT INTO teams (id, name, logo_url, primary_color, secondary_color, rerolls, reroll_cost, cheerleaders, assistant_coaches, fan_factor, apothecary, treasury, bank)
        VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0, 1000000, 0)
      `,
      args: [
        newTeamId,
        name,
        logo_url,
        primary_color,
        secondary_color
      ]
    });

    const { rows: newTeamRows } = await db.execute({
      sql: 'SELECT * FROM teams WHERE id = ?',
      args: [newTeamId]
    });

    return NextResponse.json(newTeamRows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating team:', error);
    return NextResponse.json({ error: 'Failed to create team' }, { status: 500 });
  }
}