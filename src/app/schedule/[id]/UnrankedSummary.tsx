'use client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { CASUALTY_RESULTS, casualtyInfo } from '@/lib/leagueRules';
import type { MatchDetails, MatchTeam, ResultSimulation, SimulatedPlayer } from '@/lib/types';
import { Facts, WizardStepCard } from '@/components/match/Wizard';
import wz from '@/components/match/Wizard.module.css';

const gp = (n: number) => n.toLocaleString();

/** Il post-partita che una Non classificata avrebbe avuto in campionato (referto simulato, pp. 95-103).
 *  Serve solo da guardare: niente di tutto questo viene salvato. */
export default function UnrankedSummary({ match, simulation }: { match: MatchDetails; simulation: ResultSimulation }) {
  const { language } = useLanguage();
  const L = (it: string, en: string) => (language === 'it' ? it : en);
  const teams = [match.home_team_id, match.away_team_id].map(id => match.teams.find(tm => tm.id === id)).filter(Boolean) as MatchTeam[];
  const colorOf = (id: string) => (id === match.home_team_id ? match.home_color : match.away_color);
  const playerName = (id: string) => [...match.homePlayers, ...match.awayPlayers].find(p => p.id === id)?.name ?? '?';

  const injuryText = ({ injury }: SimulatedPlayer) => {
    if (!injury) return '';
    const parts = [CASUALTY_RESULTS.find(c => c.key === injury.result)?.name ?? injury.result];
    if (injury.result === 'LI' && injury.stat) {
      parts.push(injury.applied ? `-1 ${injury.stat.toUpperCase()}` : L(`${injury.stat.toUpperCase()} già al minimo`, `${injury.stat.toUpperCase()} already at its minimum`));
    }
    if (casualtyInfo(injury.result)?.niggling) parts.push('Niggling Injury');
    if (casualtyInfo(injury.result)?.missNextGame) parts.push(L('salterebbe la prossima', 'would miss the next game'));
    if (injury.hatred) parts.push(`Hatred (${injury.hatred})`);
    return parts.join(' · ');
  };

  return (
      <div className={wz.teams}>
        {teams.map(team => {
          const sim = simulation.teams.find(s => s.team_id === team.id);
          if (!sim) return null;
          const players = simulation.players.filter(p => p.team_id === team.id);
          const df = sim.dedicated_fans + sim.df_change;
          return (
              <div key={team.id} className={wz.team} style={{ '--team-color': colorOf(team.id) ?? undefined } as React.CSSProperties}>
                <h4 className={wz.teamName}>{team.name}</h4>
                <Facts rows={[
                  [L('Risultato', 'Result'), sim.result === 'win' ? L('Vittoria', 'Win') : sim.result === 'loss' ? L('Sconfitta', 'Loss') : L('Pareggio', 'Draw'),
                    sim.result === 'win' ? 'good' : sim.result === 'loss' ? 'bad' : undefined],
                  [L('Incasso', 'Winnings'), `+${gp(sim.winnings)} gp`, 'good'],
                  ['Treasury', `${gp(sim.treasury)} → ${gp(sim.treasury + sim.winnings)} gp`],
                  ['Dedicated Fans', sim.df_change ? `${sim.dedicated_fans} → ${df}` : `${sim.dedicated_fans}`, sim.df_change > 0 ? 'good' : sim.df_change < 0 ? 'bad' : undefined],
                ]} />
                {players.length > 0 ? (
                    <ul className={wz.list}>
                      {players.map(p => (
                          <li key={p.player_id} className={wz.listRow}>
                            <span>
                              <strong>{p.name}</strong>{p.mvp ? ' · MVP' : ''}{p.injury ? ` · ${injuryText(p)}` : ''}
                            </span>
                            {p.spp_earned > 0 && (
                                <span>
                                  <b className={wz.sppBadge}>+{p.spp_earned} SPP</b> {p.spp} → {p.spp + p.spp_earned} SPP
                                  {p.can_advance && <> <span className="tag tag-navy">{L('Può avanzare', 'Can advance')}</span></>}
                                </span>
                            )}
                          </li>
                      ))}
                    </ul>
                ) : (
                    <p className={wz.note}>{L('Nessun giocatore con SPP o infortuni.', 'No player earned SPP or got injured.')}</p>
                )}
                {sim.quit.length > 0 && (
                    <p className={wz.warn}>{L('Se ne sarebbero andati (p. 101)', 'Would have left (p. 101)')}: {sim.quit.map(playerName).join(', ')}</p>
                )}
              </div>
          );
        })}
      </div>
  );
}

/** Fine di una Non classificata: resta solo il risultato. Se il referto simulato è appena stato fatto, lo si rivede qui. */
export function UnrankedClosed({ match, simulation }: { match: MatchDetails; simulation: ResultSimulation | null }) {
  const { language } = useLanguage();
  const L = (it: string, en: string) => (language === 'it' ? it : en);
  return (
      <WizardStepCard
          title={L('Partita chiusa', 'Match closed')}
          explain={[
            L('Era una **Non classificata**: classifica, **SPP**, infortuni, **Treasury** e **Dedicated Fans** sono rimasti come prima e i **Journeymen** se ne sono andati. Resta solo il risultato.',
              'It was an **Unranked** match: standings, **SPP**, injuries, **Treasury** and **Dedicated Fans** are as they were, and the **Journeymen** have left. Only the result is kept.'),
            L('Se il punteggio è sbagliato, correggilo nel tabellone qui sotto e salvalo con il pulsante in alto.',
              'If the score is wrong, fix it on the scoreboard below and save it with the button at the top.'),
          ]}
      >
        <p className={wz.score}>{match.home_name} <strong>{match.home_score} – {match.away_score}</strong> {match.away_name}</p>
        {simulation && (
            <>
              <p className={wz.note}>{L('Se fosse stata una partita di lega:', 'Had it been a league match:')}</p>
              <UnrankedSummary match={match} simulation={simulation} />
            </>
        )}
      </WizardStepCard>
  );
}
