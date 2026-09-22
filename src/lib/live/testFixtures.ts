// Database SQLite temporaneo per i test della partita dal vivo (mai quello di produzione).
// Va importato PRIMA di '@/lib/db': imposta le variabili d'ambiente che db.ts legge al caricamento.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Client } from '@libsql/client';

const dir = mkdtempSync(path.join(tmpdir(), 'bbl-live-'));
process.env.TURSO_DATABASE_URL = pathToFileURL(path.join(dir, 'test.db')).href;
process.env.TURSO_AUTH_TOKEN = '';
process.env.ADMIN_PASSWORD = 'test-only-password';

export const H = 'team-home';
export const A = 'team-away';
export const MATCH = 'match-1';

// Due squadre, un giocatore a testa, una partita di campionato col pre-partita fatto (calciano gli ospiti)
export async function seedTestDb(db: Client) {
  await db.executeMultiple(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  await db.execute('PRAGMA foreign_keys = ON');
  await db.batch([
    `INSERT INTO seasons (id, number, name, status) VALUES ('s1', 1, 'Stagione 1', 'active')`,
    `INSERT INTO teams (id, name, race, rerolls, assistant_coaches, cheerleaders, fan_factor) VALUES ('${H}', 'Casa', 'Human', 3, 1, 2, 4)`,
    `INSERT INTO teams (id, name, race, rerolls, assistant_coaches, cheerleaders, fan_factor) VALUES ('${A}', 'Ospiti', 'Orc', 2, 0, 0, 2)`,
    `INSERT INTO players (id, team_id, name, role, value) VALUES ('ph1', '${H}', 'Blitzer', 'Blitzer', 85000)`,
    `INSERT INTO players (id, team_id, name, role, value) VALUES ('pa1', '${A}', 'Lineman', 'Lineman', 50000)`,
    `INSERT INTO matches (id, round, home_team_id, away_team_id, season_id, match_type, pregame_done, kicking_team_id)
       VALUES ('${MATCH}', 1, '${H}', '${A}', 's1', 'League', 1, '${A}')`,
    `INSERT INTO match_team_reports (match_id, team_id, fan_factor, inducements)
       VALUES ('${MATCH}', '${H}', 6, '[{"key":"extra_team_training","qty":1},{"key":"team_mascot","qty":1},{"key":"part_time_assistant_coaches","qty":2}]')`,
    `INSERT INTO match_team_reports (match_id, team_id, fan_factor, inducements)
       VALUES ('${MATCH}', '${A}', 3, '[{"key":"halfling_master_chef","qty":1},{"key":"bribes","qty":1}]')`,
  ], 'write');
}

export function closeTestDb(db: Client) {
  db.close();
  // Su Windows il file può restare bloccato un attimo dopo la chiusura: la cartella temporanea si può lasciare
  try { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* resta in %TEMP% */ }
}
