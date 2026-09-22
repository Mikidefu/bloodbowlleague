'use client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { casualtyInfo, sppEarned } from '@/lib/leagueRules';
import { getRoster, hasRule } from '@/lib/rosters';
import type { MatchDetails } from '@/lib/types';
import type { PlayerStatDraft } from './reportModel';
import styles from './MatchPlayerStats.module.css';

const n = (v: number | '') => Number(v) || 0;

/** Statistiche dei giocatori in questa partita, in sola lettura: chi ha fatto cosa, SPP guadagnati e infortuni. */
export default function MatchPlayerStats({ match, playerStats }: { match: MatchDetails; playerStats: PlayerStatDraft[] }) {
  const { language } = useLanguage();
  const L = (it: string, en: string) => (language === 'it' ? it : en);

  const COLS = [
    { key: 'td', label: 'TD', title: L('Touchdown', 'Touchdowns') },
    { key: 'cas', label: 'CAS', title: L('Casualty causate', 'Casualties caused') },
    { key: 'int', label: 'INT', title: L('Intercetti', 'Interceptions') },
    { key: 'comp', label: 'CMP', title: L('Passaggi completati', 'Completions') },
    { key: 'ttm', label: 'TTM', title: 'Throw Team-mate' },
    { key: 'landing', label: L('ATT', 'LAND'), title: L('Atterraggi', 'Landings') },
    { key: 'mvp', label: 'MVP', title: 'Most Valuable Player' },
  ] as const;

  const teams = [
    { id: match.home_team_id, name: match.home_name, color: match.home_color, score: match.home_score },
    { id: match.away_team_id, name: match.away_name, color: match.away_color, score: match.away_score },
  ];

  const sppOf = (p: PlayerStatDraft, brutes: boolean) => {
    // Dopo il referto vale quello salvato (tiene conto di concessioni e partite non giocate)
    const saved = match.stats.find(s => s.player_id === p.player_id);
    if (saved) return saved.spp_earned;
    return sppEarned({ td: n(p.td), cas: n(p.cas), int: n(p.int), comp: n(p.comp), ttm: n(p.ttm), landing: n(p.landing), mvp: n(p.mvp) }, { brawlinBrutes: brutes });
  };

  return (
      <section className={styles.wrap} aria-labelledby="match-player-stats">
        <h3 id="match-player-stats" className={styles.title}>{L('Statistiche dei giocatori', 'Player stats')}</h3>
        <p className={styles.lead}>
          {L('Cosa ha fatto ogni giocatore in ', 'What each player did in ')}<b>{L('questa partita', 'this match')}</b>
          {L(': gli SPP guadagnati e gli infortuni subiti.', ': SPP earned and injuries suffered.')}
        </p>
        <div className={styles.teams}>
          {teams.map(team => {
            const brutes = hasRule(getRoster(match.teams.find(t => t.id === team.id)?.roster), 'Brawlin Brutes');
            const rows = playerStats
                .filter(p => p.team_id === team.id && !p.unavailable)
                .map(p => ({ p, spp: sppOf(p, brutes), injury: casualtyInfo(p.injury) }))
                .sort((a, b) => b.spp - a.spp || (a.p.jersey_number ?? 99) - (b.p.jersey_number ?? 99));
            const total = (key: (typeof COLS)[number]['key']) => rows.reduce((sum, r) => sum + n(r.p[key]), 0);
            const totalSpp = rows.reduce((sum, r) => sum + r.spp, 0);
            return (
                <article key={team.id} className={styles.team} style={team.color ? ({ '--team-color': team.color } as React.CSSProperties) : undefined}>
                  <header className={styles.teamHead}>
                    <h4 className={styles.teamName}>{team.name}</h4>
                    <span className={styles.teamScore}>{team.score ?? 0} TD</span>
                  </header>
                  <div className={styles.scroll}>
                    <table className={`data-table ${styles.table}`}>
                      <thead>
                      <tr>
                        <th className="num">N°</th>
                        <th>{L('Giocatore', 'Player')}</th>
                        {COLS.map(c => <th key={c.key} className="num" title={c.title}>{c.label}</th>)}
                        <th className={`num ${styles.sppHead}`} title="Star Player Points">SPP</th>
                        <th>{L('Infortunio', 'Injury')}</th>
                      </tr>
                      </thead>
                      <tbody>
                      {rows.map(({ p, spp, injury }) => (
                          <tr key={p.player_id} className={spp === 0 && !injury ? styles.quiet : injury?.key === 'DEAD' ? styles.dead : undefined}>
                            <td className="num">{p.jersey_number ?? '-'}</td>
                            <td className={styles.name}>{p.name}</td>
                            {COLS.map(c => {
                              const v = n(p[c.key]);
                              return <td key={c.key} className={`num ${v ? styles.hit : styles.zero}`}>{v || '·'}</td>;
                            })}
                            <td className={`num ${styles.spp}`}>{spp ? `+${spp}` : '·'}</td>
                            <td>
                              {injury && (
                                  <span className={`tag ${injury.key === 'DEAD' || injury.key === 'SI' || injury.key === 'LI' ? 'tag-red' : 'tag-navy'}`}>
                                    {injury.name}{p.injury === 'LI' && p.injuryStat ? ` (-1 ${p.injuryStat.toUpperCase()})` : ''}
                                  </span>
                              )}
                            </td>
                          </tr>
                      ))}
                      {rows.length === 0 && (
                          <tr><td colSpan={COLS.length + 4} className={styles.empty}>{L('Nessun giocatore registrato.', 'No players recorded.')}</td></tr>
                      )}
                      </tbody>
                      {rows.length > 0 && (
                          <tfoot>
                          <tr>
                            <td />
                            <td className={styles.name}>{L('Totale', 'Total')}</td>
                            {COLS.map(c => <td key={c.key} className="num">{total(c.key)}</td>)}
                            <td className={`num ${styles.spp}`}>{totalSpp}</td>
                            <td />
                          </tr>
                          </tfoot>
                      )}
                    </table>
                  </div>
                </article>
            );
          })}
        </div>
      </section>
  );
}
