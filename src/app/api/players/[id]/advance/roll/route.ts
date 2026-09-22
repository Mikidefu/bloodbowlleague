import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { signData } from '@/lib/auth';
import {
  MAX_ADVANCEMENTS, MAX_IMPROVEMENTS_PER_STAT, advancementCost, categoryLetters, categoryName,
  isEliteSkill, isSkillCategory, skillFromTable, statsForRoll,
} from '@/lib/advancement';
import { improveCharacteristic } from '@/lib/characteristics';
import { rollDie } from '@/lib/leagueRules';
import { toPlayer } from '@/lib/players';
import { rosterChangesBlocked } from '@/lib/postgame';

// Tiri degli avanzamenti (pp. 97-98). Tira il server e restituisce un token firmato:
// il giocatore sceglie tra i risultati usciti e POST /advance verifica che siano quelli.
//   { kind: 'randomPrimary', category: 'G' } -> due skill dalla Skill Table, se ne sceglie una
//   { kind: 'stat' }                         -> D8 sulla Characteristic Improvement Table
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const kind = body.kind === 'stat' ? 'stat' : body.kind === 'randomPrimary' ? 'randomPrimary' : null;
    if (!kind) return NextResponse.json({ error: 'Invalid roll' }, { status: 400 });

    const [playerRes, ownedRes, skillsRes] = await Promise.all([
      db.execute({ sql: 'SELECT * FROM players WHERE id = ?', args: [id] }),
      db.execute({ sql: 'SELECT skill_id FROM skills_players WHERE player_id = ?', args: [id] }),
      db.execute('SELECT id, name, type FROM skills'),
    ]);
    if (!playerRes.rows[0]) return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    const player = toPlayer(playerRes.rows[0]);
    const blocked = await rosterChangesBlocked(player.team_id);
    if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });
    if (player.dead) return NextResponse.json({ error: 'Dead players cannot advance' }, { status: 400 });

    const { advancements, spp } = player;
    if (advancements >= MAX_ADVANCEMENTS) {
      return NextResponse.json({ error: 'Player has reached the maximum number of advancements' }, { status: 400 });
    }
    const cost = advancementCost(kind, advancements);
    if (spp < cost) return NextResponse.json({ error: `Not enough SPP (${spp}/${cost})` }, { status: 400 });

    if (kind === 'randomPrimary') {
      const letters = categoryLetters(player.primary_skills);
      const category = String(body.category ?? '').toUpperCase();
      if (!isSkillCategory(category) || !letters.includes(category)) {
        return NextResponse.json({ error: `This player has no ${categoryName(category) || 'such'} Primary Skills` }, { status: 400 });
      }
      const owned = new Set(ownedRes.rows.map(r => String(r.skill_id)));
      const byName = new Map(skillsRes.rows.map(s => [String(s.name).toLowerCase(), s]));

      // Due tiri da 2D6; una skill già posseduta si ritira (p. 97)
      const options: { id: string; name: string; type: string; elite: boolean; rolls: number[] }[] = [];
      for (let i = 0; i < 2; i++) {
        for (let attempt = 0; attempt < 40; attempt++) {
          const first = rollDie(6);
          const second = rollDie(6);
          const name = skillFromTable(category, first, second);
          const skill = name ? byName.get(name.toLowerCase()) : null;
          if (!skill || owned.has(String(skill.id))) continue;
          options.push({ id: String(skill.id), name: String(skill.name), type: String(skill.type), elite: isEliteSkill(String(skill.name)), rolls: [first, second] });
          break;
        }
      }
      if (!options.length) return NextResponse.json({ error: 'No Primary Skills left for this player' }, { status: 400 });
      // Se esce due volte la stessa skill, quella è la scelta obbligata (p. 97)
      const unique = options.filter((o, i) => options.findIndex(x => x.id === o.id) === i);

      return NextResponse.json({
        kind, category, cost, options: unique,
        token: signData({ p: id, k: kind, a: advancements, ids: unique.map(o => o.id) }),
      });
    }

    // Characteristic Improvement: D8 (p. 98)
    const d8 = rollDie(8);
    const row = statsForRoll(d8)!;
    const { rows: spent } = await db.execute({
      sql: "SELECT stat, COUNT(*) AS n FROM player_advancements WHERE player_id = ? AND kind = 'stat' AND stat IS NOT NULL GROUP BY stat",
      args: [id],
    });
    const improvedTimes = new Map(spent.map(r => [String(r.stat), Number(r.n)]));

    const stats = row.stats.map(stat => {
      const times = improvedTimes.get(stat) ?? 0;
      const atCap = improveCharacteristic(stat, player[stat]) === null;
      return {
        stat,
        current: player[stat],
        times,
        available: !atCap && times < MAX_IMPROVEMENTS_PER_STAT,
        reason: atCap ? 'max' : times >= MAX_IMPROVEMENTS_PER_STAT ? 'twice' : null,
      };
    });

    return NextResponse.json({
      kind, cost, d8, label: row.label, stats,
      token: signData({ p: id, k: kind, a: advancements, d8, stats: stats.filter(s => s.available).map(s => s.stat) }),
    });
  } catch (error) {
    console.error('Error rolling for advancement:', error);
    return NextResponse.json({ error: 'Failed to roll' }, { status: 500 });
  }
}
