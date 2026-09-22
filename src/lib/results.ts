// Esito di una partita giocata: decidono i TD. Nei playoff finiti in parità decide chi ha vinto ai rigori
// dopo i supplementari (penalty_winner_id, p. 83). Non esistono spareggi sulle Casualty.
// null = pareggio, oppure partita persa a tavolino da entrambe (outcome 'forfeit_both').
// Accetta sia righe grezze del database sia oggetti tipizzati con i campi della partita
type ScoredMatch = Record<string, unknown>;

export function matchWinner(match: ScoredMatch): { winner: string; loser: string } | null {
  if (match.outcome === 'forfeit_both') return null;
  const hs = Number(match.home_score);
  const as = Number(match.away_score);
  const home = String(match.home_team_id);
  const away = String(match.away_team_id);

  let winner: string | null = null;
  if (hs !== as) winner = hs > as ? home : away;
  else if (match.penalty_winner_id === home || match.penalty_winner_id === away) winner = String(match.penalty_winner_id);
  if (!winner) return null;
  return { winner, loser: winner === home ? away : home };
}
