'use client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { INDUCEMENTS } from '@/lib/leagueRules';
import { getMatchTable, rowForTotal } from '@/lib/matchTables';
import { getStarHire } from '@/lib/starPlayers';
import type { MatchDetails, MatchTeam } from '@/lib/types';
import MatchTables from '@/components/match/MatchTables';
import { WizardStepCard } from '@/components/match/Wizard';
import wz from '@/components/match/Wizard.module.css';
import { reportOf, savedInducements } from './pregameModel';

/** Si gioca: il riassunto del pre-partita a portata di mano, le tabelle per i tiri, e il passaggio al referto. */
export default function InPlayPanel({ match, onReport, onRedoPregame }: { match: MatchDetails; onReport: () => void; onRedoPregame: () => void }) {
  const { language } = useLanguage();
  const L = (it: string, en: string) => (language === 'it' ? it : en);
  const teams = [match.home_team_id, match.away_team_id].map(id => match.teams.find(tm => tm.id === id)).filter(Boolean) as MatchTeam[];
  const weather = match.weather_roll ? rowForTotal(getMatchTable('weather')!, match.weather_roll) : null;
  const kicking = teams.find(tm => tm.id === match.kicking_team_id);
  const nameOf = (key: string, star?: string, name?: string) =>
    key === 'star_player' ? getStarHire(star)?.name ?? name ?? 'Star Player' : INDUCEMENTS.find(i => i.key === key)?.name ?? key;

  return (
      <>
        <WizardStepCard
            title={L('Si gioca!', 'Play ball!')}
            page="pp. 47-50"
            explain={[
              L('Il pre-partita è fatto. Ogni drive comincia così: la squadra che calcia schiera per prima, poi quella che riceve; si calcia, la palla devia e si tira il Kick-off Event.',
                'The pre-game is done. Every drive starts like this: the kicking team sets up first, then the receiving team; the ball is kicked, it deviates and you roll the Kick-off Event.'),
              L('Qui sotto trovi tutte le tabelle che servono in campo: Kick-off, infortuni, Casualty, Argue the Call e Prayers to Nuffle. Quando la partita è finita, passa al referto.',
                'Below are all the tables you need on the pitch: Kick-off, injuries, Casualty, Argue the Call and Prayers to Nuffle. When the match is over, move on to the report.'),
            ]}
            onNext={onReport}
            nextLabel={L('La partita è finita: compila il referto', 'The match is over: fill in the report')}
        >
          <dl className={wz.facts}>
            <div><dt>{L('Meteo', 'Weather')}</dt><dd>{weather ? `${weather.name} (${match.weather_roll})` : '—'}</dd></div>
            <div><dt>{L('Calcia il primo drive', 'Kicks the first drive')}</dt><dd>{kicking?.name ?? '—'}</dd></div>
          </dl>
          {weather && weather.tone !== 'neutral' && <p className={wz.note}>{weather.text[language]}</p>}
          <div className={wz.teams}>
            {teams.map(team => {
              const report = reportOf(match, team.id);
              const inducements = savedInducements(match, team.id);
              const prayers = inducements.find(c => c.key === 'prayers')?.qty ?? 0;
              return (
                  <div key={team.id} className={wz.team} style={{ '--team-color': (team.id === match.home_team_id ? match.home_color : match.away_color) ?? undefined } as React.CSSProperties}>
                    <h4 className={wz.teamName}>{team.name}</h4>
                    <dl className={wz.facts}>
                      <div><dt>Fan Factor</dt><dd>{report?.fan_factor ?? '—'}</dd></div>
                      <div><dt>Journeymen</dt><dd>{report?.journeymen ?? 0}</dd></div>
                      <div><dt>{L('Incentivi', 'Inducements')}</dt><dd>{inducements.length ? inducements.map(c => `${nameOf(c.key, c.star, c.name)}${c.qty > 1 ? ` x${c.qty}` : ''}`).join(', ') : L('nessuno', 'none')}</dd></div>
                    </dl>
                    {prayers > 0 && <p className={wz.note}>{L(`Prayers to Nuffle: tira ${prayers} volte il D16 nella tabella qui sotto (ritira i doppioni).`, `Prayers to Nuffle: roll the D16 ${prayers} times on the table below (re-roll duplicates).`)}</p>}
                  </div>
              );
            })}
          </div>
          <div className={wz.actions}>
            <button type="button" className="btn" onClick={onRedoPregame}>{L('Rifai il pre-partita', 'Redo the pre-game')}</button>
          </div>
        </WizardStepCard>
        <div style={{ marginTop: '1.5rem' }}>
          <MatchTables initial="kickoff" />
        </div>
      </>
  );
}
