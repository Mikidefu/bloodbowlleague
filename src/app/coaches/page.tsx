'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Trophy, UserRound } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import PageHeader from '@/components/brand/PageHeader';
import SectionTitle from '@/components/brand/SectionTitle';
import styles from './Coaches.module.css';

type CoachRow = {
  id: string;
  name: string;
  totals: {
    seasons: number; teams: number; played: number; wins: number; draws: number; losses: number;
    points: number; td_for: number; td_against: number; titles: number; finals: number; win_rate: number;
  };
  latest: { season_name: string; season_status: string; team_id: string; team_name: string } | null;
};

const pad = (n: number) => String(n).padStart(2, '0');

export default function CoachesPage() {
  const { t } = useLanguage();
  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/coaches')
        .then(res => res.json())
        .then(data => setCoaches(Array.isArray(data) ? data : []))
        .catch(() => setCoaches([]))
        .finally(() => setLoading(false));
  }, []);

  // Più titoli, poi più punti in carriera, poi nome
  const sorted = [...coaches].sort((a, b) =>
      b.totals.titles - a.totals.titles || b.totals.points - a.totals.points || a.name.localeCompare(b.name));

  return (
      <div className={styles.page}>
        <PageHeader title={t.coaches.title} icon={<UserRound size={44} />} />

        {loading ? (
            <p className="loading-state">...</p>
        ) : sorted.length === 0 ? (
            <div className={`chamfer ${styles.emptyCard}`}>
              <p className={styles.emptyText}>{t.coaches.noCoaches}</p>
            </div>
        ) : (
            <section className={`bleed ${styles.rankBand}`}>
              <span className={`ghost-text on-light ${styles.ghostRank}`} aria-hidden="true">Ranking</span>

              <div className={styles.inner}>
                <SectionTitle
                    index="01"
                    on="light"
                    micro={`${sorted.length} ${t.coaches.title} // ${t.coaches.titles} > ${t.coaches.points}`}
                    title={t.coaches.career}
                />

                <ol className={styles.rankList}>
                  {sorted.map((c, i) => {
                    const rank = i + 1;
                    const stats = [
                      { label: t.coaches.record, value: `${c.totals.wins}-${c.totals.draws}-${c.totals.losses}` },
                      { label: t.coaches.winRate, value: c.totals.played ? `${c.totals.win_rate}%` : '—' },
                      { label: t.coaches.seasons, value: c.totals.seasons },
                      { label: t.coaches.teams, value: c.totals.teams },
                      { label: t.coaches.finals, value: c.totals.finals },
                    ];
                    return (
                        <li key={c.id} className={`${styles.rankItem} ${rank <= 3 ? styles.rankLead : ''} ${rank === 1 ? styles.rankFirst : ''}`}>
                          <div className={`chamfer ${styles.rankCard}`}>
                            <span className={styles.rankNum} aria-hidden="true">{pad(rank)}</span>

                            <div className={styles.rankIdentity}>
                              <span className={styles.rankMicro}>
                                <i className={styles.microSquares} aria-hidden="true" />
                                {c.latest ? `${t.coaches.current} // ${c.latest.season_name}` : `${t.coachPicker.label} // —`}
                              </span>
                              <Link href={`/coaches/${c.id}`} className={styles.rankName}>
                                <span className="visually-hidden">{rank}. </span>{c.name}
                              </Link>
                              {c.latest ? (
                                  <Link href={`/teams/${c.latest.team_id}`} className={styles.rankTeam}>{c.latest.team_name}</Link>
                              ) : <span className={styles.rankTeamNone}>—</span>}
                            </div>

                            <dl className={styles.rankStats}>
                              {stats.map(s => (
                                  <div key={s.label} className={styles.rankStat}>
                                    <dt>{s.label}</dt>
                                    <dd>{s.value}</dd>
                                  </div>
                              ))}
                            </dl>

                            <div className={styles.rankScore}>
                              <span className={`plate ${styles.rankPoints}`}>
                                <strong>{c.totals.points}</strong>
                                <small>{t.coaches.points}</small>
                              </span>
                              <span className={`${styles.rankTitles} ${c.totals.titles > 0 ? styles.rankTitlesWon : ''}`}>
                                <Trophy size={18} aria-hidden="true" /> {c.totals.titles}
                                <span className="visually-hidden"> {t.coaches.titles}</span>
                              </span>
                            </div>

                            <Link href={`/coaches/${c.id}`} className={styles.rankGo} aria-hidden="true" tabIndex={-1}>
                              <ArrowRight size={22} aria-hidden="true" />
                            </Link>
                          </div>
                        </li>
                    );
                  })}
                </ol>
              </div>
            </section>
        )}
      </div>
  );
}
