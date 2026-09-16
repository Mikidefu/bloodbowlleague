import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { uploadTeamLogo, UploadError } from '@/lib/upload';
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

    const race = formData.get('race')?.toString();
    if (!race) {
      return NextResponse.json({ error: 'Team race is required' }, { status: 400 });
    }

    let logo_url = formData.get('logo_url')?.toString() || null;
    const primary_color = formData.get('primary_color')?.toString() || null;
    const secondary_color = formData.get('secondary_color')?.toString() || null;

    // Numeri interi non negativi; se il campo manca o non è valido si usa il default
    const intField = (key: string, fallback: number) => {
      const parsed = parseInt(formData.get(key)?.toString() ?? '', 10);
      return Number.isNaN(parsed) || parsed < 0 ? fallback : parsed;
    };

    const logoFile = formData.get('logo_file') as File | null;

    // Integrazione Vercel Blob per la creazione del logo
    if (logoFile && logoFile.size > 0) {
      logo_url = await uploadTeamLogo(logoFile);
    }

    const newTeamId = crypto.randomUUID();

    await db.execute({
      sql: `
        INSERT INTO teams (id, name, race, logo_url, primary_color, secondary_color, rerolls, reroll_cost, cheerleaders, assistant_coaches, fan_factor, apothecary, treasury, bank)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        newTeamId, name, race, logo_url, primary_color, secondary_color,
        intField('rerolls', 0), intField('reroll_cost', 50000), intField('cheerleaders', 0),
        intField('assistant_coaches', 0), intField('fan_factor', 0),
        formData.get('apothecary') === 'true' ? 1 : 0,
        intField('treasury', 1000000), intField('bank', 0)
      ]
    });

    const { rows: newTeamRows } = await db.execute({
      sql: 'SELECT * FROM teams WHERE id = ?',
      args: [newTeamId]
    });

    return NextResponse.json(newTeamRows[0], { status: 201 });
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error creating team:', error);
    return NextResponse.json({ error: 'Failed to create team' }, { status: 500 });
  }
}