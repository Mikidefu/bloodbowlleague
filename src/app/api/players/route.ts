import { NextResponse } from 'next/server';
import db from '@/lib/db';
import crypto from 'crypto';
import { LIMITS } from '@/lib/leagueRules';
import { skillLinks } from '@/lib/matchRules';
import { getPosition, getRoster } from '@/lib/rosters';

// Ingaggio di un giocatore.
// Squadre con Team Roster: { team_id, position_key, name, jersey_number } -> profilo e costo dal roster,
//   limiti di posizione e di 16 giocatori, pagamento dalla Treasury (p. 99, step 2).
// Squadre senza roster (create prima dei roster): profilo libero come in passato.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { team_id, jersey_number, name } = body;
    if (!team_id || !String(name ?? '').trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { rows: [team] } = await db.execute({ sql: 'SELECT * FROM teams WHERE id = ?', args: [team_id] });
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    const roster = getRoster(team.roster as string | null);
    const id = crypto.randomUUID();

    if (roster) {
      const position = getPosition(roster, body.position_key);
      if (!position) return NextResponse.json({ error: 'Choose a position from the Team Roster' }, { status: 400 });

      const { rows: listed } = await db.execute({
        sql: 'SELECT position_key FROM players WHERE team_id = ? AND COALESCE(dead, 0) = 0 AND COALESCE(left_team, 0) = 0 AND COALESCE(journeyman, 0) = 0',
        args: [team_id],
      });
      if (listed.length >= LIMITS.maxPlayers) return NextResponse.json({ error: `A team may never have more than ${LIMITS.maxPlayers} players (p. 89)` }, { status: 400 });
      const sameType = listed.filter(p => p.position_key === position.key).length;
      if (sameType >= position.max) return NextResponse.json({ error: `${position.name}: at most ${position.max}` }, { status: 400 });
      const group = roster.groups?.find(g => g.positions.includes(position.key));
      if (group && listed.filter(p => group.positions.includes(String(p.position_key))).length >= group.max) {
        return NextResponse.json({ error: `${group.label}: at most ${group.max}` }, { status: 400 });
      }
      const treasury = Number(team.treasury || 0);
      if (treasury < position.cost) {
        return NextResponse.json({ error: `Not enough gold: ${position.cost.toLocaleString('en')} gp needed, ${treasury.toLocaleString('en')} in the Treasury` }, { status: 400 });
      }

      const skillIds = new Map((await db.execute('SELECT id, name FROM skills')).rows.map(r => [String(r.name).toLowerCase(), String(r.id)]));
      // Transazione: il giocatore entra solo se la Treasury basta ancora, e solo allora si paga
      await db.batch([
        {
          sql: `
            INSERT INTO players (id, team_id, jersey_number, name, role, position_key, value, hiring_fee, primary_skills, secondary_skills,
                                 advancements, ma, st, ag, pa, av, spp, spp_base, status, mng, dead)
            SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 0, 0, 'Active', 0, 0
            WHERE (SELECT treasury FROM teams WHERE id = ?) >= ?
          `,
          args: [
            id, team_id, Number.isInteger(jersey_number) ? jersey_number : null, String(name).trim(), position.name, position.key,
            position.cost, position.cost, position.primary.join(', '), position.secondary.join(', '),
            position.ma, position.st, position.ag, position.pa, position.av, team_id, position.cost,
          ],
        },
        { sql: 'UPDATE teams SET treasury = treasury - ? WHERE id = ? AND EXISTS (SELECT 1 FROM players WHERE id = ?)', args: [position.cost, team_id, id] },
        ...skillLinks(id, position.skills, skillIds),
      ], 'write');
      return NextResponse.json({ success: true, cost: position.cost }, { status: 201 });
    }

    // Squadra senza roster: profilo libero
    const { role, value, skills, primary_skills, secondary_skills, ma, st, ag, pa, av, spp, mng, dead } = body;
    if (!role || value === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await db.execute({
      sql: `
        INSERT INTO players (id, team_id, jersey_number, name, role, value, primary_skills, secondary_skills, advancements, ma, st, ag, pa, av, spp, spp_base, status, mng, dead)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)
      `,
      args: [
        id, team_id, jersey_number ?? null, name, role, value,
        primary_skills ?? null, secondary_skills ?? null,
        // Gli SPP inseriti alla creazione sono SPP iniziali: restano anche dopo i ricalcoli
        ma ?? 6, st ?? 3, ag ?? '3+', pa ?? '4+', av ?? '8+', spp ?? 0, spp ?? 0,
        mng ? 1 : 0, dead ? 1 : 0
      ]
    });

    if (Array.isArray(skills) && skills.length > 0) {
      for (const skillId of skills) {
        await db.execute({
          sql: `INSERT INTO skills_players (player_id, skill_id) VALUES (?, ?)`,
          args: [id, skillId]
        });
      }
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Error adding player:', error);
    return NextResponse.json({ error: 'Failed to add player' }, { status: 500 });
  }
}
