import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { LEAGUE_REROLL_MULTIPLIER, LIMITS, STAFF_COSTS } from '@/lib/leagueRules';
import { getRoster } from '@/lib/rosters';

// Sideline Staff e Team Re-roll durante la lega (p. 90, step 4 del post-partita p. 99), pagati dalla Treasury.
// body: { item: 'reroll' | 'assistant_coach' | 'cheerleader' | 'apothecary', action: 'hire' | 'fire' }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { item, action } = await request.json().catch(() => ({}));
    const { rows: [team] } = await db.execute({ sql: 'SELECT * FROM teams WHERE id = ?', args: [id] });
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

    const roster = getRoster(team.roster as string | null);
    const treasury = Number(team.treasury || 0);

    const items = {
      // Durante la lega un Team Re-roll costa il doppio e non si può rimuovere dalla lista (pp. 90, 99)
      reroll: { column: 'rerolls', max: LIMITS.maxRerolls, cost: (roster?.rerollCost ?? Number(team.reroll_cost || 0)) * LEAGUE_REROLL_MULTIPLIER, canFire: false },
      assistant_coach: { column: 'assistant_coaches', max: LIMITS.maxAssistantCoaches, cost: STAFF_COSTS.assistantCoach, canFire: true },
      cheerleader: { column: 'cheerleaders', max: LIMITS.maxCheerleaders, cost: STAFF_COSTS.cheerleader, canFire: true },
      apothecary: { column: 'apothecary', max: LIMITS.maxApothecaries, cost: STAFF_COSTS.apothecary, canFire: true },
    } as const;
    const def = items[item as keyof typeof items];
    if (!def || (action !== 'hire' && action !== 'fire')) {
      return NextResponse.json({ error: 'Invalid staff request' }, { status: 400 });
    }

    const current = Number(team[def.column] || 0);
    if (action === 'fire') {
      if (!def.canFire) return NextResponse.json({ error: 'Team Re-rolls cannot be removed from the Team Draft List (p. 99)' }, { status: 400 });
      if (current <= 0) return NextResponse.json({ error: 'Nothing to fire' }, { status: 400 });
      await db.execute({ sql: `UPDATE teams SET ${def.column} = ? WHERE id = ?`, args: [current - 1, id] });
      return NextResponse.json({ success: true });
    }

    if (item === 'apothecary' && roster && !roster.apothecary) {
      return NextResponse.json({ error: `${roster.name} teams cannot hire an Apothecary` }, { status: 400 });
    }
    if (current >= def.max) return NextResponse.json({ error: `Maximum reached (${def.max})` }, { status: 400 });
    if (def.cost <= 0) return NextResponse.json({ error: 'Link the team to its Team Roster to know the cost' }, { status: 400 });
    if (treasury < def.cost) {
      return NextResponse.json({ error: `Not enough gold: ${def.cost.toLocaleString('en')} gp needed, ${treasury.toLocaleString('en')} in the Treasury` }, { status: 400 });
    }

    // La colonna viene dalla lista chiusa sopra
    const result = await db.execute({
      sql: `UPDATE teams SET ${def.column} = ${def.column} + 1, treasury = treasury - ? WHERE id = ? AND treasury >= ? AND ${def.column} < ?`,
      args: [def.cost, id, def.cost, def.max],
    });
    if (result.rowsAffected === 0) return NextResponse.json({ error: 'The team changed in the meantime: reload and retry' }, { status: 409 });
    return NextResponse.json({ success: true, cost: def.cost });
  } catch (error) {
    console.error('Error hiring staff:', error);
    return NextResponse.json({ error: 'Failed to update staff' }, { status: 500 });
  }
}
