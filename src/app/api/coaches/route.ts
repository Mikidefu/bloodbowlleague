import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { CoachInputError, computeCoachCareers, resolveCoachInput } from '@/lib/coaches';

// Tutti gli allenatori con il riepilogo di carriera (per le squadre e i form basta ?summary=0 per la sola lista)
export async function GET(request: Request) {
  try {
    if (new URL(request.url).searchParams.get('summary') === '0') {
      const { rows } = await db.execute('SELECT id, name FROM coaches ORDER BY name COLLATE NOCASE');
      return NextResponse.json(rows);
    }
    const careers = await computeCoachCareers();
    return NextResponse.json(careers.map(({ seasons, ...coach }) => ({
      ...coach,
      // stagione più recente, per mostrare squadra e stagione attuali nella lista
      latest: seasons[0] ? { season_name: seasons[0].season_name, season_status: seasons[0].season_status, team_id: seasons[0].team_id, team_name: seasons[0].team_name } : null,
    })));
  } catch (error) {
    console.error('Error fetching coaches:', error);
    return NextResponse.json({ error: 'Failed to fetch coaches' }, { status: 500 });
  }
}

// Crea un allenatore; se il nome esiste già restituisce quello esistente
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'Coach name is required' }, { status: 400 });
    }
    const { coachId, statement } = await resolveCoachInput({ new_coach_name: body.name });
    if (statement) await db.execute(statement);
    const { rows: [coach] } = await db.execute({ sql: 'SELECT id, name FROM coaches WHERE id = ?', args: [coachId] });
    return NextResponse.json({ ...coach, created: !!statement }, { status: statement ? 201 : 200 });
  } catch (error) {
    if (error instanceof CoachInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error creating coach:', error);
    return NextResponse.json({ error: 'Failed to create coach' }, { status: 500 });
  }
}
