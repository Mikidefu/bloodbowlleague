// Migrazione giocatori tipizzati: porta le righe di players nella forma che legge toPlayer (src/lib/players.ts).
//
// Uso (dalla cartella blood-bowl-app):
//   node --env-file=.env.local scripts/migrate-player-types.mjs          -> anteprima, nessuna modifica
//   node --env-file=.env.local scripts/migrate-player-types.mjs --apply  -> applica (backup in backups/)
//
// Nessuna colonna nuova: cambia solo il contenuto delle righe fuori forma.
//   - caratteristiche dentro i valori del regolamento (coerceCharacteristic di src/lib/characteristics.ts):
//     AG "3" -> "3+", PA NULL -> "-", MA/ST scritte come testo -> numeri
//   - bandiere (mng, dead, temp_retired, left_team, journeyman, is_captain) sempre 0/1
//   - contatori (advancements, niggling_injuries) mai NULL
//   - status allineato alle bandiere, come lo scrive il referto (playerStatus)
// Senza questa migrazione le stesse correzioni avverrebbero al primo referto salvato, ma solo per le
// squadre di quella partita. Idempotente: rieseguita non trova più nulla da cambiare.
//
// Richiede Node 22.6+ (import diretto di src/lib/characteristics.ts).

import { createClient } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import { STAT_KEYS, coerceCharacteristic } from '../src/lib/characteristics.ts';

const APPLY = process.argv.includes('--apply');
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

// Le stesse regole di flag e playerStatus in src/lib/players.ts
const FLAGS = ['mng', 'dead', 'temp_retired', 'left_team', 'journeyman', 'is_captain'];
const COUNTS = ['advancements', 'niggling_injuries'];
const STATUSES = ['Active', 'Injured', 'Dead'];
const flag = value => value === true || value === 1 || value === '1';
const count = value => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};
const status = row => (flag(row.dead) ? 'Dead' : flag(row.mng) ? 'Injured' : STATUSES.includes(row.status) ? row.status : 'Active');

const { rows: players } = await db.execute('SELECT p.*, t.name AS team_name FROM players p LEFT JOIN teams t ON t.id = p.team_id ORDER BY t.name, p.jersey_number, p.name');

const changes = [];
for (const row of players) {
  const fields = {};
  for (const stat of STAT_KEYS) {
    const value = coerceCharacteristic(stat, row[stat]);
    if (value !== row[stat]) fields[stat] = value;
  }
  for (const column of FLAGS) {
    const value = flag(row[column]) ? 1 : 0;
    if (value !== row[column]) fields[column] = value;
  }
  for (const column of COUNTS) {
    const value = count(row[column]);
    if (value !== row[column]) fields[column] = value;
  }
  if (status(row) !== row.status) fields.status = status(row);
  if (Object.keys(fields).length) changes.push({ row, fields });
}

console.log(`Giocatori: ${players.length}, da normalizzare: ${changes.length}`);
for (const { row, fields } of changes) {
  const list = Object.entries(fields).map(([k, v]) => `${k} ${JSON.stringify(row[k])} -> ${JSON.stringify(v)}`).join(', ');
  console.log(`  ${row.team_name ?? row.team_id} #${row.jersey_number ?? '-'} ${row.name}: ${list}`);
}

if (!APPLY) {
  console.log('\nAnteprima: nessuna modifica. Aggiungi --apply per applicare.');
} else if (!changes.length) {
  console.log('\nNiente da applicare.');
} else {
  const backupDir = path.join(process.cwd(), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = changes.map(({ row }) => Object.fromEntries(Object.entries(row).filter(([k]) => k !== 'team_name')));
  fs.writeFileSync(path.join(backupDir, `players-player-types-${stamp}.json`), JSON.stringify(backup, (k, v) => (typeof v === 'bigint' ? Number(v) : v), 2));
  console.log(`\nBackup delle righe modificate salvato in ${backupDir}`);

  await db.batch(changes.map(({ row, fields }) => {
    const columns = Object.keys(fields);
    return { sql: `UPDATE players SET ${columns.map(c => `${c} = ?`).join(', ')} WHERE id = ?`, args: [...columns.map(c => fields[c]), row.id] };
  }), 'write');

  const { rows } = await db.execute('SELECT * FROM players');
  const left = rows.filter(r => STAT_KEYS.some(s => coerceCharacteristic(s, r[s]) !== r[s]) || FLAGS.some(c => r[c] !== 0 && r[c] !== 1)).length;
  console.log(`Migrazione completata: ${changes.length} giocatori aggiornati, ancora fuori forma: ${left}`);
}
db.close();
