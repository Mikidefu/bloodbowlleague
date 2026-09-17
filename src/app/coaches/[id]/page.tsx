'use client';
import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert, UserRound } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { useSeason } from '@/lib/SeasonContext';
import type { CoachCareer } from '@/lib/coaches';
import styles from '../Coaches.module.css';

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

async function fetchCareer(id: string): Promise<CoachCareer | null> {
  const res = await fetch(`/api/coaches/${id}`);
  return res.ok ? res.json() : null;
}

export default function CoachDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
  const { setSelectedSeasonId } = useSeason();
  const [career, setCareer] = useState<CoachCareer | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');

  // Aggiorna lo stato solo a risposta arrivata (e ignora risposte di un allenatore precedente)
  const applyCareer = useCallback((data: CoachCareer | null) => {
    if (data) setCareer(data);
    else setNotFound(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchCareer(id)
        .then(data => { if (!cancelled) applyCareer(data); })
        .catch(() => { if (!cancelled) applyCareer(null); });
    return () => { cancelled = true; };
  }, [id, applyCareer]);

  const load = () => fetchCareer(id).then(applyCareer).catch(() => applyCareer(null));

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/coaches/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error || 'Failed to rename coach');
      return;
    }
    setRenaming(false);
    load();
  };

  if (notFound) return <div className="card" style={{ textAlign: 'center' }}><p className={styles.subtitle}>{t.coaches.notFound}</p></div>;
  if (!career) return <p className={styles.subtitle} style={{ textAlign: 'center' }}>...</p>;

  const { totals } = career;
  const tiles = [
    { label: t.coaches.seasons, value: totals.seasons },
    { label: t.coaches.teams, value: totals.teams },
    { label: t.coaches.record, value: `${totals.wins}-${totals.draws}-${totals.losses}` },
    { label: t.coaches.winRate, value: totals.played ? `${totals.win_rate}%` : '—' },
    { label: t.coaches.points, value: totals.points },
    { label: t.coaches.tdDiff, value: signed(totals.td_for - totals.td_against) },
    { label: t.coaches.casDiff, value: signed(totals.cas_for - totals.cas_against) },
    { label: t.coaches.playoffs, value: totals.playoffs },
    { label: t.coaches.finals, value: totals.finals },
    { label: t.coaches.titles, value: totals.titles > 0 ? `🏆 ${totals.titles}` : 0 },
  ];

  return (
      <div>
        <div className={styles.headerArea}>
          <h1 className={styles.pageTitle}><UserRound size={48} /> {career.name}</h1>
          {isAdmin && (renaming ? (
              <form onSubmit={handleRename} className={styles.inlineForm}>
                <input className={styles.textInput} value={newName} onChange={e => setNewName(e.target.value)} maxLength={60} required autoFocus aria-label={t.coaches.rename} />
                <button type="submit" className="btn btn-primary">OK</button>
                <button type="button" className="btn" onClick={() => setRenaming(false)}>✕</button>
              </form>
          ) : (
              <button className="btn" onClick={() => { setNewName(career.name); setRenaming(true); }}>{t.coaches.rename}</button>
          ))}
        </div>

        <h2 className={styles.sectionTitle}>{t.coaches.career}</h2>
        <div className={styles.statGrid}>
          {tiles.map(tile => (
              <div key={tile.label} className={styles.statTile}>
                <div className={styles.statValue}>{tile.value}</div>
                <div className={styles.statLabel}>{tile.label}</div>
              </div>
          ))}
        </div>

        <h2 className={styles.sectionTitle}>{t.coaches.bySeason}</h2>
        <div className={styles.board}>
          {career.seasons.length === 0 ? (
              <p className={styles.empty}>—</p>
          ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                  <tr>
                    <th className={styles.left}>{t.seasons.season}</th>
                    <th className={styles.left}>{t.seasons.team}</th>
                    <th>{t.coaches.position}</th>
                    <th>{t.coaches.record}</th>
                    <th>{t.coaches.points}</th>
                    <th>{t.coaches.tdDiff}</th>
                    <th>{t.coaches.casDiff}</th>
                    <th>{t.coaches.playoffs}</th>
                  </tr>
                  </thead>
                  <tbody>
                  {career.seasons.map(s => (
                      <tr key={`${s.season_id}-${s.team_id}`}>
                        <td className={styles.left}>
                          {/* Apre classifica e calendario di quella stagione */}
                          <Link href="/standings" onClick={() => setSelectedSeasonId(s.season_id)} className={styles.nameLink} style={{ fontSize: '1.1rem' }}>
                            {s.season_name}
                          </Link>
                          <span className={styles.muted}>{s.season_status === 'active' ? t.seasons.active : t.seasons.completed}</span>
                        </td>
                        <td className={styles.left}>
                          <Link href={`/teams/${s.team_id}`} className={styles.teamCell} style={{ color: '#ddd' }}>
                            {s.team_logo
                                ? <img src={s.team_logo} alt="" className={styles.teamLogo} />
                                : <ShieldAlert size={30} color={s.team_color ?? '#888'} />}
                            <span>{s.team_name}<span className={styles.muted}>{s.team_race}</span></span>
                          </Link>
                        </td>
                        <td className={styles.big}>{s.position ? `${s.position}°` : '—'}<span className={styles.muted}>/ {s.teams_in_season}</span></td>
                        <td>{s.wins}-{s.draws}-{s.losses}</td>
                        <td className={styles.big}>{s.points}</td>
                        <td className={s.td_for - s.td_against > 0 ? styles.positive : s.td_for - s.td_against < 0 ? styles.negative : ''}>{signed(s.td_for - s.td_against)}</td>
                        <td className={s.cas_for - s.cas_against > 0 ? styles.positive : s.cas_for - s.cas_against < 0 ? styles.negative : ''}>{signed(s.cas_for - s.cas_against)}</td>
                        <td>
                          {s.playoff
                              ? <span className={`${styles.finishBadge} ${styles[`finish_${s.playoff}`]}`}>{s.playoff === 'champion' ? '🏆 ' : ''}{t.coaches.finish[s.playoff]}</span>
                              : '—'}
                        </td>
                      </tr>
                  ))}
                  </tbody>
                </table>
              </div>
          )}
        </div>
      </div>
  );
}
