// Migrazione della partita dal vivo (companion app): tabelle match_live, match_events e push_subscriptions.
//
// Uso (dalla cartella blood-bowl-app):
//   node --env-file=.env.local scripts/migrate-live-match.mjs          -> anteprima, nessuna modifica
//   node --env-file=.env.local scripts/migrate-live-match.mjs --apply  -> applica
//
// Solo additiva e idempotente: tabelle nuove, nessun dato esistente toccato. Si può rilanciare:
// aggiunge solo quelle che mancano (push_subscriptions è arrivata con le notifiche push).
// Va eseguita PRIMA del deploy: le route /api/live le usano. Le definizioni sono le stesse di src/lib/schema.sql.

import { createClient } from '@libsql/client';

const APPLY = process.argv.includes('--apply');
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

const TABLES = {
  match_live: `CREATE TABLE IF NOT EXISTS match_live (
    match_id TEXT PRIMARY KEY,
    join_code TEXT NOT NULL UNIQUE,
    home_nonce TEXT,
    away_nonce TEXT,
    home_device TEXT,
    away_device TEXT,
    status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'ended')),
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
  )`,
  match_events: `CREATE TABLE IF NOT EXISTS match_events (
    id TEXT PRIMARY KEY,
    match_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    team_id TEXT,
    type TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    source TEXT NOT NULL CHECK (source IN ('admin', 'companion', 'server')),
    dedupe_key TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (match_id, seq),
    UNIQUE (match_id, dedupe_key),
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
  )`,
  push_subscriptions: `CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    match_id TEXT NOT NULL,
    team_id TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'it',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
  )`,
};

// Indici delle tabelle nuove (IF NOT EXISTS: sicuri da rilanciare)
const INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_push_subscriptions_match ON push_subscriptions(match_id)',
];

const tableNames = async () =>
  new Set((await db.execute(`SELECT name FROM sqlite_master WHERE type = 'table'`)).rows.map(r => String(r.name)));

const existing = await tableNames();
const missing = Object.keys(TABLES).filter(t => !existing.has(t));
console.log(`Tabelle mancanti: ${missing.length ? missing.join(', ') : 'nessuna'}`);

if (!APPLY) {
  console.log('\nAnteprima: nessuna modifica. Aggiungi --apply per applicare.');
} else if (!missing.length) {
  console.log('Niente da applicare.');
} else {
  await db.batch([...missing.map(t => TABLES[t]), ...INDEXES], 'write');
  const after = await tableNames();
  console.log(`Migrazione completata: ${Object.keys(TABLES).every(t => after.has(t)) ? 'tabelle presenti' : 'ATTENZIONE, tabelle mancanti'}`);
}
db.close();
