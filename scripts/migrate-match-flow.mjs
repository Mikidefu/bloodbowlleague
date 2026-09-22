// Migrazione del pre-partita guidato: aggiunge a matches il Meteo tirato (2D6) e la squadra che calcia.
//
// Uso (dalla cartella blood-bowl-app):
//   node --env-file=.env.local scripts/migrate-match-flow.mjs          -> anteprima, nessuna modifica
//   node --env-file=.env.local scripts/migrate-match-flow.mjs --apply  -> applica
//
// Solo additiva e idempotente: due colonne nuove, vuote per le partite già esistenti.
// Va eseguita PRIMA del deploy: il nuovo pre-partita le scrive.

import { createClient } from '@libsql/client';

const APPLY = process.argv.includes('--apply');
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

const COLUMNS = {
  weather_roll: 'ALTER TABLE matches ADD COLUMN weather_roll INTEGER',
  kicking_team_id: 'ALTER TABLE matches ADD COLUMN kicking_team_id TEXT',
};

const existing = new Set((await db.execute('PRAGMA table_info(matches)')).rows.map(c => String(c.name)));
const missing = Object.keys(COLUMNS).filter(c => !existing.has(c));
console.log(`Colonne mancanti in matches: ${missing.length ? missing.join(', ') : 'nessuna'}`);

if (!APPLY) {
  console.log('\nAnteprima: nessuna modifica. Aggiungi --apply per applicare.');
} else if (!missing.length) {
  console.log('Niente da applicare.');
} else {
  await db.batch(missing.map(c => COLUMNS[c]), 'write');
  const after = new Set((await db.execute('PRAGMA table_info(matches)')).rows.map(c => String(c.name)));
  console.log(`Migrazione completata: ${Object.keys(COLUMNS).every(c => after.has(c)) ? 'colonne presenti' : 'ATTENZIONE, colonne mancanti'}`);
}
db.close();
