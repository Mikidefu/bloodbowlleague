// Unica definizione dei tipi di partita.
// I valori sono quelli già salvati nel database: non cambiarli senza migrare i dati.

export const MATCH_TYPES = {
  league: 'League',
  playoff: 'Playoff',
  friendly: 'Friendly',
  semifinal1: 'Semifinal 1 (1st vs 4th)',
  semifinal2: 'Semifinal 2 (2nd vs 3rd)',
  thirdPlace: '3rd Place Match',
  final: 'Grand Final (Blood Bowl!)',
} as const;

// "Regular Season" è il vecchio nome delle partite di campionato (default dello schema iniziale)
export const LEAGUE_MATCH_TYPES: string[] = [MATCH_TYPES.league, 'Regular Season'];
export const SEMIFINAL_TYPES: string[] = [MATCH_TYPES.semifinal1, MATCH_TYPES.semifinal2];
export const FINAL_TYPES: string[] = [MATCH_TYPES.thirdPlace, MATCH_TYPES.final];

// Frammento SQL "IN ('League', 'Regular Season')" da usare nelle query (valori costanti, nessun input utente)
export const sqlIn = (values: readonly string[]) => `(${values.map(v => `'${v.replace(/'/g, "''")}'`).join(', ')})`;

export const isLeagueMatch = (type: unknown) => LEAGUE_MATCH_TYPES.includes(String(type));
export const isSemifinal = (type: unknown) => SEMIFINAL_TYPES.includes(String(type));
export const isFinal = (type: unknown) => FINAL_TYPES.includes(String(type));

export const displayMatchType = (type: unknown) => (isLeagueMatch(type) ? MATCH_TYPES.league : String(type ?? ''));
