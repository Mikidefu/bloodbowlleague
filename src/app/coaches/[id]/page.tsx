'use client';
import { use, useCallback, useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { ShieldAlert, Trophy, UserRound } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { useSeason } from '@/lib/SeasonContext';
import PageHeader from '@/components/brand/PageHeader';
import SectionTitle from '@/components/brand/SectionTitle';
import Shards from '@/components/brand/Shards';
import type { CoachCareer } from '@/lib/coaches';
import type { PlayoffFinish } from '@/lib/standings';
import type { SeasonStatus } from '@/lib/types';
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

// Iniziali per lo stemma del ritratto
const initials = (name: string) =>
    name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();

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
        <div className={styles.page}>
          <PageHeader title={t.coaches.title} icon={<UserRound size={44} />} />
          <div className={`chamfer ${styles.emptyCard}`}><p className={styles.emptyText}>{t.coaches.notFound}</p></div>
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

  // Stato della stagione come etichetta del brand: in pausa senape, annullata spenta e barrata
  const statusLabel: Record<SeasonStatus, string> = {
    active: t.seasons.active,
    completed: t.seasons.completed,
    paused: t.seasons.paused,
    cancelled: t.seasons.cancelled,
  };
  const statusTag: Record<SeasonStatus, string> = {
    active: 'tag tag-red',
    completed: 'tag tag-navy',
    paused: 'tag',
    cancelled: `tag ${styles.tagCancelled}`,
  };

  const diffClass = (n: number) => (n > 0 ? styles.positive : n < 0 ? styles.negative : '');

  // Stagione più recente: colore squadra per la tinta del ritratto e righe della scheda
  const latest = [...career.seasons].sort((a, b) => b.season_number - a.season_number)[0];
  const accent = { '--team-accent': latest?.team_color || 'var(--bb-red)' } as CSSProperties;

  const plates = [
    { label: t.coaches.record, value: `${totals.wins}-${totals.draws}-${totals.losses}` },
    { label: t.coaches.winRate, value: totals.played ? `${totals.win_rate}%` : '—' },
    { label: t.coaches.points, value: totals.points },
    { label: t.coaches.titles, value: totals.titles },
  ];

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
      <div className={styles.page} style={accent}>
        <PageHeader
            title={career.name}
            kicker={t.coachPicker.label}
            icon={<UserRound size={44} />}
            actions={adminActions}
        />

        {/* SCHEDA PERSONAGGIO */}
        <section className={`bleed ${styles.profileBand}`} aria-labelledby="coach-profile-name">
          <Shards variant="header" className={styles.profileShards} />
          <span className={`ghost-text ${styles.ghostProfile}`} aria-hidden="true">{t.coachPicker.label}</span>

          <div className={styles.profileInner}>
            <div className={styles.portrait}>
              <span className={styles.portraitShard} aria-hidden="true" />
              <span className={styles.portraitCount} aria-hidden="true">{String(totals.seasons).padStart(2, '0')}</span>
              <span className={styles.portraitMicro} aria-hidden="true">{`${t.coaches.seasons} // ${totals.teams} ${t.coaches.teams}`}</span>

              <span className={styles.badge} aria-hidden="true">
                <span className={styles.badgeInitials}>{initials(career.name) || <UserRound size={96} />}</span>
              </span>

              {latest && (
                  <Link href={`/teams/${latest.team_id}`} className={`chamfer ${styles.portraitTeam}`}>
                    {latest.team_logo
                        ? <span className={`team-crest ${styles.portraitTeamLogo}`}><img src={latest.team_logo} alt="" /></span>
                        : <ShieldAlert size={28} aria-hidden="true" />}
                    <span>
                      <small>{t.coaches.current}</small>
                      <strong>{latest.team_name}</strong>
                    </span>
                  </Link>
              )}
            </div>

            <div className={styles.dossier}>
              <span className={styles.micro}>
                <i className={styles.microSquares} aria-hidden="true" />
                {`${t.coachPicker.label} // ${t.coaches.career}`}
              </span>
              <h2 id="coach-profile-name" className={styles.dossierName}>{career.name}</h2>

              <dl className={styles.labelRows}>
                <div className={styles.labelRow}>
                  <dt className={`chamfer ${styles.labelChip}`}>{t.seasons.team}</dt>
                  <dd className={styles.labelValue}>
                    {latest ? <Link href={`/teams/${latest.team_id}`} className={styles.profileLink}>{latest.team_name}</Link> : '—'}
                  </dd>
                </div>
                <div className={styles.labelRow}>
                  <dt className={`chamfer ${styles.labelChip}`}>{t.seasons.season}</dt>
                  <dd className={styles.labelValue}>
                    {latest ? (
                        <>
                          {latest.season_name}{' '}
                          <span className={`${statusTag[latest.season_status]} ${styles.labelTag}`}>
                            {statusLabel[latest.season_status]}
                          </span>
                        </>
                    ) : '—'}
                  </dd>
                </div>
                <div className={styles.labelRow}>
                  <dt className={`chamfer ${styles.labelChip}`}>{t.draft.race}</dt>
                  <dd className={styles.labelValue}>{latest ? latest.team_race : '—'}</dd>
                </div>
                <div className={styles.labelRow}>
                  <dt className={`chamfer ${styles.labelChip}`}>{t.coaches.seasons}</dt>
                  <dd className={styles.labelValue}>{totals.seasons}</dd>
                </div>
                <div className={styles.labelRow}>
                  <dt className={`chamfer ${styles.labelChip}`}>{t.coaches.teams}</dt>
                  <dd className={styles.labelValue}>{totals.teams}</dd>
                </div>
              </dl>
            </div>
          </div>

          <ul className={styles.plates}>
            {plates.map(p => (
                <li key={p.label} className={`plate ${styles.plateItem}`}>
                  <span className={styles.plateValue}>{p.value}</span>
                  <span className={styles.plateLabel}>{p.label}</span>
                </li>
            ))}
          </ul>
        </section>

        {/* 01 · CARRIERA */}
        <section className={styles.careerSection} aria-labelledby="career-title">
          <span className={`ghost-text ${styles.ghostCareer}`} aria-hidden="true">Career</span>
          <div className={styles.careerHead} id="career-title">
            <SectionTitle index="01" micro={`${t.coachPicker.label} // ${career.name}`} title={t.coaches.career} />
          </div>
          <dl className={styles.statGrid}>
            {tiles.map(tile => (
                <div key={tile.label} className={`chamfer ${styles.statTile}`}>
                  <dt className={styles.statLabel}>{tile.label}</dt>
                  <dd className={styles.statValue}>{tile.value}</dd>
                </div>
            ))}
          </dl>
        </section>

        {/* 02 · STAGIONE PER STAGIONE */}
        <section className={`bleed ${styles.seasonsBand}`}>
          <span className={`ghost-text on-light ${styles.ghostSeasons}`} aria-hidden="true">Seasons</span>
          <div className={styles.inner}>
            <SectionTitle index="02" on="light" micro={`${career.seasons.length} ${t.coaches.seasons}`} title={t.coaches.bySeason} />
            {career.seasons.some(s => !s.counts_in_career) && (
                <p className={styles.notCountedNote}><span className={`tag ${styles.tagCancelled}`}>{t.seasons.cancelled}</span>{t.coaches.notCounted}</p>
            )}

            {career.seasons.length === 0 ? (
                <div className={`chamfer ${styles.emptyCard}`}><p className={styles.emptyText}>—</p></div>
            ) : (
                <div className={`offset-frame ${styles.tableFrame}`}>
                  <div className={`table-container chamfer ${styles.tableWrap}`}>
                    <div className={styles.tableStrip} aria-hidden="true">
                      <span><i className={styles.microSquares} />{career.name}</span>
                      <span className={styles.tableStripMeta}>{t.coaches.bySeason}</span>
                    </div>
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
                            <tr key={`${s.season_id}-${s.team_id}`} className={s.counts_in_career ? undefined : styles.notCounted}>
                              <td>
                                {/* Apre classifica e calendario di quella stagione */}
                                <Link href="/standings" onClick={() => setSelectedSeasonId(s.season_id)} className={styles.nameLink}>
                                  {s.season_name}
                                </Link>
                                {s.season_status === 'active' || s.season_status === 'completed'
                                    ? <span className={styles.muted}>{statusLabel[s.season_status]}</span>
                                    : <span className={`${statusTag[s.season_status]} ${styles.statusTag}`}>{statusLabel[s.season_status]}</span>}
                              </td>
                              <td>
                                <Link
                                    href={`/teams/${s.team_id}`}
                                    className={styles.teamCell}
                                    style={s.team_color ? ({ '--team-color': s.team_color } as CSSProperties) : undefined}
                                >
                                  {s.team_logo
                                      ? <span className={`team-crest ${styles.teamLogo}`}><img src={s.team_logo} alt="" /></span>
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
                </div>
            )}
          </div>
        </section>
      </div>
  );
}
