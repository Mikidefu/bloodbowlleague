// Finestra della sequenza post-partita di una squadra (p. 95). L'ordine del libro è:
//   Winnings -> Dedicated Fans -> Player Advancement -> Hiring, Firing e Temporarily Retiring
//   -> Expensive Mistakes -> Prepare for Next Fixture
// Winnings e fan li applica il referto; avanzamenti, ingaggi, licenziamenti, staff e Temporarily
// Retiring si fanno finché la squadra non tira gli Expensive Mistakes. Dopo, aspettano il referto
// della partita successiva.
//
//   draft  -> nessuna partita di lega con le regole applicate (squadra nuova o solo partite legacy):
//             la squadra si sistema liberamente, come al draft
//   open   -> almeno un post-partita con gli Expensive Mistakes ancora da tirare
//   closed -> tutti i post-partita conclusi

import db from '@/lib/db';

export type PostgamePhase = 'draft' | 'open' | 'closed';

export async function postgamePhase(teamId: string): Promise<{ phase: PostgamePhase; pendingMatchIds: string[] }> {
  const { rows } = await db.execute({
    sql: `SELECT m.id, r.mistake_result FROM match_team_reports r JOIN matches m ON m.id = r.match_id
          WHERE r.team_id = ? AND m.rules_applied = 1`,
    args: [teamId],
  });
  if (!rows.length) return { phase: 'draft', pendingMatchIds: [] };
  const pendingMatchIds = rows.filter(r => r.mistake_result === null || r.mistake_result === undefined).map(r => String(r.id));
  return { phase: pendingMatchIds.length ? 'open' : 'closed', pendingMatchIds };
}

export const POSTGAME_CLOSED_MESSAGE =
    'The post-game sequence of the last match is over: advancements, hiring, firing, staff and Temporarily Retiring wait for the next match (p. 95)';

// null se la squadra può cambiare rosa e staff, altrimenti il motivo (da restituire con 409)
export async function rosterChangesBlocked(teamId: string): Promise<string | null> {
  const { phase } = await postgamePhase(teamId);
  return phase === 'closed' ? POSTGAME_CLOSED_MESSAGE : null;
}
