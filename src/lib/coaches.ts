import crypto from 'crypto';
import db from '@/lib/db';
import { computePlayoffFinishes, computeStandings, type PlayoffFinish, type TeamStanding } from '@/lib/standings';
import { countsInCareer, parseSeasonStatus, seasonStatusSql, type SeasonStatus } from '@/lib/seasons';

export type CoachSeasonRecord = {
  season_id: string;
  season_number: number;
  season_name: string;
  season_status: SeasonStatus;
  counts_in_career: boolean;       // false per le stagioni annullate (mostrate ma non sommate)
  team_id: string;
  team_name: string;
  team_race: string;
  team_logo: string | null;
  team_color: string | null;
  position: number | null;        // posizione in classifica di campionato
  teams_in_season: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  td_for: number;
  td_against: number;
  cas_for: number;
  cas_against: number;
  playoff: PlayoffFinish | null;
};

export type CoachTotals = {
  seasons: number;
  teams: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  td_for: number;
  td_against: number;
  cas_for: number;
  cas_against: number;
  titles: number;
  finals: number;
  playoffs: number;
  win_rate: number;               // % vittorie sulle partite di campionato giocate
};

export type CoachCareer = {
  id: string;
  name: string;
  totals: CoachTotals;
  seasons: CoachSeasonRecord[];
};

const emptyTotals = (): CoachTotals => ({
  seasons: 0, teams: 0, played: 0, wins: 0, draws: 0, losses: 0, points: 0,
  td_for: 0, td_against: 0, cas_for: 0, cas_against: 0, titles: 0, finals: 0, playoffs: 0, win_rate: 0,
});

function sumTotals(allRecords: CoachSeasonRecord[]): CoachTotals {
  const totals = emptyTotals();
  const records = allRecords.filter(r => r.counts_in_career);
  totals.seasons = new Set(records.map(r => r.season_id)).size;
  totals.teams = new Set(records.map(r => r.team_id)).size;
  for (const r of records) {
    totals.played += r.played;
    totals.wins += r.wins;
    totals.draws += r.draws;
    totals.losses += r.losses;
    totals.points += r.points;
    totals.td_for += r.td_for;
    totals.td_against += r.td_against;
    totals.cas_for += r.cas_for;
    totals.cas_against += r.cas_against;
    if (r.playoff) totals.playoffs += 1;
    if (r.playoff === 'champion' || r.playoff === 'runner_up') totals.finals += 1;
    if (r.playoff === 'champion') totals.titles += 1;
  }
  totals.win_rate = totals.played ? Math.round((totals.wins / totals.played) * 100) : 0;
  return totals;
}

// Carriera di tutti gli allenatori (o di uno solo): una riga per ogni stagione/squadra allenata.
// Classifiche e playoff vengono calcolati una volta per stagione e riusati.
export async function computeCoachCareers(coachId?: string): Promise<CoachCareer[]> {
  const [{ rows: coaches }, { rows: enrollments }] = await Promise.all([
    db.execute({
      sql: `SELECT id, name FROM coaches ${coachId ? 'WHERE id = ?' : ''} ORDER BY name COLLATE NOCASE`,
      args: coachId ? [coachId] : [],
    }),
    db.execute({
      sql: `
        SELECT st.coach_id, st.season_id, s.number AS season_number, s.name AS season_name, ${seasonStatusSql('s')} AS season_status,
               t.id AS team_id, t.name AS team_name, t.race AS team_race, t.logo_url AS team_logo, t.primary_color AS team_color
        FROM season_teams st
        JOIN seasons s ON s.id = st.season_id
        JOIN teams t ON t.id = st.team_id
        WHERE st.coach_id IS NOT NULL ${coachId ? 'AND st.coach_id = ?' : ''}
        ORDER BY s.number DESC, t.name
      `,
      args: coachId ? [coachId] : [],
    }),
  ]);

  const seasonIds = [...new Set(enrollments.map(e => String(e.season_id)))];
  const standingsBySeason = new Map<string, TeamStanding[]>();
  const finishesBySeason = new Map<string, Map<string, PlayoffFinish>>();
  await Promise.all(seasonIds.map(async id => {
    const [standings, finishes] = await Promise.all([computeStandings(id), computePlayoffFinishes(id)]);
    standingsBySeason.set(id, standings);
    finishesBySeason.set(id, finishes);
  }));

  return coaches.map(coach => {
    const records: CoachSeasonRecord[] = enrollments
        .filter(e => e.coach_id === coach.id)
        .map(e => {
          const seasonId = String(e.season_id);
          const standings = standingsBySeason.get(seasonId) ?? [];
          const index = standings.findIndex(s => s.id === e.team_id);
          const row = standings[index];
          return {
            season_id: seasonId,
            season_number: Number(e.season_number),
            season_name: String(e.season_name),
            season_status: parseSeasonStatus(e.season_status),
            counts_in_career: countsInCareer(parseSeasonStatus(e.season_status)),
            team_id: String(e.team_id),
            team_name: String(e.team_name),
            team_race: String(e.team_race),
            team_logo: (e.team_logo as string) ?? null,
            team_color: (e.team_color as string) ?? null,
            position: row && row.played > 0 ? index + 1 : null,
            teams_in_season: standings.length,
            played: row?.played ?? 0,
            wins: row?.wins ?? 0,
            draws: row?.draws ?? 0,
            losses: row?.losses ?? 0,
            points: row?.points ?? 0,
            td_for: row?.td_for ?? 0,
            td_against: row?.td_against ?? 0,
            cas_for: row?.cas_for ?? 0,
            cas_against: row?.cas_against ?? 0,
            playoff: finishesBySeason.get(seasonId)?.get(String(e.team_id)) ?? null,
          };
        });

    return { id: String(coach.id), name: String(coach.name), totals: sumTotals(records), seasons: records };
  });
}

export class CoachInputError extends Error {}

// Allenatore scelto in un form: coach_id esistente oppure new_coach_name.
// Un nome già presente (senza distinzione maiuscole/minuscole) riusa l'allenatore esistente invece di duplicarlo.
// Restituisce l'id e, se serve crearlo, lo statement da includere nella transazione.
export async function resolveCoachInput(input: { coach_id?: unknown; new_coach_name?: unknown }) {
  const newName = typeof input.new_coach_name === 'string' ? input.new_coach_name.trim().replace(/\s+/g, ' ') : '';
  if (newName) {
    if (newName.length > 60) throw new CoachInputError('Coach name is too long (max 60 characters)');
    const { rows } = await db.execute({ sql: 'SELECT id FROM coaches WHERE name = ? COLLATE NOCASE', args: [newName] });
    if (rows[0]) return { coachId: String(rows[0].id), statement: null };
    const coachId = crypto.randomUUID();
    return { coachId, statement: { sql: 'INSERT INTO coaches (id, name) VALUES (?, ?)', args: [coachId, newName] } };
  }

  if (typeof input.coach_id === 'string' && input.coach_id) {
    const { rows } = await db.execute({ sql: 'SELECT id FROM coaches WHERE id = ?', args: [input.coach_id] });
    if (!rows[0]) throw new CoachInputError('Coach not found');
    return { coachId: input.coach_id, statement: null };
  }

  return { coachId: null, statement: null };
}
