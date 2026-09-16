// Gli SPP disponibili NON si scrivono mai a mano: si derivano sempre da tre fonti.
//   spp = spp_base (SPP iniziali)
//       + SPP guadagnati in partita (player_stats.spp_earned)
//       - SPP spesi negli avanzamenti (player_advancements.spp_cost)
// La colonna players.spp è solo una copia calcolata, aggiornata con questo statement
// ogni volta che cambia una delle tre fonti.
export function recalcSppStatement(playerId: string) {
  return {
    sql: `
      UPDATE players
      SET spp = COALESCE(spp_base, 0)
              + (SELECT COALESCE(SUM(spp_earned), 0) FROM player_stats WHERE player_id = ?)
              - (SELECT COALESCE(SUM(spp_cost), 0) FROM player_advancements WHERE player_id = ?)
      WHERE id = ?
    `,
    args: [playerId, playerId, playerId],
  };
}
