'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarRange, Plus } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { useSeason } from '@/lib/SeasonContext';
import CoachPicker, { coachChoicePayload, emptyCoachChoice, isCoachChoiceComplete, type CoachChoice } from '@/components/CoachPicker';
import type { Coach, SeasonSummary, TeamOverview } from '@/lib/types';
import headerStyles from '../coaches/Coaches.module.css';
import styles from './Seasons.module.css';

type WizardRow = { teamId: string; included: boolean; coach: CoachChoice };

const formatDate = (value: string | null) => (value ? new Date(value.replace(' ', 'T') + 'Z').toLocaleDateString() : '—');

export default function SeasonsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
  const { seasons, refreshSeasons, setSelectedSeasonId } = useSeason();

  const [showWizard, setShowWizard] = useState(false);
  const [teams, setTeams] = useState<TeamOverview[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [rows, setRows] = useState<WizardRow[]>([]);
  const [seasonName, setSeasonName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // I contatori (partite giocate, campione) cambiano spesso: si ricaricano all'apertura della pagina
  useEffect(() => { refreshSeasons(); }, [refreshSeasons]);

  const nextNumber = (seasons[0]?.number ?? 0) + 1;

  const openWizard = async () => {
    const [teamsData, coachesData] = await Promise.all([
      fetch('/api/teams?scope=all').then(r => r.json()),
      fetch('/api/coaches?summary=0').then(r => r.json()),
    ]);
    const allTeams: TeamOverview[] = Array.isArray(teamsData) ? teamsData : [];
    setTeams(allTeams);
    setCoaches(Array.isArray(coachesData) ? coachesData : []);
    // Proposta iniziale: proseguono le squadre della stagione in corso, con lo stesso allenatore
    setRows(allTeams.map(team => ({
      teamId: team.id,
      included: team.in_active_season,
      coach: emptyCoachChoice(team.last_coach_id ?? ''),
    })));
    setSeasonName(`Season ${nextNumber}`);
    setShowWizard(true);
  };

  const updateRow = (teamId: string, patch: Partial<WizardRow>) =>
      setRows(prev => prev.map(r => (r.teamId === teamId ? { ...r, ...patch } : r)));

  const startSeason = async () => {
    const included = rows.filter(r => r.included);
    if (included.some(r => r.coach.isNew && !isCoachChoiceComplete(r.coach))) {
      alert(t.coachPicker.newCoachName);
      return;
    }
    const name = seasonName.trim() || `Season ${nextNumber}`;
    if (!confirm(t.seasons.confirmStart.replace('{name}', name).replace('{count}', String(included.length)))) return;

    const payload = {
      name,
      teams: included.map(r => ({ team_id: r.teamId, ...coachChoicePayload(r.coach) })),
    };
    const post = (force: boolean) => fetch('/api/seasons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, force }),
    });

    setSubmitting(true);
    try {
      let res = await post(false);
      if (res.status === 409) {
        // Stagione in corso con partite ancora da giocare: serve una conferma esplicita
        const data = await res.json().catch(() => null);
        if (!data?.incomplete || !confirm(`${data.error}\n\n${t.seasons.confirmIncomplete}`)) return;
        res = await post(true);
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.error || 'Failed to start new season');
        return;
      }
      await refreshSeasons();
      setSelectedSeasonId(data.id);
      setShowWizard(false);
      router.push('/teams');
    } catch {
      alert('Failed to start new season');
    } finally {
      setSubmitting(false);
    }
  };

  const renameSeason = async (season: SeasonSummary) => {
    const res = await fetch(`/api/seasons/${season.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: renameValue }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error || 'Failed to rename season');
      return;
    }
    setRenamingId(null);
    refreshSeasons();
  };

  const viewSeason = (season: SeasonSummary) => {
    setSelectedSeasonId(season.id);
    router.push('/standings');
  };

  const includedCount = rows.filter(r => r.included).length;

  return (
      <div>
        <div className={headerStyles.headerArea}>
          <h1 className={headerStyles.pageTitle}><CalendarRange size={48} /> {t.seasons.title}</h1>
          {isAdmin && !showWizard && (
              <button className="btn btn-primary" onClick={openWizard}><Plus size={22} /> {t.seasons.newSeason}</button>
          )}
        </div>

        {showWizard && (
            <section className={styles.wizard} aria-labelledby="wizard-title">
              <h2 id="wizard-title" className={styles.wizardTitle}>{t.seasons.wizardTitle}</h2>
              <p className={styles.wizardIntro}>{t.seasons.wizardIntro}</p>

              <label className={styles.label} htmlFor="season-name">{t.seasons.seasonName}</label>
              <input id="season-name" className={styles.input} value={seasonName} maxLength={60} onChange={e => setSeasonName(e.target.value)} />

              <div className={styles.teamsTableWrapper}>
                <table className={styles.teamsTable}>
                  <thead>
                  <tr>
                    <th style={{ width: '90px' }}>{t.seasons.continues}</th>
                    <th>{t.seasons.team}</th>
                    <th>{t.seasons.lastCoach}</th>
                    <th style={{ width: '38%' }}>{t.seasons.coach}</th>
                  </tr>
                  </thead>
                  <tbody>
                  {teams.map(team => {
                    const row = rows.find(r => r.teamId === team.id);
                    if (!row) return null;
                    return (
                        <tr key={team.id} className={row.included ? '' : styles.rowOff}>
                          <td>
                            <input
                                type="checkbox"
                                className={styles.checkbox}
                                checked={row.included}
                                aria-label={`${t.seasons.continues}: ${team.name}`}
                                onChange={e => updateRow(team.id, { included: e.target.checked })}
                            />
                          </td>
                          <td>
                            <span className={styles.teamName}>{team.name}</span>
                            <span className={styles.muted}>{team.race}{team.last_season_name ? ` · ${team.last_season_name}` : ''}</span>
                          </td>
                          <td>{team.last_coach_name ?? '—'}</td>
                          <td>
                            {row.included && (
                                <CoachPicker
                                    idPrefix={`wizard-coach-${team.id}`}
                                    coaches={coaches}
                                    value={row.coach}
                                    onChange={coach => updateRow(team.id, { coach })}
                                    allowNone
                                    selectClassName={styles.select}
                                    inputClassName={styles.input}
                                />
                            )}
                          </td>
                        </tr>
                    );
                  })}
                  </tbody>
                </table>
              </div>

              <div className={styles.bulk} style={{ marginBottom: '1rem' }}>
                <button type="button" onClick={() => setRows(prev => prev.map(r => ({ ...r, included: true })))}>{t.seasons.selectAll}</button>
                <button type="button" onClick={() => setRows(prev => prev.map(r => ({ ...r, included: false })))}>{t.seasons.selectNone}</button>
              </div>
              {includedCount === 0 && <p className={styles.note}>{t.seasons.noTeams}</p>}

              <div className={styles.wizardActions}>
                <button type="button" className="btn" onClick={() => setShowWizard(false)} disabled={submitting}>{t.seasons.cancel}</button>
                <button type="button" className="btn btn-primary" onClick={startSeason} disabled={submitting}>
                  {submitting ? '...' : `${t.seasons.start} (${includedCount})`}
                </button>
              </div>
            </section>
        )}

        <div className={styles.seasonList}>
          {seasons.map(season => {
            const isActive = season.status === 'active';
            return (
                <article key={season.id} className={`${styles.seasonCard} ${isActive ? styles.seasonCardActive : ''}`}>
                  <div className={styles.cardTop}>
                    <div>
                      <div className={styles.seasonNumber}>#{season.number}</div>
                      {renamingId === season.id ? (
                          <form onSubmit={e => { e.preventDefault(); renameSeason(season); }} className={headerStyles.inlineForm}>
                            <input className={styles.input} value={renameValue} onChange={e => setRenameValue(e.target.value)} maxLength={60} required autoFocus aria-label={t.seasons.rename} />
                            <button type="submit" className={`btn btn-primary ${styles.smallBtn}`}>OK</button>
                            <button type="button" className={`btn ${styles.smallBtn}`} onClick={() => setRenamingId(null)}>✕</button>
                          </form>
                      ) : (
                          <h2 className={styles.seasonName}>{season.name}</h2>
                      )}
                    </div>
                    <span className={`${styles.status} ${isActive ? styles.statusActive : styles.statusCompleted}`}>
                      {isActive ? t.seasons.active : t.seasons.completed}
                    </span>
                  </div>

                  <div className={styles.facts}>
                    <span className={styles.factLabel}>{t.seasons.teams}</span><span>{season.teams_count}</span>
                    <span className={styles.factLabel}>{t.seasons.matches}</span><span>{season.matches_played} / {season.matches_total}</span>
                    <span className={styles.factLabel}>{t.seasons.started}</span><span>{formatDate(season.started_at)}</span>
                    {season.ended_at && (<><span className={styles.factLabel}>{t.seasons.ended}</span><span>{formatDate(season.ended_at)}</span></>)}
                  </div>

                  <div className={styles.champion}>
                    🏆 {t.seasons.champion}:{' '}
                    {season.champion ? (
                        <>
                          <Link href={`/teams/${season.champion.team_id}`} style={{ color: 'var(--color-gold)' }}>{season.champion.team_name}</Link>
                          {season.champion.coach_name && <span className={styles.championCoach}>{t.coachPicker.label}: {season.champion.coach_name}</span>}
                        </>
                    ) : <span className={styles.championCoach} style={{ display: 'inline' }}>{t.seasons.noChampion}</span>}
                  </div>

                  <div className={styles.cardActions}>
                    <button className={`btn ${styles.smallBtn}`} onClick={() => viewSeason(season)}>
                      {t.seasons.view}
                    </button>
                    {isAdmin && renamingId !== season.id && (
                        <button className={`btn ${styles.smallBtn}`} onClick={() => { setRenamingId(season.id); setRenameValue(season.name); }}>
                          {t.seasons.rename}
                        </button>
                    )}
                  </div>
                </article>
            );
          })}
        </div>
      </div>
  );
}
