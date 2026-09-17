// Migrazione stato delle stagioni: aggiunge seasons.closed_reason.
//
// Uso (dalla cartella blood-bowl-app):
//   node --env-file=.env.local scripts/migrate-season-status.mjs          -> anteprima, nessuna modifica
//   node --env-file=.env.local scripts/migrate-season-status.mjs --apply  -> applica
//
// Perché una colonna nuova e non altri valori in "status": in SQLite cambiare il CHECK di "status"
// richiede di ricreare la tabella seasons e, con le foreign key attive, il DROP della tabella
// cancellerebbe a cascata le iscrizioni in season_teams.
//
//   status = 'active'     -> stagione in corso (closed_reason NULL)
//   status = 'completed'  -> stagione chiusa; closed_reason dice come: 'completed' | 'paused' | 'cancelled'
//
// Solo additiva e idempotente: le stagioni già chiuse diventano 'completed'.

import { createClient } from '@libsql/client';

const APPLY = process.argv.includes('--apply');
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

const columns = (await db.execute('PRAGMA table_info(seasons)')).rows;
const hasColumn = columns.some(c => c.name === 'closed_reason');
const { rows: seasons } = await db.execute(
  `SELECT number, name, status${hasColumn ? ', closed_reason' : ', NULL AS closed_reason'} FROM seasons ORDER BY number`
);

console.log(`Colonna closed_reason presente: ${hasColumn}`);
for (const s of seasons) {
  const after = s.status === 'active' ? null : (s.closed_reason ?? 'completed');
  console.log(`  #${s.number} ${s.name}: status=${s.status}, closed_reason ${s.closed_reason ?? 'NULL'} -> ${after ?? 'NULL'}`);
}

if (APPLY) {
  const statements = [];
  if (!hasColumn) {
    statements.push("ALTER TABLE seasons ADD COLUMN closed_reason TEXT CHECK (closed_reason IN ('completed', 'paused', 'cancelled'))");
  }
  statements.push("UPDATE seasons SET closed_reason = 'completed' WHERE status = 'completed' AND closed_reason IS NULL");
  statements.push("UPDATE seasons SET closed_reason = NULL WHERE status = 'active' AND closed_reason IS NOT NULL");
  await db.batch(statements, 'write');
  const { rows: [check] } = await db.execute(`
    SELECT (SELECT COUNT(*) FROM seasons WHERE status = 'completed' AND closed_reason IS NULL) AS closed_without_reason,
           (SELECT COUNT(*) FROM seasons WHERE status = 'active') AS active
  `);
  console.log(`Migrazione completata. Stagioni attive: ${check.active}, chiuse senza motivo: ${check.closed_without_reason}`);
} else {
  console.log('\nAnteprima: nessuna modifica. Aggiungi --apply per applicare.');
}
db.close();
