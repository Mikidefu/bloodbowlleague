import { NextResponse } from 'next/server';
import db from '@/lib/db';
import crypto from 'crypto';
import path from 'path';
import { writeFile, mkdir } from 'fs/promises';

export async function GET() {
  try {
    const teams = db.prepare('SELECT * FROM teams ORDER BY created_at DESC').all();
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
    const race = formData.get('race')?.toString();
    const primary_color = formData.get('primary_color')?.toString();
    const secondary_color = formData.get('secondary_color')?.toString();
    const rerolls = parseInt(formData.get('rerolls')?.toString() || '0', 10);
    const reroll_cost = parseInt(formData.get('reroll_cost')?.toString() || '50000', 10);
    const cheerleaders = parseInt(formData.get('cheerleaders')?.toString() || '0', 10);
    const assistant_coaches = parseInt(formData.get('assistant_coaches')?.toString() || '0', 10);
    const fan_factor = parseInt(formData.get('fan_factor')?.toString() || '0', 10);
    const apothecary = formData.get('apothecary') === 'true' ? 1 : 0;
    const treasury = parseInt(formData.get('treasury')?.toString() || '0', 10);
    const bank = parseInt(formData.get('bank')?.toString() || '0', 10);
    
    let logo_url = formData.get('logo_url')?.toString() || null;
    const logoFile = formData.get('logo_file') as File | null;

    if (!name || !race) {
      return NextResponse.json({ error: 'Name and race are required' }, { status: 400 });
    }

    if (logoFile && logoFile.size > 0) {
      const bytes = await logoFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      // Clean up filename and add timestamp
      const originalName = logoFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
      const filename = `${Date.now()}-${originalName}`;
      const uploadDir = path.join(process.cwd(), 'public/uploads/logos');
      
      try {
        await mkdir(uploadDir, { recursive: true });
      } catch (e) {
        // Ignore if directory already exists
      }
      
      const filepath = path.join(uploadDir, filename);
      await writeFile(filepath, buffer);
      
      logo_url = `/uploads/logos/${filename}`;
    }

    const id = crypto.randomUUID();
    
    const stmt = db.prepare(`
      INSERT INTO teams (id, name, race, logo_url, primary_color, secondary_color, rerolls, reroll_cost, cheerleaders, assistant_coaches, fan_factor, apothecary, treasury, bank)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id, name, race, logo_url, primary_color || '#2d4a22', secondary_color || '#8b0000',
      rerolls, reroll_cost, cheerleaders, assistant_coaches, fan_factor, apothecary, treasury, bank
    );

    const newTeam = db.prepare('SELECT * FROM teams WHERE id = ?').get(id);
    return NextResponse.json(newTeam, { status: 201 });
  } catch (error) {
    console.error('Error creating team:', error);
    return NextResponse.json({ error: 'Failed to create team' }, { status: 500 });
  }
}
