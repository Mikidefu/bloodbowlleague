import db from '@/lib/db';
import { FINAL_TYPES, LEAGUE_MATCH_TYPES, MATCH_TYPES, SEMIFINAL_TYPES, sqlIn } from '@/lib/matchTypes';
import { matchWinner } from '@/lib/results';

export type TeamStanding = {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  coach_id: string | null;
  coach_name: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  td_for: number;
  td_against: number;
  cas_for: number;
  cas_against: number;
  points: number;
  td_diff: number;
  cas_diff: number;
};

// Classifica di campionato di una stagione: squadre iscritte alla stagione e sole partite di lega giocate
// (niente amichevoli né playoff). Punti: vittoria 3, pareggio 1. Spareggi: differenza TD, poi differenza CAS.
export async function computeStandings(seasonId: string): Promise<TeamStanding[]> {
  const { rows } = await db.execute({
    sql: `
      SELECT
        t.id, t.name, t.logo_url, t.primary_color, t.secondary_color,
        st.coach_id, c.name AS coach_name,
        COUNT(m.id) AS played,
        SUM(CASE WHEN m.home_team_id = t.id AND m.home_score > m.away_score THEN 1
                 WHEN m.away_team_id = t.id AND m.away_score > m.home_score THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN m.id IS NOT NULL AND m.home_score = m.away_score THEN 1 ELSE 0 END) AS draws,
        SUM(CASE WHEN m.home_team_id = t.id AND m.home_score < m.away_score THEN 1
                 WHEN m.away_team_id = t.id AND m.away_score < m.home_score THEN 1 ELSE 0 END) AS losses,
        SUM(CASE WHEN m.home_team_id = t.id THEN m.home_score ELSE m.away_score END) AS td_for,
        SUM(CASE WHEN m.home_team_id = t.id THEN m.away_score ELSE m.home_score END) AS td_against,
        SUM(CASE WHEN m.home_team_id = t.id THEN m.home_casualties ELSE m.away_casualties END) AS cas_for,
        SUM(CASE WHEN m.home_team_id = t.id THEN m.away_casualties ELSE m.home_casualties END) AS cas_against
      FROM season_teams st
      JOIN teams t ON t.id = st.team_id
      LEFT JOIN coaches c ON c.id = st.coach_id
      LEFT JOIN matches m
        ON (t.id = m.home_team_id OR t.id = m.away_team_id)
       AND m.season_id = st.season_id
       AND m.is_played = 1
       AND m.match_type IN ${sqlIn(LEAGUE_MATCH_TYPES)}
      WHERE st.season_id = ?
      GROUP BY t.id
    `,
    args: [seasonId],
  });

  return rows
      .map(row => {
        const n = (key: string) => Number(row[key] || 0);
        const wins = n('wins');
        const draws = n('draws');
        return {
          id: String(row.id),
          name: String(row.name),
          logo_url: row.logo_url as string | null,
          primary_color: row.primary_color as string | null,
          secondary_color: row.secondary_color as string | null,
          coach_id: (row.coach_id as string) ?? null,
          coach_name: (row.coach_name as string) ?? null,
          played: n('played'),
          wins,
          draws,
          losses: n('losses'),
          td_for: n('td_for'),
          td_against: n('td_against'),
          cas_for: n('cas_for'),
          cas_against: n('cas_against'),
          points: wins * 3 + draws,
          td_diff: n('td_for') - n('td_against'),
          cas_diff: n('cas_for') - n('cas_against'),
        };
      })
      .sort((a, b) => b.points - a.points || b.td_diff - a.td_diff || b.cas_diff - a.cas_diff || a.name.localeCompare(b.name));
}

export type PlayoffFinish = 'champion' | 'runner_up' | 'third' | 'fourth' | 'semifinalist';

// Piazzamento nei playoff di una stagione, per squadra (solo partite giocate)
export async function computePlayoffFinishes(seasonId: string): Promise<Map<string, PlayoffFinish>> {
  const { rows } = await db.execute({
    sql: `SELECT * FROM matches WHERE season_id = ? AND is_played = 1 AND match_type IN ${sqlIn([...SEMIFINAL_TYPES, ...FINAL_TYPES])}`,
    args: [seasonId],
  });

  const finishes = new Map<string, PlayoffFinish>();
  for (const m of rows.filter(r => SEMIFINAL_TYPES.includes(String(r.match_type)))) {
    finishes.set(String(m.home_team_id), 'semifinalist');
    finishes.set(String(m.away_team_id), 'semifinalist');
  }
  for (const m of rows.filter(r => FINAL_TYPES.includes(String(r.match_type)))) {
    const result = matchWinner(m);
    if (!result) continue;
    const isFinal = m.match_type === MATCH_TYPES.final;
    finishes.set(result.winner, isFinal ? 'champion' : 'third');
    finishes.set(result.loser, isFinal ? 'runner_up' : 'fourth');
  }
  return finishes;
}
