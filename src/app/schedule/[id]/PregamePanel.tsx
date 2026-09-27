'use client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { INDUCEMENTS } from '@/lib/leagueRules';
import { getMatchTable, rowForTotal } from '@/lib/matchTables';
import { getStarHire } from '@/lib/starPlayers';
import { getPrayer } from '@/lib/prayers';
import { prayerEffectText, matchPrayerPlayer } from '@/components/match/PrayerList';
import type { MatchDetails } from '@/lib/types';
import { reportOf, savedInducements, savedPrayers } from './pregameModel';
import styles from './MatchDetails.module.css';

const gp = (n: number) => n.toLocaleString();

// Riepilogo in sola lettura del pre-partita (pp. 44-46, 94). Si compila con il percorso guidato
// (PregameWizard); qui lo vede chi non è admin, e chiunque dopo la partita.
export default function PregamePanel({ match }: { match: MatchDetails }) {
  const { t, language } = useLanguage();
  if (!match.reports.some(r => r.fan_factor !== null)) return null;

  const weather = match.weather_roll ? rowForTotal(getMatchTable('weather')!, match.weather_roll) : null;
  const kicking = match.teams.find(tm => tm.id === match.kicking_team_id);
  const teams = [match.home_team_id, match.away_team_id].map(id => match.teams.find(tm => tm.id === id)).filter(Boolean);
  const prayerPlayer = matchPrayerPlayer(match);
  const inducementName = (key: string, star?: string, name?: string) =>
    key === 'star_player' ? getStarHire(star)?.name ?? name ?? t.rules.starPlayer : INDUCEMENTS.find(i => i.key === key)?.name ?? key;

  return (
      <section className={`card ${styles.rulesCard}`}>
        <h3 className="subhead">{t.rules.pregameTitle}</h3>
        {(weather || kicking) && (
            <p className={styles.rulesNote}>
              {weather && <>{language === 'it' ? 'Meteo' : 'Weather'}: <strong>{weather.name}</strong> ({match.weather_roll}) </>}
              {kicking && <>· {language === 'it' ? 'Calcia' : 'Kicking'}: <strong>{kicking.name}</strong></>}
            </p>
        )}
        <div className={styles.rulesGrid}>
          {teams.map(team => {
            const report = reportOf(match, team!.id);
            const inducements = savedInducements(match, team!.id);
            const prayers = savedPrayers(match, team!.id);
            return (
                <div key={team!.id} className={styles.rulesTeam}>
                  <strong className={styles.rulesTeamName}>{team!.name}</strong>
                  <span>{t.rules.fanFactor}: <strong>{report?.fan_factor ?? '—'}</strong> ({t.rules.dedicatedFans} + D3 {report?.fair_weather ?? '—'})</span>
                  <span>{t.rules.ctv}: <strong>{gp(report?.ctv ?? 0)}</strong></span>
                  <span>{t.rules.pettyCash}: {gp(report?.petty_cash ?? 0)} · {t.rules.treasury}: -{gp(report?.treasury_spent ?? 0)}</span>
                  {!!report?.journeymen && <span>{t.rules.journeymenNeeded}: {report.journeymen}</span>}
                  <span>{t.rules.inducements}: {inducements.length ? inducements.map(c => `${inducementName(c.key, c.star, c.name)} x${c.qty}`).join(', ') : t.rules.none}</span>
                  {prayers.map(p => (
                      <span key={p.roll}>
                        Prayer to Nuffle: <strong>{getPrayer(p.roll)?.name}</strong> ({p.roll})
                        {(p.players ?? []).map(id => ` · ${prayerPlayer(id)?.name ?? '?'} ${prayerEffectText(p, prayerPlayer(id))}`).join('')}
                      </span>
                  ))}
                </div>
            );
          })}
        </div>
      </section>
  );
}
