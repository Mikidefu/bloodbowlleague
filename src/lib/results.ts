// Esito di una partita giocata: decidono i TD, in parità le casualties.
// null = parità completa (TD e CAS uguali).
// Accetta sia righe grezze del database sia oggetti tipizzati con i campi della partita
type ScoredMatch = Record<string, unknown>;

export function matchWinner(match: ScoredMatch): { winner: string; loser: string } | null {
  const hs = Number(match.home_score);
  const as = Number(match.away_score);
  const hc = Number(match.home_casualties);
  const ac = Number(match.away_casualties);

  const homeWins = hs > as || (hs === as && hc > ac);
  const awayWins = as > hs || (hs === as && ac > hc);
  if (!homeWins && !awayWins) return null;

  const home = String(match.home_team_id);
  const away = String(match.away_team_id);
  return homeWins ? { winner: home, loser: away } : { winner: away, loser: home };
}
