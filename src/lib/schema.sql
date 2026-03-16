-- \src\lib\schema.sql
CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    race TEXT NOT NULL,
    logo_url TEXT,
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
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    skills TEXT, -- Stored as JSON string
    value INTEGER NOT NULL,
    ma INTEGER DEFAULT 6,
    st INTEGER DEFAULT 3,
    ag TEXT DEFAULT '3+',
    pa TEXT DEFAULT '4+',
    av TEXT DEFAULT '8+',
    spp INTEGER DEFAULT 0,
    status TEXT DEFAULT 'Active',
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
    match_type TEXT DEFAULT 'Regular Season',
    played_at DATETIME,
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
