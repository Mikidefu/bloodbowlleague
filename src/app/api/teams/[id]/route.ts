// src/app/api/teams/[id]/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { put } from '@vercel/blob';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Recuperiamo la squadra e i giocatori in parallelo
    const [teamRes, playersRes] = await Promise.all([
      db.execute({ sql: 'SELECT * FROM teams WHERE id = ?', args: [id] }),
      db.execute({ sql: 'SELECT * FROM players WHERE team_id = ? ORDER BY created_at ASC', args: [id] })
    ]);

    const team = teamRes.rows[0];
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

    // 2. Recuperiamo tutte le skill associate ai giocatori di QUESTA squadra
    // Facciamo una JOIN tra skills, la tabella ponte, e i players di questo team
    const skillsRes = await db.execute({
      sql: `
        SELECT sp.player_id, s.*
        FROM skills s
        JOIN skills_players sp ON s.id = sp.skill_id
        JOIN players p ON p.id = sp.player_id
        WHERE p.team_id = ?
      `,
      args: [id]
    });

    // 3. Mappiamo i giocatori assegnando a ciascuno le proprie skill REALI (come oggetti)
    const mappedPlayers = playersRes.rows.map((p: any) => {
      // Filtriamo l'array globale delle skill per prendere solo quelle di questo giocatore
      const playerSkills = skillsRes.rows.filter((s: any) => s.player_id === p.id);

      return {
        ...p,
        skills: playerSkills, // Ora è un array di oggetti {id, name, type, description...}
        mng: !!p.mng,         // Convertiamo 1/0 di SQLite in true/false per React
        dead: !!p.dead        // Convertiamo 1/0 di SQLite in true/false per React
      };
    });

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

    // Integrazione Vercel Blob per la modifica del logo
    if (logoFile && logoFile.size > 0) {
      const blob = await put(`logos/${Date.now()}-${logoFile.name}`, logoFile, {
        access: 'public',
      });
      logo_url = blob.url;
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
    await db.execute({ sql: 'DELETE FROM teams WHERE id = ?', args: [id] });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting team:', error);
    return NextResponse.json({ error: 'Failed to delete team' }, { status: 500 });
  }
}