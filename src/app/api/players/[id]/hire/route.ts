import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { LIMITS } from '@/lib/leagueRules';

// Ingaggio di un Journeyman dopo la partita (p. 99, step 5): costa Hiring Fee + aumenti di valore (= valore attuale),
// perde Loner e tiene gli SPP. Da quel momento è un giocatore come gli altri.
// body facoltativo: { name } per dargli un nome vero.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const newName = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null;

    const { rows: [player] } = await db.execute({ sql: 'SELECT * FROM players WHERE id = ?', args: [id] });
    if (!player) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!player.journeyman || player.left_team || player.dead) {
      return NextResponse.json({ error: 'Only a Journeyman still with the team can be hired' }, { status: 400 });
    }

    const { rows: [match] } = await db.execute({ sql: 'SELECT rules_applied FROM matches WHERE id = ?', args: [String(player.journeyman_match_id)] });
    if (!match?.rules_applied) return NextResponse.json({ error: 'Journeymen are hired after the match, in the Post-game Sequence (p. 99)' }, { status: 409 });

    const teamId = String(player.team_id);
    const { rows: [listed] } = await db.execute({
      sql: 'SELECT COUNT(*) AS n FROM players WHERE team_id = ? AND COALESCE(dead, 0) = 0 AND COALESCE(left_team, 0) = 0 AND COALESCE(journeyman, 0) = 0',
      args: [teamId],
    });
    if (Number(listed.n) >= LIMITS.maxPlayers) return NextResponse.json({ error: `The team already has ${LIMITS.maxPlayers} players` }, { status: 400 });

    const cost = Number(player.value || 0);
    // Transazione: il Journeyman diventa un giocatore solo se la Treasury basta; solo allora si paga e perde Loner
    const results = await db.batch([
      {
        sql: `UPDATE players SET journeyman = 0, name = COALESCE(?, name)
              WHERE id = ? AND journeyman = 1 AND (SELECT treasury FROM teams WHERE id = ?) >= ?`,
        args: [newName, id, teamId, cost],
      },
      { sql: 'UPDATE teams SET treasury = treasury - ? WHERE id = ? AND changes() > 0', args: [cost, teamId] },
      { sql: "DELETE FROM skills_players WHERE player_id = ? AND skill_id IN (SELECT id FROM skills WHERE name = 'Loner') AND (SELECT journeyman FROM players WHERE id = ?) = 0", args: [id, id] },
    ], 'write');
    if (results[0].rowsAffected === 0) {
      return NextResponse.json({ error: `Not enough gold: ${cost.toLocaleString('en')} gp needed` }, { status: 400 });
    }
    return NextResponse.json({ success: true, cost });
  } catch (error) {
    console.error('Error hiring journeyman:', error);
    return NextResponse.json({ error: 'Failed to hire journeyman' }, { status: 500 });
  }
}
