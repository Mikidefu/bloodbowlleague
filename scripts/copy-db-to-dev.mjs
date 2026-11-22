// Crea il database di prova per lo sviluppo: copia schema e dati dal database Turso di produzione
// in un file locale (dev.db) e fa usare quel file a `npm run dev`.
//
// Uso (dalla cartella dell'app):
//   npm run db:dev
//   (equivale a: node --env-file=.env.local scripts/copy-db-to-dev.mjs)
//
// Sulla produzione fa solo letture (SELECT). Ogni volta ricrea dev.db da capo: le prove fatte in locale
// si perdono, i dati tornano uguali a quelli veri di adesso.
// Non copia le iscrizioni alle notifiche push: dal locale nessuna notifica può arrivare ai telefoni veri.
//
// Poi scrive in .env.development.local (escluso da git) TURSO_DATABASE_URL=file:dev.db. Next.js legge quel
// file solo con `next dev` e gli dà la precedenza su .env.local: `next dev` usa dev.db, mentre build e
// deploy su Vercel restano sul database vero.

import { createClient } from '@libsql/client';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const TARGET_FILE = 'dev.db';
const TARGET_URL = `file:${TARGET_FILE}`;
const ENV_DEV = '.env.development.local';
const SKIP_ROWS = new Set(['push_subscriptions']);
const BATCH = 200;

const sourceUrl = process.env.TURSO_DATABASE_URL;
if (!sourceUrl) {
  console.error('TURSO_DATABASE_URL mancante: lancia lo script con --env-file=.env.local (npm run db:dev).');
  process.exit(1);
}
if (sourceUrl === TARGET_URL) {
  console.error(`TURSO_DATABASE_URL punta già a ${TARGET_URL}: serve l'indirizzo del database vero, in .env.local.`);
  process.exit(1);
}

const source = createClient({ url: sourceUrl, authToken: process.env.TURSO_AUTH_TOKEN });
console.log(`Origine: ${sourceUrl.replace(/\?.*$/, '')} (sola lettura)`);

// Schema: tabelle prima, poi viste, indici e trigger. Escluse le tabelle interne di SQLite e Turso.
const ORDER = { table: 0, view: 1, index: 2, trigger: 3 };
const objects = (
  await source.execute(
    `SELECT type, name, sql FROM sqlite_master
     WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'libsql_%' AND name NOT LIKE '_litestream%'`,
  )
).rows
  .map(r => ({ type: String(r.type), name: String(r.name), sql: String(r.sql) }))
  .sort((a, b) => ORDER[a.type] - ORDER[b.type]);
const tables = objects.filter(o => o.type === 'table');

for (const suffix of ['', '-wal', '-shm', '-journal']) rmSync(TARGET_FILE + suffix, { force: true });
const target = createClient({ url: TARGET_URL });
await target.execute('PRAGMA foreign_keys = OFF');

for (const t of tables) await target.execute(t.sql);

const quote = name => `"${name.replace(/"/g, '""')}"`;
for (const t of tables) {
  if (SKIP_ROWS.has(t.name)) {
    console.log(`  ${t.name.padEnd(24)} vuota (non copiata di proposito)`);
    continue;
  }
  const { columns, rows } = await source.execute(`SELECT * FROM ${quote(t.name)}`);
  const insert = `INSERT INTO ${quote(t.name)} (${columns.map(quote).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH).map(row => ({ sql: insert, args: columns.map((_, c) => row[c]) }));
    await target.batch(chunk, 'write');
  }
  console.log(`  ${t.name.padEnd(24)} ${rows.length} righe`);
}

for (const o of objects.filter(o => o.type !== 'table')) await target.execute(o.sql);
source.close();
target.close();

// .env.development.local: imposta (o sostituisce) solo TURSO_DATABASE_URL, lascia il resto com'è.
const line = `TURSO_DATABASE_URL=${TARGET_URL}`;
const current = existsSync(ENV_DEV) ? readFileSync(ENV_DEV, 'utf8') : '';
const next = /^TURSO_DATABASE_URL=.*$/m.test(current)
  ? current.replace(/^TURSO_DATABASE_URL=.*$/m, line)
  : `${current}${current && !current.endsWith('\n') ? '\n' : ''}# Database di prova creato da scripts/copy-db-to-dev.mjs (solo per next dev)\n${line}\n`;
writeFileSync(ENV_DEV, next);

console.log(`\nFatto: ${TARGET_FILE} pronto e ${ENV_DEV} aggiornato. Avvia con: npm run dev`);
