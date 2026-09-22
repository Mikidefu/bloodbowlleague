// Migrazione regole di League Play (Rulebook 2025): roster, post-partita, infortuni, incentivi.
//
// Uso (dalla cartella blood-bowl-app):
//   node --env-file=.env.local scripts/migrate-league-rules.mjs                 -> anteprima, nessuna modifica
//   node --env-file=.env.local scripts/migrate-league-rules.mjs --apply         -> applica (backup in backups/)
//   ... --apply --brawlin-brutes    -> ricalcola anche gli SPP già assegnati con Brawlin' Brutes (TD 2, CAS 3)
//
// Cosa fa (solo aggiunte, idempotente):
//   1. nuove colonne su teams, players, player_stats, matches e nuove tabelle player_injuries, match_team_reports
//   2. collega ogni squadra al suo Team Roster partendo dal vecchio campo "race" (League e Favoured of se non c'è scelta)
//   3. collega i giocatori alla posizione del roster quando il ruolo coincide col nome della posizione
//   4. porta i Dedicated Fans (colonna fan_factor) nell'intervallo 1-7 (p. 91)
//   5. ricalcola gli SPP delle partite già giocate con l'MVP a 4 SPP invece di 5 (p. 96)
// Le partite già giocate restano "legacy": correggerle non tocca Treasury, fan e infortuni.
//
// Richiede Node 22.6+ (import diretto di src/lib/rosters.ts).

import { createClient } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import { LEGACY_RACE_TO_ROSTER, ROSTERS, getRoster, hasRule } from '../src/lib/rosters.ts';

const APPLY = process.argv.includes('--apply');
const BRAWLIN_BRUTES = process.argv.includes('--brawlin-brutes');
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

const columnsOf = async table => new Set((await db.execute(`PRAGMA table_info(${table})`)).rows.map(c => String(c.name)));
const [teamCols, playerCols, statCols, matchCols] = await Promise.all(['teams', 'players', 'player_stats', 'matches'].map(columnsOf));

const NEW_COLUMNS = {
  teams: [
    ['roster', 'TEXT'],
    ['team_league', 'TEXT'],
    ['favoured_of', 'TEXT'],
  ],
  players: [
    ['position_key', 'TEXT'],
    ['hiring_fee', 'INTEGER'],
    ['niggling_injuries', 'INTEGER DEFAULT 0'],
    ['temp_retired', 'BOOLEAN DEFAULT 0'],
    ['left_team', 'BOOLEAN DEFAULT 0'],
    ['journeyman', 'BOOLEAN DEFAULT 0'],
    ['journeyman_match_id', 'TEXT'],
    ['mng_match_id', 'TEXT'],
    ['is_captain', 'BOOLEAN DEFAULT 0'],
    ['hatreds', 'TEXT'],
  ],
  player_stats: [
    ['ttm', 'INTEGER DEFAULT 0'],
    ['landings', 'INTEGER DEFAULT 0'],
  ],
  matches: [
    ['outcome', "TEXT DEFAULT 'played'"],
    ['conceded_team_id', 'TEXT'],
    ['penalty_winner_id', 'TEXT'],
    ['rules_applied', 'BOOLEAN DEFAULT 0'],
    ['pregame_done', 'BOOLEAN DEFAULT 0'],
  ],
};
const existing = { teams: teamCols, players: playerCols, player_stats: statCols, matches: matchCols };
const missing = Object.entries(NEW_COLUMNS).flatMap(([table, cols]) => cols.filter(([name]) => !existing[table].has(name)).map(([name, type]) => ({ table, name, type })));

console.log(`Colonne da aggiungere: ${missing.length ? missing.map(c => `${c.table}.${c.name}`).join(', ') : 'nessuna'}`);

// --- Squadre -> roster ---
const { rows: teams } = await db.execute('SELECT * FROM teams ORDER BY name');
const teamPlan = teams.map(t => {
  const rosterKey = teamCols.has('roster') && t.roster ? String(t.roster) : (LEGACY_RACE_TO_ROSTER[String(t.race)] || null);
  const roster = getRoster(rosterKey);
  const league = (teamCols.has('team_league') && t.team_league) || (roster?.leagues.length === 1 ? roster.leagues[0] : null);
  const favoured = (teamCols.has('favoured_of') && t.favoured_of) || (roster?.favouredOf?.length === 1 ? roster.favouredOf[0] : null);
  const fans = Math.min(7, Math.max(1, Number(t.fan_factor || 0)));
  return { id: t.id, name: t.name, race: t.race, rosterKey: roster ? roster.key : null, roster, league, favoured, fansBefore: Number(t.fan_factor || 0), fans, rerollCost: roster?.rerollCost ?? null, rerollCostBefore: Number(t.reroll_cost || 0) };
});
console.log('\nSquadre:');
console.table(teamPlan.map(t => ({
  squadra: t.name, race: t.race, roster: t.rosterKey ?? '— (da collegare a mano)', league: t.league ?? '(da scegliere)',
  favoured: t.favoured ?? '', fans: `${t.fansBefore} -> ${t.fans}`, 'costo RR': t.rerollCost === null ? '' : `${t.rerollCostBefore} -> ${t.rerollCost}`,
})));

// --- Giocatori -> posizione ---
const { rows: players } = await db.execute('SELECT * FROM players');
const teamById = new Map(teamPlan.map(t => [t.id, t]));
const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z]/g, '');
const distance = (a, b) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
};
// Nome identico; altrimenti un'unica posizione che finisce col ruolo ("Lineman" -> "Gnome Lineman")
// o che differisce di al massimo 2 lettere ("Pump Wagoon" -> "Pump Wagon")
const matchPosition = (roster, role) => {
  if (!roster) return undefined;
  const r = norm(role);
  const unique = list => (list.length === 1 ? list[0] : undefined);
  return roster.positions.find(pos => norm(pos.name) === r)
      ?? unique(roster.positions.filter(pos => norm(pos.name).endsWith(r)))
      ?? unique(roster.positions.filter(pos => distance(norm(pos.name), r) <= 2));
};
const playerPlan = players.map(pl => {
  const team = teamById.get(pl.team_id);
  const position = playerCols.has('position_key') && pl.position_key
    ? team?.roster?.positions.find(pos => pos.key === pl.position_key)
    : matchPosition(team?.roster, pl.role);
  return { id: pl.id, team: team?.name, name: pl.name, role: pl.role, position };
});
const unmatched = playerPlan.filter(pl => teamById.get(players.find(x => x.id === pl.id).team_id)?.roster && !pl.position);
console.log(`\nGiocatori collegati a una posizione: ${playerPlan.filter(pl => pl.position).length}/${players.length}`);
if (unmatched.length) {
  console.log('Ruoli senza posizione corrispondente (da sistemare a mano dalla pagina squadra):');
  console.table(unmatched.map(pl => ({ squadra: pl.team, giocatore: pl.name, ruolo: pl.role })));
}

// --- SPP delle partite giocate ---
const { rows: stats } = await db.execute(`
  SELECT s.*, p.team_id, p.name AS player_name, t.name AS team_name
  FROM player_stats s JOIN players p ON p.id = s.player_id JOIN teams t ON t.id = p.team_id
`);
const sppPlan = stats.map(s => {
  const brutes = BRAWLIN_BRUTES && hasRule(teamById.get(s.team_id)?.roster ?? null, 'Brawlin Brutes');
  const n = k => Number(s[k] || 0);
  const after = n('touchdowns') * (brutes ? 2 : 3) + n('casualties') * (brutes ? 3 : 2) + n('interceptions') * 2
              + n('completions') + n('ttm') + n('landings') + n('mvp') * 4;
  return { id: s.id, player_id: s.player_id, team: s.team_name, player: s.player_name, before: n('spp_earned'), after };
}).filter(s => s.before !== s.after);
const byPlayer = new Map();
for (const s of sppPlan) {
  const row = byPlayer.get(s.player_id) ?? { squadra: s.team, giocatore: s.player, delta: 0 };
  row.delta += s.after - s.before;
  byPlayer.set(s.player_id, row);
}
console.log(`\nSPP da ricalcolare (MVP 4${BRAWLIN_BRUTES ? ", Brawlin' Brutes" : ''}): ${sppPlan.length} righe, ${byPlayer.size} giocatori`);
if (byPlayer.size) console.table([...byPlayer.values()]);
const sppNow = new Map(players.map(p => [p.id, Number(p.spp || 0)]));
const negative = [...byPlayer.entries()].filter(([id, r]) => sppNow.get(id) + r.delta < 0);
if (negative.length) {
  console.log('ATTENZIONE: questi giocatori finirebbero con SPP negativi (avanzamenti già comprati con gli SPP vecchi):');
  console.table(negative.map(([id, r]) => ({ ...r, spp_attuali: sppNow.get(id), dopo: sppNow.get(id) + r.delta })));
}

if (!ROSTERS.length) throw new Error('Roster non caricati');

if (APPLY) {
  const backupDir = path.join(process.cwd(), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  for (const table of ['teams', 'players', 'player_stats', 'matches']) {
    const { rows } = await db.execute(`SELECT * FROM ${table}`);
    fs.writeFileSync(path.join(backupDir, `${table}-league-rules-${stamp}.json`), JSON.stringify(rows, null, 2));
  }
  console.log(`\nBackup salvato in ${backupDir}`);

  const statements = missing.map(c => `ALTER TABLE ${c.table} ADD COLUMN ${c.name} ${c.type}`);
  statements.push(`CREATE TABLE IF NOT EXISTS player_injuries (
    id TEXT PRIMARY KEY,
    match_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    result TEXT NOT NULL CHECK (result IN ('BH', 'SH', 'SI', 'LI', 'DEAD')),
    stat TEXT CHECK (stat IN ('ma', 'st', 'ag', 'pa', 'av')),
    stat_applied BOOLEAN DEFAULT 0,
    hatred TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
  )`);
  statements.push('CREATE INDEX IF NOT EXISTS idx_player_injuries_match ON player_injuries(match_id)');
  statements.push(`CREATE TABLE IF NOT EXISTS match_team_reports (
    match_id TEXT NOT NULL,
    team_id TEXT NOT NULL,
    fair_weather INTEGER,
    fan_factor INTEGER,
    ctv INTEGER,
    petty_cash INTEGER DEFAULT 0,
    treasury_spent INTEGER DEFAULT 0,
    inducements TEXT,
    journeymen INTEGER DEFAULT 0,
    stalling BOOLEAN DEFAULT 0,
    winnings INTEGER DEFAULT 0,
    df_roll INTEGER,
    df_change INTEGER DEFAULT 0,
    quit_player_ids TEXT,
    recovered_player_ids TEXT,
    released_player_ids TEXT,
    mistake_result TEXT,
    mistake_roll INTEGER,
    mistake_extra INTEGER,
    mistake_treasury_before INTEGER,
    mistake_loss INTEGER DEFAULT 0,
    PRIMARY KEY (match_id, team_id),
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
  )`);
  await db.batch(statements, 'write');

  const data = [];
  for (const t of teamPlan) {
    data.push({
      sql: 'UPDATE teams SET roster = COALESCE(roster, ?), team_league = COALESCE(team_league, ?), favoured_of = COALESCE(favoured_of, ?), fan_factor = ?, reroll_cost = COALESCE(?, reroll_cost) WHERE id = ?',
      args: [t.rosterKey, t.league, t.favoured, t.fans, t.rerollCost, t.id],
    });
  }
  for (const pl of playerPlan.filter(pl => pl.position)) {
    data.push({ sql: 'UPDATE players SET position_key = COALESCE(position_key, ?), hiring_fee = COALESCE(hiring_fee, ?) WHERE id = ?', args: [pl.position.key, pl.position.cost, pl.id] });
  }
  data.push("UPDATE matches SET outcome = 'played' WHERE outcome IS NULL");
  for (const s of sppPlan) data.push({ sql: 'UPDATE player_stats SET spp_earned = ? WHERE id = ?', args: [s.after, s.id] });
  for (const id of byPlayer.keys()) {
    data.push({
      sql: `UPDATE players SET spp = COALESCE(spp_base, 0)
              + (SELECT COALESCE(SUM(spp_earned), 0) FROM player_stats WHERE player_id = ?)
              - (SELECT COALESCE(SUM(spp_cost), 0) FROM player_advancements WHERE player_id = ?) WHERE id = ?`,
      args: [id, id, id],
    });
  }
  await db.batch(data, 'write');
  console.log('Migrazione completata.');
} else {
  console.log('\nAnteprima: nessuna modifica. Aggiungi --apply per applicare.');
}
db.close();
