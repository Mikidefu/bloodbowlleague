// Migrazione stagioni e allenatori.
//
// Uso (dalla cartella blood-bowl-app):
//   node --env-file=.env.local scripts/migrate-seasons.mjs          -> anteprima, nessuna modifica
//   node --env-file=.env.local scripts/migrate-seasons.mjs --apply  -> applica
//
// Cosa fa:
//   1. crea le tabelle coaches, seasons e season_teams e la colonna matches.season_id
//   2. se non esiste nessuna stagione crea "Season 1" (attiva)
//   3. assegna alla stagione attiva le partite senza stagione e iscrive le squadre che non
//      partecipano a nessuna stagione (dati esistenti o creati dalla versione precedente dell'app)
// È solo additiva e idempotente: si può rieseguire subito prima del deploy senza effetti doppi.

import { createClient } from '@libsql/client';
import crypto from 'crypto';

const APPLY = process.argv.includes('--apply');
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

const tableExists = async name =>
  (await db.execute({ sql: "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", args: [name] })).rows.length > 0;

const hasSeasons = await tableExists('seasons');
const hasSeasonTeams = await tableExists('season_teams');
const matchColumns = (await db.execute('PRAGMA table_info(matches)')).rows;
const hasMatchSeason = matchColumns.some(c => c.name === 'season_id');

const activeSeason = hasSeasons
  ? (await db.execute("SELECT * FROM seasons WHERE status = 'active'")).rows[0]
  : null;

const orphanMatches = Number((await db.execute(
  hasMatchSeason ? 'SELECT COUNT(*) AS c FROM matches WHERE season_id IS NULL' : 'SELECT COUNT(*) AS c FROM matches'
)).rows[0].c);
const orphanTeams = (await db.execute(
  hasSeasonTeams
    ? 'SELECT id, name FROM teams WHERE id NOT IN (SELECT team_id FROM season_teams) ORDER BY name'
    : 'SELECT id, name FROM teams ORDER BY name'
)).rows;

console.log(`Tabelle: seasons=${hasSeasons} season_teams=${hasSeasonTeams} matches.season_id=${hasMatchSeason}`);
console.log(`Stagione attiva: ${activeSeason ? activeSeason.name : '(nessuna: verrà creata "Season 1")'}`);
console.log(`Partite da assegnare alla stagione attiva: ${orphanMatches}`);
console.log(`Squadre da iscrivere alla stagione attiva: ${orphanTeams.length}${orphanTeams.length ? ' -> ' + orphanTeams.map(t => t.name).join(', ') : ''}`);

if (APPLY) {
  await applyPlan();
} else {
  console.log('\nAnteprima: nessuna modifica. Aggiungi --apply per applicare.');
}
db.close();

async function applyPlan() {
  const seasonId = activeSeason ? String(activeSeason.id) : crypto.randomUUID();

  const statements = [
    `CREATE TABLE IF NOT EXISTS coaches (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_coaches_name ON coaches(name COLLATE NOCASE)',
    `CREATE TABLE IF NOT EXISTS seasons (
      id TEXT PRIMARY KEY,
      number INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME
    )`,
    // Al massimo una stagione attiva alla volta
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_seasons_single_active ON seasons(status) WHERE status = 'active'",
    `CREATE TABLE IF NOT EXISTS season_teams (
      season_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      coach_id TEXT,
      PRIMARY KEY (season_id, team_id),
      FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE SET NULL
    )`,
    'CREATE INDEX IF NOT EXISTS idx_season_teams_coach ON season_teams(coach_id)',
  ];
  if (!hasMatchSeason) {
    statements.push('ALTER TABLE matches ADD COLUMN season_id TEXT REFERENCES seasons(id)');
  }
  statements.push('CREATE INDEX IF NOT EXISTS idx_matches_season ON matches(season_id)');

  if (!activeSeason) {
    const { rows } = hasSeasons ? await db.execute('SELECT COALESCE(MAX(number), 0) AS n FROM seasons') : { rows: [{ n: 0 }] };
    const number = Number(rows[0].n) + 1;
    statements.push({
      sql: "INSERT INTO seasons (id, number, name, status) VALUES (?, ?, ?, 'active')",
      args: [seasonId, number, `Season ${number}`],
    });
  }
  statements.push({ sql: 'UPDATE matches SET season_id = ? WHERE season_id IS NULL', args: [seasonId] });
  statements.push({
    sql: 'INSERT OR IGNORE INTO season_teams (season_id, team_id) SELECT ?, id FROM teams WHERE id NOT IN (SELECT team_id FROM season_teams)',
    args: [seasonId],
  });

  await db.batch(statements, 'write');

  const check = (await db.execute(`
    SELECT (SELECT COUNT(*) FROM seasons WHERE status = 'active') AS active_seasons,
           (SELECT COUNT(*) FROM matches WHERE season_id IS NULL) AS matches_without_season,
           (SELECT COUNT(*) FROM teams WHERE id NOT IN (SELECT team_id FROM season_teams)) AS teams_without_season
  `)).rows[0];
  console.log(`Migrazione completata. Stagioni attive: ${check.active_seasons}, partite senza stagione: ${check.matches_without_season}, squadre senza stagione: ${check.teams_without_season}`);
}
