import { createClient } from '@libsql/client';
import path from 'path';
import fs from 'fs';

// 1. Connessione al database Turso tramite le variabili d'ambiente
const db = createClient({
  url: process.env.TURSO_DATABASE_URL as string,
  authToken: process.env.TURSO_AUTH_TOKEN as string,
});

// 2. Inizializzazione dello schema (ora deve essere asincrona)
export const initDb = async () => {
  try {
    const schemaPath = path.join(process.cwd(), 'src/lib/schema.sql');

    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');

      // executeMultiple permette di eseguire un intero blocco di query SQL separate da punto e virgola
      await db.executeMultiple(schema);
      console.log('Database inizializzato con successo su Turso.');
    }
  } catch (e) {
    console.error("Errore durante l'inizializzazione del database su Turso:", e);
  }
};

// Eseguiamo l'inizializzazione in background
initDb();

export default db;