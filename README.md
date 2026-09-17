# Blood Bowl League Manager

Web app per gestire una lega di Blood Bowl su più stagioni: squadre e roster, allenatori, calendario, referti partita, classifica, statistiche giocatori e allenatori, avanzamenti SPP e playoff (Final Four).

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Turso/libSQL · Vercel Blob (loghi) · deploy su Vercel.

## Avvio in locale

```bash
npm install
cp .env.example .env.local   # poi compila i valori
npm run dev
```

L'app gira su http://localhost:3000.

### Variabili d'ambiente

| Variabile | A cosa serve |
|---|---|
| `TURSO_DATABASE_URL` | URL del database Turso (`libsql://...`). Per test locali si può usare `file:percorso/league.db` |
| `TURSO_AUTH_TOKEN` | Token di accesso Turso |
| `BLOB_READ_WRITE_TOKEN` | Token Vercel Blob per il caricamento dei loghi |
| `ADMIN_PASSWORD` | Password dell'admin di lega. **Senza questa variabile ogni modifica è bloccata** |

Su Vercel vanno impostate in *Project Settings → Environment Variables*.

## Accesso admin

Chiunque può consultare squadre, calendario, classifica e statistiche. Per creare o modificare dati bisogna entrare da **ADMIN** nella barra di navigazione con la `ADMIN_PASSWORD`.

- `src/proxy.ts` rifiuta con 401 ogni chiamata API di scrittura (POST/PUT/DELETE) senza sessione admin valida.
- La sessione è un cookie firmato `httpOnly` che dura 30 giorni; cambiando la password tutte le sessioni decadono.
- L'interfaccia nasconde i comandi di modifica ai visitatori (`src/lib/AuthContext.tsx`), ma la protezione vera è il proxy.

## Database

Lo schema completo e commentato è in [`src/lib/schema.sql`](src/lib/schema.sql). Per un database nuovo:

```bash
turso db shell <nome-db> < src/lib/schema.sql
```

Le modifiche a un database esistente passano da script in `scripts/`, eseguibili più volte senza effetti doppi e con anteprima:

```bash
node --env-file=.env.local scripts/migrate-spp.mjs          # anteprima
node --env-file=.env.local scripts/migrate-spp.mjs --apply  # applica (salva un backup in backups/)
node --env-file=.env.local scripts/migrate-seasons.mjs --apply
```

### Stagioni e allenatori

- Esiste al massimo **una stagione attiva**; avviandone una nuova (pagina *Stagioni*) quella in corso viene chiusa e diventa di sola lettura.
- Le squadre partecipano alle stagioni tramite `season_teams`, che registra anche **l'allenatore di quella stagione**: una squadra può proseguire (con roster e SPP) cambiando allenatore, e un allenatore può guidare squadre diverse nel tempo.
- Partite, calendario, classifica, statistiche e playoff sono per stagione; le API accettano `?season=<id>` e senza parametro usano la stagione attiva.
- Le squadre nuove entrano sempre nella stagione attiva e richiedono un allenatore (esistente o nuovo; i nomi non si duplicano).
- La carriera degli allenatori (`src/lib/coaches.ts`) somma, stagione per stagione, piazzamento in campionato, risultati e piazzamento nei playoff.
- L'interfaccia ricorda nel browser la stagione consultata (`src/lib/SeasonContext.tsx`).

### Regole importanti

- **SPP:** `players.spp` è un valore calcolato e non va mai scritto a mano:
  `spp = spp_base + SPP guadagnati (player_stats) − SPP spesi (player_advancements)`.
  Usare sempre `recalcSppStatement` di [`src/lib/spp.ts`](src/lib/spp.ts).
- **Avanzamenti:** passano solo da `POST /api/players/[id]/advance`, che valida costi, skill ammesse e limiti delle caratteristiche ([`src/lib/advancement.ts`](src/lib/advancement.ts)) e registra la spesa nel registro.
- **Tipi di partita:** definiti in [`src/lib/matchTypes.ts`](src/lib/matchTypes.ts). In classifica contano solo le partite di campionato (`League`, e il vecchio nome `Regular Season`).
- **Classifica:** calcolata in un solo punto, [`src/lib/standings.ts`](src/lib/standings.ts): vittoria 3 punti, pareggio 1; spareggi per differenza TD e poi CAS.
- Le foreign key sono attive: per eliminare una squadra vanno prima eliminate le sue partite (lo fa già `DELETE /api/teams/[id]`).

## Struttura

```
src/
  app/            pagine (teams, schedule, standings, stats, skills, login) e route API in app/api
  components/     layout e navbar
  lib/            db, auth, regole di gioco (spp, advancement, standings, matchTypes), tipi, i18n
  proxy.ts        protezione delle API di scrittura
scripts/          migrazioni del database
```

## Comandi utili

```bash
npm run dev        # sviluppo
npm run build      # build di produzione
npm run lint       # ESLint
npm run typecheck  # controllo TypeScript
```
