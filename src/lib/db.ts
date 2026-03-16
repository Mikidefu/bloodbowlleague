import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// This path works in both dev (from project root) and during build/runtime
const dbDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dbDir, 'bloodbowl.db');

// Ensure db directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Connect to SQLite DB
const db = new Database(dbPath, { verbose: process.env.NODE_ENV === 'development' ? console.log : undefined });

// Initialize schema on first run
export const initDb = () => {
  const schemaPath = path.join(process.cwd(), 'src/lib/schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);
    console.log('Database initialized successfully.');
  }
};

// Automatically initialize schema when this module is imported
try {
  initDb();
} catch (e) {
  console.error("Failed to initialize database", e);
}

export default db;
