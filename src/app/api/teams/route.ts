import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { uploadTeamLogo, UploadError } from '@/lib/upload';
import crypto from 'crypto';
import { CoachInputError, resolveCoachInput } from '@/lib/coaches';
import { getActiveSeason, resolveSeason, seasonNotFound } from '@/lib/seasons';

// ?season=<id>  squadre iscritte a quella stagione, con il loro allenatore (default: stagione attiva)
// ?scope=all    tutte le squadre, con l'ultimo allenatore e se partecipano alla stagione attiva
export async function GET(request: Request) {
  try {
    if (new URL(request.url).searchParams.get('scope') === 'all') {
      const { rows } = await db.execute(`
        SELECT t.*,
               last.coach_id AS last_coach_id, c.name AS last_coach_name,
               last.season_name AS last_season_name,
               EXISTS (SELECT 1 FROM season_teams a JOIN seasons s ON s.id = a.season_id
                       WHERE a.team_id = t.id AND s.status = 'active') AS in_active_season
        FROM teams t
        LEFT JOIN (
          SELECT st.team_id, st.coach_id, s.name AS season_name,
                 ROW_NUMBER() OVER (PARTITION BY st.team_id ORDER BY s.number DESC) AS rn
          FROM season_teams st JOIN seasons s ON s.id = st.season_id
        ) last ON last.team_id = t.id AND last.rn = 1
        LEFT JOIN coaches c ON c.id = last.coach_id
        ORDER BY t.name ASC
      `);
      return NextResponse.json(rows.map(r => ({ ...r, in_active_season: !!r.in_active_season })));
    }

    const season = await resolveSeason(request);
    if (!season) return seasonNotFound();
    const { rows: teams } = await db.execute({
      sql: `
        SELECT t.*, st.coach_id, c.name AS coach_name
        FROM season_teams st
        JOIN teams t ON t.id = st.team_id
        LEFT JOIN coaches c ON c.id = st.coach_id
        WHERE st.season_id = ?
        ORDER BY t.name ASC
      `,
      args: [season.id]
    });
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

    // Ogni squadra nuova entra nella stagione attiva, con l'allenatore scelto o creato nel form
    const activeSeason = await getActiveSeason();
    if (!activeSeason) {
      return NextResponse.json({ error: 'There is no active season: start one before drafting teams.' }, { status: 409 });
    }
    const coach = await resolveCoachInput({
      coach_id: formData.get('coach_id')?.toString(),
      new_coach_name: formData.get('new_coach_name')?.toString(),
    });
    if (!coach.coachId) {
      return NextResponse.json({ error: 'Choose a coach or create a new one' }, { status: 400 });
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
    const statements = [];
    if (coach.statement) statements.push(coach.statement);

    statements.push({
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
    statements.push({
      sql: 'INSERT INTO season_teams (season_id, team_id, coach_id) VALUES (?, ?, ?)',
      args: [activeSeason.id, newTeamId, coach.coachId]
    });
    await db.batch(statements, 'write');

    const { rows: newTeamRows } = await db.execute({
      sql: 'SELECT * FROM teams WHERE id = ?',
      args: [newTeamId]
    });

    return NextResponse.json(newTeamRows[0], { status: 201 });
  } catch (error) {
    if (error instanceof UploadError || error instanceof CoachInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error creating team:', error);
    return NextResponse.json({ error: 'Failed to create team' }, { status: 500 });
  }
}
