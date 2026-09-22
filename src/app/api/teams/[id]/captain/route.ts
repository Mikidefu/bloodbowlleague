import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { skillLinks } from '@/lib/matchRules';
import { onDraftList, toPlayer } from '@/lib/players';
import { rosterChangesBlocked } from '@/lib/postgame';
import { getPosition, getRoster, hasRule } from '@/lib/rosters';

// Nuovo Team Captain (p. 155): se il capitano viene ucciso in partita, a fine partita se ne nomina
// un altro. Mai un Big Guy; riceve Pro senza aumento di valore, come al draft.
// body: { player_id }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { player_id: playerId } = await request.json().catch(() => ({}));

    const { rows: [team] } = await db.execute({ sql: 'SELECT id, roster FROM teams WHERE id = ?', args: [id] });
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    const roster = getRoster(team.roster as string | null);
    if (!roster || !hasRule(roster, 'Team Captain')) {
      return NextResponse.json({ error: 'Only teams with the Team Captain special rule have a captain (p. 155)' }, { status: 400 });
    }
    const blocked = await rosterChangesBlocked(id);
    if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });

    const { rows } = await db.execute({ sql: 'SELECT * FROM players WHERE team_id = ?', args: [id] });
    const players = rows.map(row => toPlayer(row));
    if (players.some(p => p.is_captain && onDraftList(p))) {
      return NextResponse.json({ error: 'The team already has a Team Captain' }, { status: 400 });
    }
    if (!players.some(p => p.is_captain && p.dead)) {
      return NextResponse.json({ error: 'A new Team Captain can only be appointed after the captain was killed during a game (p. 155)' }, { status: 400 });
    }

    const candidate = players.find(p => p.id === String(playerId ?? ''));
    if (!candidate || !onDraftList(candidate) || candidate.journeyman) {
      return NextResponse.json({ error: 'Choose a player on the Team Draft List' }, { status: 400 });
    }
    const position = getPosition(roster, candidate.position_key);
    if (position?.keywords.includes('Big Guy')) {
      return NextResponse.json({ error: 'The Team Captain cannot be a Big Guy (p. 155)' }, { status: 400 });
    }

    const skillIds = new Map((await db.execute('SELECT id, name FROM skills')).rows.map(r => [String(r.name).toLowerCase(), String(r.id)]));
    await db.batch([
      // Il vecchio capitano morto non resta "capitano": un nuovo vuoto si apre solo con una nuova morte
      { sql: 'UPDATE players SET is_captain = 0 WHERE team_id = ? AND dead = 1 AND is_captain = 1', args: [id] },
      { sql: 'UPDATE players SET is_captain = 1 WHERE id = ?', args: [candidate.id] },
      ...skillLinks(candidate.id, ['Pro'], skillIds),
    ], 'write');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error appointing captain:', error);
    return NextResponse.json({ error: 'Failed to appoint the Team Captain' }, { status: 500 });
  }
}
