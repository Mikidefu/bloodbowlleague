// Migrazione SPP: introduce il registro degli avanzamenti senza cambiare gli SPP attuali.
//
// Uso (dalla cartella blood-bowl-app):
//   node --env-file=.env.local scripts/migrate-spp.mjs          -> anteprima, nessuna modifica
//   node --env-file=.env.local scripts/migrate-spp.mjs --apply  -> applica (salva prima un backup in backups/)
//
// Cosa fa:
//   1. crea la tabella player_advancements (registro di ogni spesa di SPP)
//   2. aggiunge players.spp_base (SPP iniziali, non guadagnati in partita)
//   3. per ogni giocatore sceglie spp_base e una riga "legacy" nel registro in modo che
//      spp_base + guadagnati - spesi = SPP attuali. Nessun valore mostrato cambia.
// È idempotente: rieseguirla non duplica nulla.

import { createClient } from '@libsql/client';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const APPLY = process.argv.includes('--apply');
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

const { rows: columns } = await db.execute('PRAGMA table_info(players)');
const hasSppBase = columns.some(c => c.name === 'spp_base');
const { rows: ledgerTable } = await db.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'player_advancements'");
const hasLedger = ledgerTable.length > 0;

const { rows: players } = await db.execute(`
  SELECT p.id, p.name, t.name AS team, COALESCE(p.spp, 0) AS spp, COALESCE(p.advancements, 0) AS advancements,
         (SELECT COALESCE(SUM(spp_earned), 0) FROM player_stats s WHERE s.player_id = p.id) AS earned
         ${hasLedger ? ", (SELECT COALESCE(SUM(spp_cost), 0) FROM player_advancements a WHERE a.player_id = p.id) AS already_spent" : ', 0 AS already_spent'}
  FROM players p JOIN teams t ON t.id = p.team_id
  ORDER BY t.name, p.name
`);

const plan = players.map(p => {
  const spp = Number(p.spp);
  const earned = Number(p.earned);
  const alreadySpent = Number(p.already_spent);
  // Differenza da coprire: positiva = SPP spesi mancanti nel registro, negativa = SPP iniziali
  const gap = earned - alreadySpent - spp;
  return {
    ...p, spp, earned,
    base: Math.max(-gap, 0),
    legacySpent: Math.max(gap, 0),
  };
});

console.log(`Giocatori: ${plan.length} | registro esistente: ${hasLedger} | spp_base esistente: ${hasSppBase}`);
console.table(plan
    .filter(p => p.base > 0 || p.legacySpent > 0 || Number(p.advancements) > 0)
    .map(p => ({ squadra: p.team, giocatore: String(p.name).slice(0, 28), avanz: Number(p.advancements), guadagnati: p.earned, spp: p.spp, spp_base: p.base, 'spesi (legacy)': p.legacySpent })));

if (APPLY) {
  await applyPlan();
} else {
  console.log('\nAnteprima: nessuna modifica. Aggiungi --apply per applicare.');
}
// Chiusura esplicita: su Windows process.exit con il client aperto fa crashare libuv
db.close();

async function applyPlan() {
  const backupDir = path.join(process.cwd(), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `players-spp-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  const { rows: fullPlayers } = await db.execute('SELECT * FROM players');
  fs.writeFileSync(backupFile, JSON.stringify(fullPlayers, null, 2));
  console.log(`Backup completo della tabella players salvato in ${backupFile}`);

  const statements = [
    `CREATE TABLE IF NOT EXISTS player_advancements (
      id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      kind TEXT NOT NULL,          -- randomPrimary | choosePrimary | chooseSecondary | stat | legacy
      skill_id TEXT,
      stat TEXT,
      spp_cost INTEGER NOT NULL CHECK (spp_cost >= 0),
      value_increase INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
      FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE SET NULL
    )`,
    'CREATE INDEX IF NOT EXISTS idx_player_advancements_player ON player_advancements(player_id)',
  ];
  if (!hasSppBase) statements.push('ALTER TABLE players ADD COLUMN spp_base INTEGER DEFAULT 0');

  for (const p of plan) {
    statements.push({ sql: 'UPDATE players SET spp_base = COALESCE(spp_base, 0) + ? WHERE id = ?', args: [p.base, p.id] });
    if (p.legacySpent > 0) {
      statements.push({
        sql: "INSERT INTO player_advancements (id, player_id, kind, spp_cost) VALUES (?, ?, 'legacy', ?)",
        args: [crypto.randomUUID(), p.id, p.legacySpent],
      });
    }
  }
  await db.batch(statements, 'write');

  // Verifica: la formula usata dall'app deve restituire esattamente gli SPP di prima
  const { rows: after } = await db.execute(`
    SELECT p.id, p.spp,
           COALESCE(p.spp_base, 0)
           + (SELECT COALESCE(SUM(spp_earned), 0) FROM player_stats s WHERE s.player_id = p.id)
           - (SELECT COALESCE(SUM(spp_cost), 0) FROM player_advancements a WHERE a.player_id = p.id) AS computed
    FROM players p
  `);
  const before = new Map(plan.map(p => [p.id, p.spp]));
  const mismatches = after.filter(r => Number(r.computed) !== before.get(r.id) || Number(r.spp) !== before.get(r.id));
  console.log(`Migrazione completata. Giocatori con SPP diversi da prima: ${mismatches.length}`);
}
