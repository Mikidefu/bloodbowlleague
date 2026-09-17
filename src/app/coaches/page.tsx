'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, UserRound } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import PageHeader from '@/components/brand/PageHeader';
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
        <PageHeader title={t.coaches.title} icon={<UserRound size={44} />} />

        {loading ? (
            <p className="loading-state">...</p>
        ) : sorted.length === 0 ? (
            <div className={`card ${styles.emptyCard}`}>
              <p className={styles.emptyText}>{t.coaches.noCoaches}</p>
            </div>
        ) : (
            <div className={`table-container ${styles.tableWrap}`}>
              <div className="stars-bar" aria-hidden="true" />
              <table className={`data-table ${styles.roster}`}>
                <thead>
                <tr>
                  <th>{t.coachPicker.label}</th>
                  <th>{t.coaches.current}</th>
                  <th className="num">{t.coaches.seasons}</th>
                  <th className="num">{t.coaches.teams}</th>
                  <th className="num">{t.coaches.record}</th>
                  <th className="num">{t.coaches.winRate}</th>
                  <th className="num">{t.coaches.points}</th>
                  <th className="num">{t.coaches.finals}</th>
                  <th className="num">{t.coaches.titles}</th>
                </tr>
                </thead>
                <tbody>
                {sorted.map(c => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/coaches/${c.id}`} className={styles.nameLink}>{c.name}</Link>
                      </td>
                      <td>
                        {c.latest ? (
                            <>
                              <Link href={`/teams/${c.latest.team_id}`} className={styles.subLink}>{c.latest.team_name}</Link>
                              <span className={styles.muted}>{c.latest.season_name}</span>
                            </>
                        ) : '—'}
                      </td>
                      <td className="num">{c.totals.seasons}</td>
                      <td className="num">{c.totals.teams}</td>
                      <td className="num">{c.totals.wins}-{c.totals.draws}-{c.totals.losses}</td>
                      <td className="num">{c.totals.played ? `${c.totals.win_rate}%` : '—'}</td>
                      <td className={`num ${styles.big}`}>{c.totals.points}</td>
                      <td className="num">{c.totals.finals}</td>
                      <td className={`num ${styles.big}`}>
                        {c.totals.titles > 0
                            ? <span className={styles.titles}><Trophy size={18} aria-hidden="true" /> {c.totals.titles}</span>
                            : 0}
                      </td>
                    </tr>
                ))}
                </tbody>
              </table>
            </div>
        )}
      </div>
  );
}
