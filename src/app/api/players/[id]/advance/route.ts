import { NextResponse } from 'next/server';
import crypto from 'crypto';
import db from '@/lib/db';
import { recalcSppStatement } from '@/lib/spp';
import { verifyData } from '@/lib/auth';
import {
  ELITE_VALUE_INCREASE, MAX_ADVANCEMENTS, MAX_IMPROVEMENTS_PER_STAT, SKILL_VALUE_INCREASE, STAT_VALUE_INCREASE,
  advancementCost, improveStat, isEliteSkill, skillsForCategories, statsForRoll,
  type AdvancementKind, type StatKey,
} from '@/lib/advancement';

const KINDS: AdvancementKind[] = ['randomPrimary', 'choosePrimary', 'chooseSecondary', 'stat', 'statDeclined'];
const STATS: StatKey[] = ['ma', 'st', 'ag', 'pa', 'av'];

type SkillRow = { id: string; name: string; type: string; description?: string };
// Token firmato dal tiro (vedi advance/roll): lega la scelta ai risultati usciti
type RollToken = { p: string; k: 'randomPrimary' | 'stat'; a: number; d8?: number; ids?: string[]; stats?: string[] };

// Applica un avanzamento SPP: costo, validazione e valori calcolati qui, non nel browser.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const kind = body.kind as AdvancementKind;
    if (!KINDS.includes(kind)) {
      return NextResponse.json({ error: 'Invalid advancement type' }, { status: 400 });
    }

    const [playerRes, ownedRes, skillsRes] = await Promise.all([
      db.execute({ sql: 'SELECT * FROM players WHERE id = ?', args: [id] }),
      db.execute({ sql: 'SELECT skill_id FROM skills_players WHERE player_id = ?', args: [id] }),
      db.execute('SELECT id, name, type, description FROM skills'),
    ]);

    const player = playerRes.rows[0];
    if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    if (player.dead) return NextResponse.json({ error: 'Dead players cannot advance' }, { status: 400 });

    const advancements = Number(player.advancements || 0);
    if (advancements >= MAX_ADVANCEMENTS) {
      return NextResponse.json({ error: 'Player has reached the maximum number of advancements' }, { status: 400 });
    }

    const cost = advancementCost(kind, advancements);
    const spp = Number(player.spp || 0);
    if (spp < cost) {
      return NextResponse.json({ error: `Not enough SPP (${spp}/${cost})` }, { status: 400 });
    }

    const ownedIds = ownedRes.rows.map(r => String(r.skill_id));
    const allSkills = skillsRes.rows as unknown as SkillRow[];

    // Tiro casuale e miglioramento di caratteristica passano dal token firmato di /advance/roll
    const needsRoll = kind === 'randomPrimary' || kind === 'stat' || kind === 'statDeclined';
    const token = needsRoll ? verifyData<RollToken>(body.token) : null;
    if (needsRoll) {
      const expected = kind === 'randomPrimary' ? 'randomPrimary' : 'stat';
      if (!token || token.p !== id || token.k !== expected || token.a !== advancements) {
        return NextResponse.json({ error: 'Roll the dice again: this result is no longer valid' }, { status: 409 });
      }
    }

    let valueIncrease = 0;
    let newSkill: SkillRow | null = null;
    let statUpdate: { column: StatKey; value: number | string } | null = null;

    if (kind === 'stat') {
      const stat = body.stat as StatKey;
      if (!STATS.includes(stat)) {
        return NextResponse.json({ error: 'Invalid characteristic' }, { status: 400 });
      }
      if (!token?.stats?.includes(stat)) {
        // Se era tra quelle uscite ma non selezionabile, il motivo è il limite di due volte o il massimo (pp. 37, 98)
        const rolled = statsForRoll(Number(token?.d8)) ;
        const message = rolled?.stats.includes(stat)
            ? `${stat.toUpperCase()} cannot be improved again: it is at its maximum or has already been improved ${MAX_IMPROVEMENTS_PER_STAT} times (p. 98)`
            : 'That characteristic is not one of the improvements you rolled (p. 98)';
        return NextResponse.json({ error: message }, { status: 400 });
      }
      // Una caratteristica non si migliora più di due volte (p. 98)
      const { rows: [already] } = await db.execute({
        sql: "SELECT COUNT(*) AS n FROM player_advancements WHERE player_id = ? AND kind = 'stat' AND stat = ?",
        args: [id, stat],
      });
      if (Number(already.n) >= MAX_IMPROVEMENTS_PER_STAT) {
        return NextResponse.json({ error: `${stat.toUpperCase()} has already been improved ${MAX_IMPROVEMENTS_PER_STAT} times (p. 98)` }, { status: 400 });
      }
      const improved = improveStat(stat, player[stat] as string | number);
      if (improved === null) {
        return NextResponse.json({ error: `${stat.toUpperCase()} is already at its limit` }, { status: 400 });
      }
      statUpdate = { column: stat, value: improved };
      valueIncrease = STAT_VALUE_INCREASE[stat];
    } else {
      // Skill: scelta libera, estratta dalla Skill Table, o presa al posto del tiro rifiutato
      const isSecondary = kind === 'chooseSecondary';
      const fromSecondary = kind === 'statDeclined' && body.from === 'secondary';
      const categories = isSecondary || fromSecondary ? player.secondary_skills : player.primary_skills;
      const candidates = skillsForCategories(allSkills, categories as string | null, ownedIds);

      newSkill = candidates.find(s => s.id === body.skill_id) || null;
      if (!newSkill) {
        return NextResponse.json({ error: 'Skill not allowed for this player' }, { status: 400 });
      }
      if (kind === 'randomPrimary' && !token?.ids?.includes(newSkill.id)) {
        return NextResponse.json({ error: 'That skill is not one of the two you rolled (p. 97)' }, { status: 400 });
      }
      valueIncrease = isSecondary || fromSecondary ? SKILL_VALUE_INCREASE.secondary : SKILL_VALUE_INCREASE.primary;
      // Le skill Elite aumentano il valore di altri 10.000 (p. 97)
      if (isEliteSkill(newSkill.name)) valueIncrease += ELITE_VALUE_INCREASE;
    }

    // La colonna viene da una lista chiusa (STATS), quindi è sicuro inserirla nella query
    const statSql = statUpdate ? `, ${statUpdate.column} = ?` : '';
    const statArgs = statUpdate ? [statUpdate.value] : [];

    // Il batch è una transazione. La riga nel registro viene scritta solo se gli SPP bastano ancora
    // (protegge da due richieste contemporanee); skill e statistiche si applicano solo se quella riga esiste.
    const advancementId = crypto.randomUUID();
    const ifRecorded = 'EXISTS (SELECT 1 FROM player_advancements WHERE id = ?)';

    const statements = [
      {
        sql: `
          INSERT INTO player_advancements (id, player_id, kind, skill_id, stat, spp_cost, value_increase)
          SELECT ?, ?, ?, ?, ?, ?, ?
          WHERE (SELECT spp FROM players WHERE id = ?) >= ?
        `,
        args: [advancementId, id, kind, newSkill?.id ?? null, statUpdate?.column ?? null, cost, valueIncrease, id, cost],
      },
      {
        sql: `
          UPDATE players
          SET advancements = COALESCE(advancements, 0) + 1, value = value + ?${statSql}
          WHERE id = ? AND ${ifRecorded}
        `,
        args: [valueIncrease, ...statArgs, id, advancementId],
      },
    ];
    if (newSkill) {
      statements.push({
        sql: `INSERT INTO skills_players (player_id, skill_id) SELECT ?, ? WHERE ${ifRecorded}`,
        args: [id, newSkill.id, advancementId],
      });
    }
    statements.push(recalcSppStatement(id));

    const results = await db.batch(statements, 'write');
    if (results[0].rowsAffected === 0) {
      return NextResponse.json({ error: 'Not enough SPP' }, { status: 409 });
    }

    return NextResponse.json({ success: true, cost, skill: newSkill, stat: statUpdate, valueIncrease });
  } catch (error) {
    console.error('Error applying advancement:', error);
    return NextResponse.json({ error: 'Failed to apply advancement' }, { status: 500 });
  }
}
