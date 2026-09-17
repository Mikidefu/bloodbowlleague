// src/app/api/teams/[id]/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { recalcSppStatement } from '@/lib/spp';
import { uploadTeamLogo, UploadError } from '@/lib/upload';
import { CoachInputError, resolveCoachInput } from '@/lib/coaches';
import { getActiveSeason, seasonStatusSql } from '@/lib/seasons';

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
    const mappedPlayers = playersRes.rows.map(p => {
      // Filtriamo l'array globale delle skill per prendere solo quelle di questo giocatore
      const playerSkills = skillsRes.rows.filter(s => s.player_id === p.id);

      return {
        ...p,
        skills: playerSkills, // Ora è un array di oggetti {id, name, type, description...}
        mng: !!p.mng,         // Convertiamo 1/0 di SQLite in true/false per React
        dead: !!p.dead        // Convertiamo 1/0 di SQLite in true/false per React
      };
    });

    // Storico partecipazioni: stagione e allenatore (la prima riga è la più recente)
    const { rows: history } = await db.execute({
      sql: `
        SELECT s.id AS season_id, s.number AS season_number, s.name AS season_name, ${seasonStatusSql('s')} AS season_status,
               st.coach_id, c.name AS coach_name
        FROM season_teams st
        JOIN seasons s ON s.id = st.season_id
        LEFT JOIN coaches c ON c.id = st.coach_id
        WHERE st.team_id = ?
        ORDER BY s.number DESC
      `,
      args: [id]
    });
    const activeEntry = history.find(h => h.season_status === 'active');

    return NextResponse.json({
      ...team,
      players: mappedPlayers,
      in_active_season: !!activeEntry,
      coach_id: activeEntry?.coach_id ?? history[0]?.coach_id ?? null,
      coach_name: activeEntry?.coach_name ?? history[0]?.coach_name ?? null,
      season_history: history
    });
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
      logo_url = await uploadTeamLogo(logoFile);
    }

    // Cambio allenatore: vale per la stagione attiva (le stagioni concluse mantengono il loro allenatore)
    const statements = [];
    if (formData.has('coach_id') || formData.has('new_coach_name')) {
      const activeSeason = await getActiveSeason();
      const { rows: [enrollment] } = activeSeason
        ? await db.execute({ sql: 'SELECT 1 FROM season_teams WHERE season_id = ? AND team_id = ?', args: [activeSeason.id, id] })
        : { rows: [] };
      if (!activeSeason || !enrollment) {
        return NextResponse.json({ error: 'The team is not taking part in the active season: its coach cannot be changed.' }, { status: 409 });
      }
      const coach = await resolveCoachInput({
        coach_id: formData.get('coach_id')?.toString(),
        new_coach_name: formData.get('new_coach_name')?.toString(),
      });
      if (coach.statement) statements.push(coach.statement);
      statements.push({
        sql: 'UPDATE season_teams SET coach_id = ? WHERE season_id = ? AND team_id = ?',
        args: [coach.coachId, activeSeason.id, id]
      });
    }

    statements.push({
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
    await db.batch(statements, 'write');

    const { rows: updatedTeamRows } = await db.execute({
      sql: 'SELECT * FROM teams WHERE id = ?',
      args: [id]
    });

    return NextResponse.json(updatedTeamRows[0]);
  } catch (error) {
    if (error instanceof UploadError || error instanceof CoachInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
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

    // Le foreign key sono attive e "matches" non ha ON DELETE CASCADE:
    // prima vanno eliminate le partite della squadra (e le loro statistiche).
    const { rows: opponentsToRecalc } = await db.execute({
      sql: `
        SELECT DISTINCT s.player_id
        FROM player_stats s
        JOIN matches m ON m.id = s.match_id
        JOIN players p ON p.id = s.player_id
        WHERE (m.home_team_id = ? OR m.away_team_id = ?) AND p.team_id <> ?
      `,
      args: [id, id, id]
    });

    const statements = [
      {
        sql: 'DELETE FROM player_stats WHERE match_id IN (SELECT id FROM matches WHERE home_team_id = ? OR away_team_id = ?)',
        args: [id, id]
      },
      { sql: 'DELETE FROM matches WHERE home_team_id = ? OR away_team_id = ?', args: [id, id] },
      // Giocatori, loro statistiche residue e skill vengono rimossi in cascata
      { sql: 'DELETE FROM teams WHERE id = ?', args: [id] },
      // Gli avversari perdono gli SPP guadagnati contro questa squadra
      ...opponentsToRecalc.map(p => recalcSppStatement(String(p.player_id))),
    ];

    await db.batch(statements, 'write');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting team:', error);
    return NextResponse.json({ error: 'Failed to delete team' }, { status: 500 });
  }
}