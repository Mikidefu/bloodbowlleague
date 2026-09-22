import { NextResponse } from 'next/server';
import db from '@/lib/db';
import crypto from 'crypto';
import { LIMITS } from '@/lib/leagueRules';
import { skillLinks } from '@/lib/matchRules';
import { DEFAULT_CHARACTERISTICS } from '@/lib/characteristics';
import { PlayerInputError, parsePlayerProfile } from '@/lib/players';
import { getPosition, getRoster } from '@/lib/rosters';
import { rosterChangesBlocked } from '@/lib/postgame';

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
    const blocked = await rosterChangesBlocked(String(team.id));
    if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });
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

    // Squadra senza roster: profilo libero, ma sempre nei valori ammessi dal regolamento
    const { skills, mng, dead } = body;
    const profile = parsePlayerProfile(body);
    if (!profile.role || profile.value === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const spp = profile.spp ?? 0;

    await db.execute({
      sql: `
        INSERT INTO players (id, team_id, jersey_number, name, role, value, primary_skills, secondary_skills, advancements, ma, st, ag, pa, av, spp, spp_base, status, mng, dead)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)
      `,
      args: [
        id, team_id, profile.jersey_number ?? null, profile.name ?? String(name).trim(), profile.role, profile.value,
        profile.primary_skills ?? null, profile.secondary_skills ?? null,
        profile.ma ?? DEFAULT_CHARACTERISTICS.ma, profile.st ?? DEFAULT_CHARACTERISTICS.st, profile.ag ?? DEFAULT_CHARACTERISTICS.ag,
        profile.pa ?? DEFAULT_CHARACTERISTICS.pa, profile.av ?? DEFAULT_CHARACTERISTICS.av,
        // Gli SPP inseriti alla creazione sono SPP iniziali: restano anche dopo i ricalcoli
        spp, spp,
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
    if (error instanceof PlayerInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Error adding player:', error);
    return NextResponse.json({ error: 'Failed to add player' }, { status: 500 });
  }
}
