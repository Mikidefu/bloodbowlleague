// Partita dal vivo: il registro eventi condiviso tra web (admin) e companion (un telefono per squadra).
// Qui solo tipi e costanti, niente DB: lo stesso file gira sul server, sul web e nella PWA.
//
// Ogni cosa che succede è un evento aggiunto in coda (match_events); lo stato del tabellone
// non si salva mai, si ricalcola con reduceLive(). Gli errori si correggono con un evento 'undo'.

export const TURNS_PER_HALF = 8;         // p. 34
export const EXTRA_TIME_HALF = 3;        // i supplementari si giocano "esattamente come un tempo normale" (p. 83)

// Dati della partita fotografati all'avvio del live: modificare la squadra dopo non cambia la partita in corso
export type LiveTeamSetup = {
  rerolls: number;              // Team Re-roll del roster + Extra Team Training (pp. 33, 145)
  mascot: boolean;              // Team Mascot: un Team Re-roll in più per tempo, con il D6 da 4+ (p. 144)
  master_chef: boolean;         // Halfling Master Chef: 3D6 a inizio tempo (p. 146)
  assistant_coaches: number;    // + Part-time Assistant Coaches (p. 144), per Brilliant Coaching
  cheerleaders: number;         // + Temp Agency Cheerleaders (p. 144), per Cheering Fans
  fan_factor: number;           // Fan Factor di partita (p. 44), per Pitch Invasion
  bribes: number;               // Bribes comprati come incentivo (p. 144)
};

// Eventi scritti da chi usa il tabellone (web o companion)
export type ClientEventType =
  | 'turn_started'        // p. 50: a inizio turno l'allenatore avanza il suo segnalino
  | 'reroll_used'         // payload.kind: team | drive | mascot
  | 'bribe_used'
  | 'rerolls_adjusted'    // correzione manuale (Leader, skill, errori): payload.delta, payload.reason
  | 'touchdown'           // chiude il drive (p. 80)
  | 'casualty' | 'completion' | 'interception' | 'ttm' | 'landing'
  | 'half_started'        // payload.half: 2, oppure 3 = supplementari (con payload.kicking_team_id)
  | 'undo';               // payload.event_id

// Eventi che scrive solo il server
export type ServerEventType =
  | 'match_started'       // payload: LiveStartPayload
  | 'kickoff_rolled'      // payload: KickoffResult
  | 'chef_rolled'         // payload: { dice, stolen }
  | 'match_ended';

export type LiveEventType = ClientEventType | ServerEventType;

export const STAT_EVENTS = ['touchdown', 'casualty', 'completion', 'interception', 'ttm', 'landing'] as const;
export type StatEvent = typeof STAT_EVENTS[number];
// Stesse colonne di player_stats: il referto si precompila senza conversioni
export const STAT_COLUMN: Record<StatEvent, 'touchdowns' | 'casualties' | 'completions' | 'interceptions' | 'ttm' | 'landings'> = {
  touchdown: 'touchdowns', casualty: 'casualties', completion: 'completions', interception: 'interceptions', ttm: 'ttm', landing: 'landings',
};

export const TEAM_EVENTS: readonly LiveEventType[] = ['turn_started', 'reroll_used', 'bribe_used', 'rerolls_adjusted', ...STAT_EVENTS];

export type RerollKind = 'team' | 'drive' | 'mascot';

export type LiveEvent = {
  id: string;
  seq: number;
  team_id: string | null;
  type: LiveEventType;
  payload: Record<string, unknown>;
  source: 'admin' | 'companion' | 'server';
  created_at?: string;
};

export type LiveStartPayload = {
  home_team_id: string;
  away_team_id: string;
  kicking_team_id: string;      // chi calcia il primo drive (roll-off del pre-partita, p. 46)
  knockout: boolean;            // playoff: supplementari possibili (p. 83)
  teams: Record<string, LiveTeamSetup>;
};

export type KickoffOutcome = {
  team_id: string;
  roll: number;                 // D6 tirato
  total: number;                // D6 + modificatore
  rerolled?: number;            // Team Mascot: il natural 1 di Cheering Fans ritirato (p. 144)
};

export type KickoffResult = {
  drive: number;
  kicking_team_id: string;
  dice: [number, number];
  total: number;
  name: string;
  outcomes?: KickoffOutcome[];  // tiri contrapposti (Cheering Fans, Brilliant Coaching, Dodgy Snack, Pitch Invasion)
  winners?: string[];           // chi ottiene l'effetto (anche entrambe, in caso di parità)
  d3?: number;                  // D3+3 giocatori (Solid Defence, Quick Snap, Charge!) o D3 giocatori (Pitch Invasion)
  weather_roll?: number;        // Changing Weather: nuovo 2D6 sulla tabella del Meteo
  turn_shift?: -1 | 1;          // Time-out: i segnalini turno arretrano o avanzano
};

export type LiveTeamState = {
  score: number;
  turn: number;                 // segnalino turno nel tempo in corso, 0 prima del primo turno
  rerolls: number;              // Team Re-roll rimasti in questo tempo
  drive_rerolls: number;        // Brilliant Coaching: persi a fine drive (p. 48)
  mascot: boolean;              // Team Re-roll del Team Mascot ancora disponibile in questo tempo
  bribes: number;               // incentivo + Get the Ref, meno quelli usati
  cheering_fans: boolean;       // assist offensivo in più al primo Block del prossimo turno
  stats: Record<string, Partial<Record<(typeof STAT_COLUMN)[StatEvent], number>>>;
  team_stats: Partial<Record<(typeof STAT_COLUMN)[StatEvent], number>>; // eventi senza giocatore (es. Casualty del pubblico)
};

export type LiveStatus = 'not_started' | 'awaiting_kickoff' | 'in_drive' | 'ended';

export type LiveState = {
  status: LiveStatus;
  half: number;                 // 1, 2, oppure 3 = supplementari
  drive: number;                // quanti kick-off validi finora
  kicking_team_id: string | null;         // chi calcia il prossimo drive (o quello in corso)
  first_half_receiver_id: string | null;  // calcia all'inizio del secondo tempo (p. 50)
  // Alternanza dei turni (p. 50): dopo il kick-off gioca chi riceve, poi un turno a testa
  active_team_id: string | null;          // squadra il cui turno è in corso nel drive; null prima del primo turno del drive
  next_turn_team_id: string | null;       // chi deve iniziare il prossimo turno (null se non si gioca: partita finita/non avviata)
  turns_done: boolean;                    // chi dovrebbe giocare dopo ha già fatto i suoi 8 turni: il tempo è finito (o finisce col turno in corso)
  weather_roll: number | null;            // meteo cambiato da Changing Weather, null = quello del pre-partita
  knockout: boolean;
  home_team_id: string | null;
  away_team_id: string | null;
  teams: Record<string, LiveTeamState>;
  last_kickoff: (KickoffResult & { event_id: string }) | null;
  seq: number;                  // ultimo seq visto
  // Cambia a ogni evento di fase (kick-off, touchdown, tempo, turno) e a ogni undo:
  // entra nelle chiavi anti-doppione, così due tap o due dispositivi non producono lo stesso evento due volte
  phase_seq: number;
  voided: string[];             // eventi annullati
  setup: LiveStartPayload | null;
};
