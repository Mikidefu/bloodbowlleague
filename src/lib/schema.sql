-- src/lib/schema.sql
-- Schema completo del database (Turso / libSQL), allineato alla produzione.
-- Per un database nuovo: turso db shell <nome-db> < src/lib/schema.sql
-- Per un database esistente usare gli script in scripts/ (es. migrate-spp.mjs).
-- Le foreign key sono attive (PRAGMA foreign_keys = 1).

-- Stagioni: al massimo una attiva, le altre sono in sola lettura.
-- status: active (in corso) | completed (chiusa); closed_reason dice come è stata chiusa.
-- (Colonna separata perché cambiare il CHECK di status richiederebbe di ricreare la tabella.)
CREATE TABLE IF NOT EXISTS seasons (
    id TEXT PRIMARY KEY,
    number INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    closed_reason TEXT CHECK (closed_reason IN ('completed', 'paused', 'cancelled'))  -- NULL se in corso
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_seasons_single_active ON seasons(status) WHERE status = 'active';

-- Allenatori: persistono tra le stagioni e possono cambiare squadra
CREATE TABLE IF NOT EXISTS coaches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_coaches_name ON coaches(name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    race TEXT NOT NULL,
    logo_url TEXT,                          -- URL su Vercel Blob o esterno
    primary_color TEXT,
    secondary_color TEXT,
    rerolls INTEGER DEFAULT 0,
    reroll_cost INTEGER DEFAULT 50000,
    cheerleaders INTEGER DEFAULT 0,
    assistant_coaches INTEGER DEFAULT 0,
    fan_factor INTEGER DEFAULT 1,           -- Dedicated Fans (1-7, p. 91). Il Fan Factor di partita sta in match_team_reports
    apothecary BOOLEAN DEFAULT 0,
    treasury INTEGER DEFAULT 0,
    bank INTEGER DEFAULT 0,
    roster TEXT,                            -- chiave del Team Roster (src/lib/rosters.ts); NULL = squadra gestita a mano
    team_league TEXT,                       -- League scelta tra quelle del roster (p. 159)
    favoured_of TEXT,                       -- allineamento Favoured of, se il roster lo prevede
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    jersey_number INTEGER,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    skills TEXT,                            -- legacy, non più usato: le skill stanno in skills_players
    primary_skills TEXT,                    -- categorie primarie, es. "G, A"
    secondary_skills TEXT,                  -- categorie secondarie, es. "S, P"
    value INTEGER NOT NULL,
    ma INTEGER DEFAULT 6,
    st INTEGER DEFAULT 3,
    ag TEXT DEFAULT '3+',
    pa TEXT DEFAULT '4+',
    av TEXT DEFAULT '8+',
    -- SPP disponibili: valore calcolato, mai scritto a mano (vedi src/lib/spp.ts)
    --   spp = spp_base + SUM(player_stats.spp_earned) - SUM(player_advancements.spp_cost)
    spp INTEGER DEFAULT 0,
    spp_base INTEGER DEFAULT 0,             -- SPP iniziali, non guadagnati in partita
    advancements INTEGER DEFAULT 0,
    status TEXT DEFAULT 'Active',
    mng BOOLEAN DEFAULT FALSE,              -- salta la prossima partita
    dead BOOLEAN DEFAULT FALSE,
    position_key TEXT,                      -- posizione del roster
    hiring_fee INTEGER,                     -- Hiring Fee pagata (Low Cost Linemen, Journeymen)
    niggling_injuries INTEGER DEFAULT 0,
    temp_retired BOOLEAN DEFAULT 0,         -- Temporarily Retiring (p. 99): resta in lista ma fuori dal CTV
    left_team BOOLEAN DEFAULT 0,            -- licenziato o andato via: resta per lo storico, fuori dalla lista
    journeyman BOOLEAN DEFAULT 0,           -- Journeyman non ancora ingaggiato
    journeyman_match_id TEXT,               -- partita per cui è stato preso
    mng_match_id TEXT,                      -- partita in cui ha subito l'infortunio che gli fa saltare la prossima
    is_captain BOOLEAN DEFAULT 0,           -- Team Captain (p. 155)
    hatreds TEXT,                           -- keyword di Hatred (X) ottenute con Getting Even, separate da virgola
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    round INTEGER NOT NULL,
    home_team_id TEXT NOT NULL,
    away_team_id TEXT NOT NULL,
    home_score INTEGER DEFAULT 0,
    away_score INTEGER DEFAULT 0,
    home_casualties INTEGER DEFAULT 0,
    away_casualties INTEGER DEFAULT 0,
    is_played BOOLEAN DEFAULT 0,
    -- Valori ammessi in src/lib/matchTypes.ts ('Regular Season' = vecchio nome di 'League')
    match_type TEXT DEFAULT 'League',
    match_date TEXT,                        -- data/ora pianificata (datetime-local)
    played_at DATETIME,
    season_id TEXT,                         -- stagione di appartenenza (partite e numeri di giornata sono per stagione)
    outcome TEXT DEFAULT 'played',          -- played | conceded | conceded_no_penalty | forfeit_both | forfeit_commitments
    conceded_team_id TEXT,                  -- squadra che ha concesso
    penalty_winner_id TEXT,                 -- playoff finiti in parità dopo i supplementari: vincitrice ai rigori (p. 83)
    rules_applied BOOLEAN DEFAULT 0,        -- 1 = post-partita applicato (Treasury, fan, infortuni); 0 = partita legacy
    pregame_done BOOLEAN DEFAULT 0,
    weather_roll INTEGER,                   -- 2D6 del Meteo tirato nel pre-partita (p. 46)
    kicking_team_id TEXT,                   -- squadra che calcia il primo drive, dopo il roll-off (p. 46)
    -- Nessun CASCADE: eliminare una squadra richiede prima di eliminarne le partite (vedi DELETE /api/teams/[id])
    FOREIGN KEY(home_team_id) REFERENCES teams(id),
    FOREIGN KEY(away_team_id) REFERENCES teams(id),
    FOREIGN KEY(season_id) REFERENCES seasons(id)
);

CREATE INDEX IF NOT EXISTS idx_matches_season ON matches(season_id);

-- Partecipazione: quali squadre giocano una stagione e con quale allenatore
CREATE TABLE IF NOT EXISTS season_teams (
    season_id TEXT NOT NULL,
    team_id TEXT NOT NULL,
    coach_id TEXT,
    PRIMARY KEY (season_id, team_id),
    FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_season_teams_coach ON season_teams(coach_id);

CREATE TABLE IF NOT EXISTS player_stats (
    id TEXT PRIMARY KEY,
    match_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    touchdowns INTEGER DEFAULT 0,
    casualties INTEGER DEFAULT 0,
    interceptions INTEGER DEFAULT 0,
    completions INTEGER DEFAULT 0,
    mvp INTEGER DEFAULT 0,
    spp_earned INTEGER DEFAULT 0,
    ttm INTEGER DEFAULT 0,                  -- Throw Team-mate riusciti (1 SPP al lanciatore)
    landings INTEGER DEFAULT 0,             -- atterraggi riusciti dopo un lancio (1 SPP)
    FOREIGN KEY(match_id) REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    description_it TEXT,
    type TEXT NOT NULL,                     -- General, Agility, Strength, Passing, Mutation, ...
    level TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS skills_players (
    player_id TEXT NOT NULL,
    skill_id TEXT NOT NULL,
    PRIMARY KEY (player_id, skill_id),
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
);

-- Registro di ogni spesa di SPP (una riga per avanzamento)
CREATE TABLE IF NOT EXISTS player_advancements (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    kind TEXT NOT NULL,                     -- randomPrimary | choosePrimary | chooseSecondary | stat | legacy
    skill_id TEXT,
    stat TEXT,
    spp_cost INTEGER NOT NULL CHECK (spp_cost >= 0),
    value_increase INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_player_advancements_player ON player_advancements(player_id);

-- Infortuni subiti in una partita (Casualty Table, p. 67), per poterli annullare correggendo il referto
CREATE TABLE IF NOT EXISTS player_injuries (
    id TEXT PRIMARY KEY,
    match_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    result TEXT NOT NULL CHECK (result IN ('BH', 'SH', 'SI', 'LI', 'DEAD')),
    stat TEXT CHECK (stat IN ('ma', 'st', 'ag', 'pa', 'av')),  -- caratteristica ridotta dal Lasting Injury
    stat_applied BOOLEAN DEFAULT 0,         -- 0 se la riduzione non era applicabile (già al minimo)
    hatred TEXT,                            -- keyword di Hatred (X) ottenuta con Getting Even
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_player_injuries_match ON player_injuries(match_id);

-- Pre-partita e post-partita di ciascuna squadra in una partita (pp. 94-100)
CREATE TABLE IF NOT EXISTS match_team_reports (
    match_id TEXT NOT NULL,
    team_id TEXT NOT NULL,
    fair_weather INTEGER,                   -- D3 Fair-weather Fans
    fan_factor INTEGER,                     -- Dedicated Fans + D3
    ctv INTEGER,                            -- CTV al pre-partita, Journeymen inclusi
    petty_cash INTEGER DEFAULT 0,
    treasury_spent INTEGER DEFAULT 0,       -- Treasury spesa in incentivi
    inducements TEXT,                       -- JSON delle scelte (vedi InducementChoice)
    journeymen INTEGER DEFAULT 0,
    stalling BOOLEAN DEFAULT 0,
    winnings INTEGER DEFAULT 0,
    df_roll INTEGER,                        -- D6 dei Dedicated Fans (D3 per chi concede)
    df_change INTEGER DEFAULT 0,
    quit_player_ids TEXT,                   -- JSON: giocatori andati via dopo una concessione
    recovered_player_ids TEXT,              -- JSON: giocatori che hanno saltato questa partita e sono tornati disponibili
    released_player_ids TEXT,               -- JSON: Journeymen non ingaggiati, persi al termine del post-partita
    mistake_result TEXT,                    -- averted | minor | major | catastrophe | skipped; NULL = da tirare
    mistake_roll INTEGER,
    mistake_extra INTEGER,                  -- D3 (Minor) o 2D6 (Catastrophe)
    mistake_treasury_before INTEGER,
    mistake_loss INTEGER DEFAULT 0,
    PRIMARY KEY (match_id, team_id),
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- Partita dal vivo (src/lib/live): collegamento dei telefoni companion, uno per squadra
CREATE TABLE IF NOT EXISTS match_live (
    match_id TEXT PRIMARY KEY,
    join_code TEXT NOT NULL UNIQUE,         -- 6 caratteri, nel QR o da digitare
    home_nonce TEXT,                        -- cambia a ogni abbinamento: scollegando, il token del vecchio telefono non vale più
    away_nonce TEXT,
    home_device TEXT,                       -- UUID del telefono abbinato, per farlo rientrare se perde il token
    away_device TEXT,
    status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'ended')),
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);

-- Registro eventi della partita dal vivo: solo aggiunte, gli errori si annullano con un evento 'undo'.
-- Lo stato del tabellone (turni, reroll, punteggio) si ricalcola dagli eventi (src/lib/live/reduce.ts).
CREATE TABLE IF NOT EXISTS match_events (
    id TEXT PRIMARY KEY,                    -- UUID scelto da chi crea l'evento: rimandarlo non lo duplica
    match_id TEXT NOT NULL,
    seq INTEGER NOT NULL,                   -- ordine nella partita, assegnato dal server
    team_id TEXT,
    type TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',     -- JSON
    source TEXT NOT NULL CHECK (source IN ('admin', 'companion', 'server')),
    dedupe_key TEXT,                        -- stessa azione dallo stesso stato (doppio tap, web e telefono insieme): una sola
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (match_id, seq),
    UNIQUE (match_id, dedupe_key),
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);

-- Notifiche push della companion (app chiusa): un abbonamento per telefono, legato alla squadra che segue
CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint TEXT PRIMARY KEY,              -- indirizzo del servizio push del browser (unico per telefono)
    match_id TEXT NOT NULL,
    team_id TEXT NOT NULL,
    p256dh TEXT NOT NULL,                   -- chiavi per cifrare il messaggio (Web Push, RFC 8291)
    auth TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'it',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_match ON push_subscriptions(match_id);
