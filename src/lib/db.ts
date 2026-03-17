import { createClient } from '@libsql/client';

// Connessione al database Turso tramite le variabili d'ambiente
const db = createClient({
  url: process.env.TURSO_DATABASE_URL as string,
  authToken: process.env.TURSO_AUTH_TOKEN as string,
});

export default db;