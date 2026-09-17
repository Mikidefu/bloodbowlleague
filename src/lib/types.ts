// Tipi condivisi tra API e pagine: rispecchiano le risposte JSON delle route in src/app/api.
// SQLite restituisce i booleani come 0/1, per questo alcuni campi accettano entrambi.

export type SqlBoolean = boolean | 0 | 1;

export type Skill = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  description_it?: string | null;
  level: string | null;
};

export type Team = {
  id: string;
  name: string;
  race: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  rerolls: number;
  reroll_cost: number;
  cheerleaders: number;
  assistant_coaches: number;
  fan_factor: number;
  apothecary: SqlBoolean;
  treasury: number;
  bank: number;
};

export type Player = {
  id: string;
  team_id: string;
  jersey_number: number | null;
  name: string;
  role: string;
  value: number;
  primary_skills: string | null;
  secondary_skills: string | null;
  ma: number;
  st: number;
  ag: string;
  pa: string;
  av: string;
  spp: number;
  advancements: number;
  status: string;
  mng: SqlBoolean;
  dead: SqlBoolean;
  skills: Skill[];
};

// GET /api/teams/[id]
export type TeamSeasonEntry = {
  season_id: string;
  season_number: number;
  season_name: string;
  season_status: SeasonStatus;
  coach_id: string | null;
  coach_name: string | null;
};

export type TeamWithPlayers = Team & {
  players: Player[];
  in_active_season: boolean;
  coach_id: string | null;       // allenatore nella stagione attiva (o nell'ultima giocata)
  coach_name: string | null;
  season_history: TeamSeasonEntry[];
};

// GET /api/schedule (una riga per partita, con i dati essenziali delle squadre)
export type Match = {
  id: string;
  round: number;
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
  home_casualties: number;
  away_casualties: number;
  is_played: SqlBoolean;
  match_type: string;
  match_date: string | null;
  home_name: string;
  home_logo: string | null;
  home_color: string | null;
  away_name: string;
  away_logo: string | null;
  away_color: string | null;
};

export type MatchPlayer = Pick<Player, 'id' | 'jersey_number' | 'name' | 'role' | 'status' | 'team_id' | 'mng' | 'dead'>;

export type PlayerStatsRow = {
  id: string;
  match_id: string;
  player_id: string;
  touchdowns: number;
  casualties: number;
  interceptions: number;
  completions: number;
  mvp: number;
  spp_earned: number;
};

// GET /api/schedule/[id]
export type MatchDetails = Match & {
  season_name: string | null;
  season_status: SeasonStatus | null;
  homePlayers: MatchPlayer[];
  awayPlayers: MatchPlayer[];
  stats: PlayerStatsRow[];
};

// Riga delle classifiche giocatori in GET /api/stats
export type PlayerLeader = {
  id: string;
  name: string;
  team_name: string;
  primary_color: string | null;
  total_td?: number;
  total_cas?: number;
  total_mvp?: number;
  total_spp?: number;
};

// GET /api/seasons
export type SeasonStatus = 'active' | 'completed' | 'paused' | 'cancelled';

export type SeasonSummary = {
  id: string;
  number: number;
  name: string;
  status: SeasonStatus;
  started_at: string | null;
  ended_at: string | null;
  teams_count: number;
  matches_total: number;
  matches_played: number;
  champion: { team_id: string; team_name: string; coach_name: string | null } | null;
};

export type Coach = { id: string; name: string };

// GET /api/teams?scope=all
export type TeamOverview = Team & {
  last_coach_id: string | null;
  last_coach_name: string | null;
  last_season_name: string | null;
  in_active_season: boolean;
};

export const isTrue =(value: SqlBoolean | null | undefined) => value === true || value === 1;
