// Unica definizione dei tipi di partita.
// I valori sono quelli già salvati nel database: non cambiarli senza migrare i dati.

export const MATCH_TYPES = {
  league: 'League',
  playoff: 'Playoff',
  friendly: 'Friendly',
  // Non classificata: si gioca come una partita di lega, ma alla fine resta solo il risultato
  // (niente classifica, SPP, infortuni, Treasury né fan). Vedi closeUnranked in src/lib/matchRules.ts.
  unranked: 'Unranked',
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
export const isFriendly = (type: unknown) => type === MATCH_TYPES.friendly;
export const isUnranked = (type: unknown) => type === MATCH_TYPES.unranked;
// Le partite di playoff si decidono con supplementari e rigori (p. 83); campionato, amichevoli e
// Non classificate possono finire in parità
export const isKnockout = (type: unknown) => !isFriendly(type) && !isLeagueMatch(type) && !isUnranked(type);

export const displayMatchType = (type: unknown, language: 'it' | 'en' = 'en') =>
  isUnranked(type) ? (language === 'it' ? 'Non classificata' : 'Unranked')
  : isLeagueMatch(type) ? MATCH_TYPES.league : String(type ?? '');
