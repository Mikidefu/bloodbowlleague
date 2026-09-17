'use client';
import { use, useCallback, useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { ShieldAlert, Trophy, UserRound } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { useSeason } from '@/lib/SeasonContext';
import PageHeader from '@/components/brand/PageHeader';
import type { CoachCareer } from '@/lib/coaches';
import type { PlayoffFinish } from '@/lib/standings';
import styles from '../Coaches.module.css';

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

// Piazzamento playoff come etichetta del brand (null = testo semplice)
const finishTag: Record<PlayoffFinish, string | null> = {
  champion: 'tag',
  runner_up: 'tag tag-navy',
  third: 'tag tag-red',
  fourth: null,
  semifinalist: null,
};

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

  if (notFound) {
    return (
        <div>
          <PageHeader title={t.coaches.title} icon={<UserRound size={44} />} />
          <div className={`card ${styles.emptyCard}`}><p className={styles.emptyText}>{t.coaches.notFound}</p></div>
        </div>
    );
  }
  if (!career) return <p className="loading-state">...</p>;

  const { totals } = career;
  const tiles: { label: string; value: ReactNode }[] = [
    { label: t.coaches.seasons, value: totals.seasons },
    { label: t.coaches.teams, value: totals.teams },
    { label: t.coaches.record, value: `${totals.wins}-${totals.draws}-${totals.losses}` },
    { label: t.coaches.winRate, value: totals.played ? `${totals.win_rate}%` : '—' },
    { label: t.coaches.points, value: totals.points },
    { label: t.coaches.tdDiff, value: signed(totals.td_for - totals.td_against) },
    { label: t.coaches.casDiff, value: signed(totals.cas_for - totals.cas_against) },
    { label: t.coaches.playoffs, value: totals.playoffs },
    { label: t.coaches.finals, value: totals.finals },
    { label: t.coaches.titles, value: totals.titles > 0 ? <><Trophy size={30} aria-hidden="true" /> {totals.titles}</> : 0 },
  ];

  const diffClass = (n: number) => (n > 0 ? styles.positive : n < 0 ? styles.negative : '');

  const adminActions = isAdmin ? (renaming ? (
      <form onSubmit={handleRename} className={styles.inlineForm}>
        <input className={styles.textInput} value={newName} onChange={e => setNewName(e.target.value)} maxLength={60} required autoFocus aria-label={t.coaches.rename} />
        <button type="submit" className="btn btn-gold">OK</button>
        <button type="button" className="btn btn-slate" onClick={() => setRenaming(false)}>✕</button>
      </form>
  ) : (
      <button className="btn btn-gold" onClick={() => { setNewName(career.name); setRenaming(true); }}>{t.coaches.rename}</button>
  )) : undefined;

  return (
      <div>
        <PageHeader
            title={career.name}
            kicker={t.coachPicker.label}
            icon={<UserRound size={44} />}
            actions={adminActions}
        />

        <section className={`panel-blood ${styles.profile}`} aria-labelledby="career-title">
          <span className={`splatter ${styles.profileSplatter}`} aria-hidden="true" />
          <h2 id="career-title" className="title-spike">{t.coaches.career}</h2>
          <dl className={styles.statGrid}>
            {tiles.map(tile => (
                <div key={tile.label} className={styles.statTile}>
                  <dt className={styles.statLabel}>{tile.label}</dt>
                  <dd className={styles.statValue}>{tile.value}</dd>
                </div>
            ))}
          </dl>
        </section>

        <h2 className={`subhead ${styles.sectionHead}`}>{t.coaches.bySeason}</h2>
        {career.seasons.length === 0 ? (
            <div className={`card ${styles.emptyCard}`}><p className={styles.emptyText}>—</p></div>
        ) : (
            <div className="table-container">
              <div className="stars-bar" aria-hidden="true" />
              <table className={`data-table ${styles.roster}`}>
                <thead>
                <tr>
                  <th>{t.seasons.season}</th>
                  <th>{t.seasons.team}</th>
                  <th className="num">{t.coaches.position}</th>
                  <th className="num">{t.coaches.record}</th>
                  <th className="num">{t.coaches.points}</th>
                  <th className="num">{t.coaches.tdDiff}</th>
                  <th className="num">{t.coaches.casDiff}</th>
                  <th>{t.coaches.playoffs}</th>
                </tr>
                </thead>
                <tbody>
                {career.seasons.map(s => {
                  const tdDiff = s.td_for - s.td_against;
                  const casDiff = s.cas_for - s.cas_against;
                  return (
                      <tr key={`${s.season_id}-${s.team_id}`}>
                        <td>
                          {/* Apre classifica e calendario di quella stagione */}
                          <Link href="/standings" onClick={() => setSelectedSeasonId(s.season_id)} className={styles.nameLink}>
                            {s.season_name}
                          </Link>
                          <span className={styles.muted}>{s.season_status === 'active' ? t.seasons.active : t.seasons.completed}</span>
                        </td>
                        <td>
                          <Link
                              href={`/teams/${s.team_id}`}
                              className={styles.teamCell}
                              style={s.team_color ? ({ '--team-color': s.team_color } as CSSProperties) : undefined}
                          >
                            {s.team_logo
                                ? <img src={s.team_logo} alt="" className={styles.teamLogo} />
                                : <ShieldAlert size={30} className={styles.teamShield} />}
                            <span><span className={styles.teamName}>{s.team_name}</span><span className={styles.muted}>{s.team_race}</span></span>
                          </Link>
                        </td>
                        <td className="num">
                          <span className={styles.big}>{s.position ? `${s.position}°` : '—'}</span>
                          <span className={styles.inlineMuted}>/ {s.teams_in_season}</span>
                        </td>
                        <td className="num">{s.wins}-{s.draws}-{s.losses}</td>
                        <td className={`num ${styles.big}`}>{s.points}</td>
                        <td className={`num ${diffClass(tdDiff)}`}>{signed(tdDiff)}</td>
                        <td className={`num ${diffClass(casDiff)}`}>{signed(casDiff)}</td>
                        <td>
                          {s.playoff
                              ? finishTag[s.playoff]
                                  ? <span className={`${finishTag[s.playoff]} ${styles.finishTag}`}>{t.coaches.finish[s.playoff]}</span>
                                  : <span className={styles.finishPlain}>{t.coaches.finish[s.playoff]}</span>
                              : '—'}
                        </td>
                      </tr>
                  );
                })}
                </tbody>
              </table>
            </div>
        )}
      </div>
  );
}
