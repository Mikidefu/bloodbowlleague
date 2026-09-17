'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { UserRound } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
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
      <div>
        <div className={styles.headerArea}>
          <h1 className={styles.pageTitle}><UserRound size={48} /> {t.coaches.title}</h1>
        </div>

        {loading ? (
            <p className={styles.subtitle} style={{ textAlign: 'center' }}>...</p>
        ) : sorted.length === 0 ? (
            <div className="card" style={{ textAlign: 'center' }}>
              <p className={styles.subtitle}>{t.coaches.noCoaches}</p>
            </div>
        ) : (
            <div className={styles.board}>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                  <tr>
                    <th className={styles.left}>{t.coachPicker.label}</th>
                    <th className={styles.left}>{t.coaches.current}</th>
                    <th>{t.coaches.seasons}</th>
                    <th>{t.coaches.teams}</th>
                    <th>{t.coaches.record}</th>
                    <th>{t.coaches.winRate}</th>
                    <th>{t.coaches.points}</th>
                    <th>{t.coaches.finals}</th>
                    <th>{t.coaches.titles}</th>
                  </tr>
                  </thead>
                  <tbody>
                  {sorted.map(c => (
                      <tr key={c.id}>
                        <td className={styles.left}>
                          <Link href={`/coaches/${c.id}`} className={styles.nameLink}>{c.name}</Link>
                        </td>
                        <td className={styles.left}>
                          {c.latest ? (
                              <>
                                <Link href={`/teams/${c.latest.team_id}`} style={{ color: '#ddd' }}>{c.latest.team_name}</Link>
                                <span className={styles.muted}>{c.latest.season_name}</span>
                              </>
                          ) : '—'}
                        </td>
                        <td>{c.totals.seasons}</td>
                        <td>{c.totals.teams}</td>
                        <td>{c.totals.wins}-{c.totals.draws}-{c.totals.losses}</td>
                        <td>{c.totals.played ? `${c.totals.win_rate}%` : '—'}</td>
                        <td className={styles.big}>{c.totals.points}</td>
                        <td>{c.totals.finals}</td>
                        <td className={`${styles.big} ${styles.gold}`}>{c.totals.titles > 0 ? `🏆 ${c.totals.titles}` : 0}</td>
                      </tr>
                  ))}
                  </tbody>
                </table>
              </div>
            </div>
        )}
      </div>
  );
}
