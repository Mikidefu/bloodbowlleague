import db from '@/lib/db';
import { LEAGUE_MATCH_TYPES, sqlIn } from '@/lib/matchTypes';

export type TeamStanding = {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
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

// Classifica di campionato: contano solo le partite di lega giocate (niente amichevoli né playoff).
// Punti: vittoria 3, pareggio 1. Spareggi: differenza TD, poi differenza CAS.
export async function computeStandings(): Promise<TeamStanding[]> {
  const { rows } = await db.execute(`
    SELECT
      t.id, t.name, t.logo_url, t.primary_color, t.secondary_color,
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
    FROM teams t
    LEFT JOIN matches m
      ON (t.id = m.home_team_id OR t.id = m.away_team_id)
     AND m.is_played = 1
     AND m.match_type IN ${sqlIn(LEAGUE_MATCH_TYPES)}
    GROUP BY t.id
  `);

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
