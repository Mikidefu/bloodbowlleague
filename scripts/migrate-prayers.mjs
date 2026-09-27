// Migrazione dei Prayers to Nuffle (pp. 142-143): le preghiere tirate nel pre-partita e le statistiche
// che danno SPP solo con la preghiera giusta.
//   match_team_reports.prayers   JSON dei risultati del D16 (vedi src/lib/prayers.ts)
//   player_stats.catches         Dazzling Catching
//   player_stats.crowd_cas       Fan Interaction
//   player_stats.foul_cas        Fouling Frenzy
//
// Uso (dalla cartella blood-bowl-app):
//   node --env-file=.env.local scripts/migrate-prayers.mjs          -> anteprima, nessuna modifica
//   node --env-file=.env.local scripts/migrate-prayers.mjs --apply  -> applica
//
// Solo additiva e idempotente: colonne nuove con default, nessun dato esistente toccato. Si può rilanciare.
// Va eseguita PRIMA del deploy: pre-partita e referto scrivono queste colonne. Le definizioni sono quelle di src/lib/schema.sql.

import { createClient } from '@libsql/client';

const APPLY = process.argv.includes('--apply');
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

const COLUMNS = [
  ['match_team_reports', 'prayers', 'TEXT'],
  ['player_stats', 'catches', 'INTEGER DEFAULT 0'],
  ['player_stats', 'crowd_cas', 'INTEGER DEFAULT 0'],
  ['player_stats', 'foul_cas', 'INTEGER DEFAULT 0'],
];

const columnsOf = async table => new Set((await db.execute(`PRAGMA table_info(${table})`)).rows.map(r => String(r.name)));

const missing = [];
for (const [table, column, type] of COLUMNS) {
  if (!(await columnsOf(table)).has(column)) missing.push([table, column, type]);
}
console.log(`Colonne mancanti: ${missing.length ? missing.map(([t, c]) => `${t}.${c}`).join(', ') : 'nessuna'}`);

if (!APPLY) {
  console.log('\nAnteprima: nessuna modifica. Aggiungi --apply per applicare.');
} else if (!missing.length) {
  console.log('Niente da applicare.');
} else {
  await db.batch(missing.map(([table, column, type]) => `ALTER TABLE ${table} ADD COLUMN ${column} ${type}`), 'write');
  let ok = true;
  for (const [table, column] of COLUMNS) ok &&= (await columnsOf(table)).has(column);
  console.log(`Migrazione completata: ${ok ? 'colonne presenti' : 'ATTENZIONE, colonne mancanti'}`);
}
db.close();
