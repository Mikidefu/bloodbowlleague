// Dal tabellone dal vivo ai campi del referto: punteggio, Casualty e statistiche per giocatore.
// Funzione pura. Il referto resta l'unico punto che applica le regole (SPP, infortuni, incassi):
// qui si preparano solo i numeri da controllare. Infortuni e MVP li sceglie sempre l'admin.

import { STAT_COLUMN, type LiveState, type StatEvent } from './types';

export type ReportStatField = 'td' | 'cas' | 'int' | 'comp' | 'ttm' | 'landing';
type Column = (typeof STAT_COLUMN)[StatEvent];

// Colonne di player_stats (e degli eventi live) -> campi del referto
const FIELD: Record<Column, ReportStatField> = {
  touchdowns: 'td', casualties: 'cas', interceptions: 'int', completions: 'comp', ttm: 'ttm', landings: 'landing',
};
export const REPORT_STAT_FIELDS: ReportStatField[] = ['td', 'cas', 'int', 'comp', 'ttm', 'landing'];

export type ReportPlayer = { player_id: string; team_id: string; unavailable: string | null };

export type LivePrefill = {
  scores: Record<string, number>;
  casualties: Record<string, number>;                                   // dei giocatori + quelle senza giocatore
  players: Record<string, Record<ReportStatField, number>>;
  withoutPlayer: Record<string, Partial<Record<ReportStatField, number>>>;  // es. TD di uno Star Player: nel punteggio, niente SPP
  skipped: { player_id: string; team_id: string; stats: Partial<Record<ReportStatField, number>> }[];  // giocatori che nel referto non ci sono
  events: number;                                                       // quante statistiche in tutto
};

const toFields = (stats: Partial<Record<Column, number>>) => {
  const out: Partial<Record<ReportStatField, number>> = {};
  for (const [column, n] of Object.entries(stats) as [Column, number][]) if (n && FIELD[column]) out[FIELD[column]] = n;
  return out;
};

export function livePrefill(state: LiveState | null | undefined, reportPlayers: ReportPlayer[]): LivePrefill | null {
  if (!state?.setup) return null;
  const eligible = new Map(reportPlayers.filter(p => !p.unavailable).map(p => [p.player_id, p.team_id]));
  const prefill: LivePrefill = { scores: {}, casualties: {}, players: {}, withoutPlayer: {}, skipped: [], events: 0 };
  let anything = false;

  for (const [teamId, team] of Object.entries(state.teams)) {
    prefill.scores[teamId] = team.score;
    if (team.score) anything = true;
    let cas = 0;
    for (const [playerId, stats] of Object.entries(team.stats)) {
      const fields = toFields(stats);
      const count = Object.values(fields).reduce((a, b) => a + (b ?? 0), 0);
      if (!count) continue;
      anything = true;
      prefill.events += count;
      if (eligible.get(playerId) !== teamId) { prefill.skipped.push({ player_id: playerId, team_id: teamId, stats: fields }); continue; }
      prefill.players[playerId] = { td: 0, cas: 0, int: 0, comp: 0, ttm: 0, landing: 0, ...fields };
      cas += fields.cas ?? 0;
    }
    const loose = toFields(team.team_stats);
    if (Object.keys(loose).length) {
      anything = true;
      prefill.withoutPlayer[teamId] = loose;
      prefill.events += Object.values(loose).reduce((a, b) => a + (b ?? 0), 0);
      cas += loose.cas ?? 0;
    }
    prefill.casualties[teamId] = cas;
  }
  return anything ? prefill : null;
}
