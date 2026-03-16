import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'bloodbowl.db');
const db = new Database(dbPath, { verbose: console.log });

console.log('Migrating database to add Treasury and Bank...');

try {
  // Check if columns already exist to make script idempotent
  const tableInfo = db.prepare('PRAGMA table_info(teams)').all();
  const hasTreasury = tableInfo.some(col => col.name === 'treasury');
  const hasBank = tableInfo.some(col => col.name === 'bank');

  if (!hasTreasury) {
    db.prepare('ALTER TABLE teams ADD COLUMN treasury INTEGER DEFAULT 0').run();
    console.log('Added treasury column to teams.');
  } else {
    console.log('Treasury column already exists.');
  }

  if (!hasBank) {
    db.prepare('ALTER TABLE teams ADD COLUMN bank INTEGER DEFAULT 0').run();
    console.log('Added bank column to teams.');
  } else {
    console.log('Bank column already exists.');
  }

  console.log('Migration completed successfully.');
} catch (error) {
  console.error('Migration failed:', error);
}
