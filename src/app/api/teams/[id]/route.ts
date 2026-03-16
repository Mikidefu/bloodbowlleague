import { NextResponse } from 'next/server';
import db from '@/lib/db';
import path from 'path';
import { writeFile, mkdir } from 'fs/promises';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get team
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(id);
    
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }
    
    // Expand with players
    const players = db.prepare('SELECT * FROM players WHERE team_id = ? ORDER BY created_at ASC').all(id);
    // Parse skills
    const mappedPlayers = players.map((p: any) => ({
      ...p,
      skills: p.skills ? JSON.parse(p.skills) : []
    }));
    
    return NextResponse.json({ ...team, players: mappedPlayers });
  } catch (error) {
    console.error('Error fetching team:', error);
    return NextResponse.json({ error: 'Failed to fetch team details' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const formData = await request.formData();
    const name = formData.get('name')?.toString() || null;
    let logo_url = formData.get('logo_url')?.toString() || null;
    const primary_color = formData.get('primary_color')?.toString() || null;
    const secondary_color = formData.get('secondary_color')?.toString() || null;
    
    const rerolls = formData.has('rerolls') ? parseInt(formData.get('rerolls') as string, 10) : null;
    const reroll_cost = formData.has('reroll_cost') ? parseInt(formData.get('reroll_cost') as string, 10) : null;
    const cheerleaders = formData.has('cheerleaders') ? parseInt(formData.get('cheerleaders') as string, 10) : null;
    const assistant_coaches = formData.has('assistant_coaches') ? parseInt(formData.get('assistant_coaches') as string, 10) : null;
    const fan_factor = formData.has('fan_factor') ? parseInt(formData.get('fan_factor') as string, 10) : null;
    const apothecary = formData.has('apothecary') ? (formData.get('apothecary') === 'true' ? 1 : 0) : null;
    const treasury = formData.has('treasury') ? parseInt(formData.get('treasury') as string, 10) : null;
    const bank = formData.has('bank') ? parseInt(formData.get('bank') as string, 10) : null;

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

    const stmt = db.prepare(`
      UPDATE teams 
      SET name = COALESCE(?, name),
          logo_url = COALESCE(?, logo_url),
          primary_color = COALESCE(?, primary_color),
          secondary_color = COALESCE(?, secondary_color),
          rerolls = COALESCE(?, rerolls),
          reroll_cost = COALESCE(?, reroll_cost),
          cheerleaders = COALESCE(?, cheerleaders),
          assistant_coaches = COALESCE(?, assistant_coaches),
          fan_factor = COALESCE(?, fan_factor),
          apothecary = COALESCE(?, apothecary),
          treasury = COALESCE(?, treasury),
          bank = COALESCE(?, bank)
      WHERE id = ?
    `);
    
    stmt.run(
      name, logo_url, primary_color, secondary_color, 
      rerolls, reroll_cost, cheerleaders, assistant_coaches, fan_factor, apothecary, treasury, bank,
      id
    );
    
    const updatedTeam = db.prepare('SELECT * FROM teams WHERE id = ?').get(id);
    return NextResponse.json(updatedTeam);
  } catch (error) {
    console.error('Error updating team:', error);
    return NextResponse.json({ error: 'Failed to update team' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const stmt = db.prepare('DELETE FROM teams WHERE id = ?');
    stmt.run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting team:', error);
    return NextResponse.json({ error: 'Failed to delete team' }, { status: 500 });
  }
}
