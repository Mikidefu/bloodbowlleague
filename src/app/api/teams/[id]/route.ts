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

    // Eseguiamo in parallelo il recupero del team e dei suoi giocatori
    const [teamRes, playersRes] = await Promise.all([
      db.execute({ sql: 'SELECT * FROM teams WHERE id = ?', args: [id] }),
      db.execute({ sql: 'SELECT * FROM players WHERE team_id = ? ORDER BY created_at ASC', args: [id] })
    ]);

    const team = teamRes.rows[0];

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Parse skills
    const mappedPlayers = playersRes.rows.map((p: any) => ({
      ...p,
      skills: p.skills ? JSON.parse(p.skills as string) : []
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
  try {
    const { id } = await params;
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

    // NOTA: Questo blocco funzionerà in locale, ma andrà sostituito prima del deploy su Vercel
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

    await db.execute({
      sql: `
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
      `,
      args: [
        name, logo_url, primary_color, secondary_color,
        rerolls, reroll_cost, cheerleaders, assistant_coaches, fan_factor, apothecary, treasury, bank,
        id
      ]
    });

    const { rows: updatedTeamRows } = await db.execute({
      sql: 'SELECT * FROM teams WHERE id = ?',
      args: [id]
    });

    return NextResponse.json(updatedTeamRows[0]);
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

    await db.execute({
      sql: 'DELETE FROM teams WHERE id = ?',
      args: [id]
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting team:', error);
    return NextResponse.json({ error: 'Failed to delete team' }, { status: 500 });
  }
}