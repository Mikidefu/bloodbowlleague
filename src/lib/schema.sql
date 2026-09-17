-- src/lib/schema.sql
-- Schema completo del database (Turso / libSQL), allineato alla produzione.
-- Per un database nuovo: turso db shell <nome-db> < src/lib/schema.sql
-- Per un database esistente usare gli script in scripts/ (es. migrate-spp.mjs).
-- Le foreign key sono attive (PRAGMA foreign_keys = 1).

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
    fan_factor INTEGER DEFAULT 0,
    apothecary BOOLEAN DEFAULT 0,
    treasury INTEGER DEFAULT 0,
    bank INTEGER DEFAULT 0,
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
    -- Nessun CASCADE: eliminare una squadra richiede prima di eliminarne le partite (vedi DELETE /api/teams/[id])
    FOREIGN KEY(home_team_id) REFERENCES teams(id),
    FOREIGN KEY(away_team_id) REFERENCES teams(id)
);

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
