'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarRange, Plus, Trophy } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { useSeason } from '@/lib/SeasonContext';
import PageHeader from '@/components/brand/PageHeader';
import SectionTitle from '@/components/brand/SectionTitle';
import Shards from '@/components/brand/Shards';
import TapeStrip from '@/components/brand/TapeStrip';
import CoachPicker, { coachChoicePayload, emptyCoachChoice, isCoachChoiceComplete, type CoachChoice } from '@/components/CoachPicker';
import type { Coach, SeasonStatus, SeasonSummary, TeamOverview } from '@/lib/types';
import styles from './Seasons.module.css';

type WizardRow = { teamId: string; included: boolean; coach: CoachChoice };
type PreviousAction = 'pause' | 'cancel' | 'delete';

// Etichetta di stato: attiva rossa, conclusa navy, in pausa senape, annullata spenta e barrata
const STATUS_TAG: Record<SeasonStatus, string> = {
  active: 'tag tag-red',
  completed: 'tag tag-navy',
  paused: 'tag',
  cancelled: `tag ${styles.tagCancelled}`,
};

// Variante della card per gli stati non conclusi
const STATUS_CARD: Record<SeasonStatus, string> = {
  active: '',
  completed: '',
  paused: styles.seasonCardPaused,
  cancelled: styles.seasonCardCancelled,
};

const fill = (text: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce((acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)), text);

const formatDate = (value: string | null) => (value ? new Date(value.replace(' ', 'T') + 'Z').toLocaleDateString() : '—');
const pad = (n: number) => String(n).padStart(2, '0');

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
  // Stagione in corso senza campione: finestra per scegliere se metterla in pausa, annullarla o eliminarla
  const [decision, setDecision] = useState<{ name: string; pending: number } | null>(null);
  const [busySeasonId, setBusySeasonId] = useState<string | null>(null);

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
    if (!confirm(fill(t.seasons.confirmStart, { name, count: included.length }))) return;
    await submitNewSeason({});
  };

  const submitNewSeason = async (options: { force?: boolean; previous_action?: PreviousAction }) => {
    const included = rows.filter(r => r.included);
    const payload = {
      name: seasonName.trim() || `Season ${nextNumber}`,
      teams: included.map(r => ({ team_id: r.teamId, ...coachChoicePayload(r.coach) })),
      ...options,
    };
    const post = (body: typeof payload) => fetch('/api/seasons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    setSubmitting(true);
    try {
      let res = await post(payload);
      if (res.status === 409) {
        const conflict = await res.json().catch(() => null);
        if (conflict?.needs_decision) {
          // Nessun campione: decide l'utente nella finestra dedicata
          setDecision({ name: conflict.season_name, pending: conflict.pending_matches });
          return;
        }
        // Campione già proclamato ma partite ancora da giocare: basta una conferma
        if (!conflict?.incomplete || !confirm(`${conflict.error}\n\n${t.seasons.confirmIncomplete}`)) return;
        res = await post({ ...payload, force: true });
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.error || 'Failed to start new season');
        return;
      }
      await refreshSeasons();
      setSelectedSeasonId(data.id);
      setDecision(null);
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

  const chooseDecision = async (action: PreviousAction) => {
    if (!decision) return;
    if (action === 'delete' && !confirm(fill(t.seasons.confirmDelete, { name: decision.name }))) return;
    await submitNewSeason({ previous_action: action });
  };

  // Azioni sulla singola stagione (pausa, annullamento, ripresa, eliminazione)
  const changeStatus = async (season: SeasonSummary, action: 'pause' | 'cancel' | 'resume') => {
    const messages = { pause: t.seasons.confirmPause, cancel: t.seasons.confirmCancel, resume: t.seasons.confirmResume };
    if (!confirm(fill(messages[action], { name: season.name }))) return;

    const send = (pauseCurrent: boolean) => fetch(`/api/seasons/${season.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, pause_current: pauseCurrent }),
    });

    setBusySeasonId(season.id);
    try {
      let res = await send(false);
      if (res.status === 409) {
        const conflict = await res.json().catch(() => null);
        // Riprendere una stagione quando un'altra è in corso: quella in corso va in pausa
        if (!conflict?.active_exists) { alert(conflict?.error || 'Operation failed'); return; }
        if (!confirm(fill(t.seasons.confirmResumePauseCurrent, { name: season.name, current: conflict.active_name }))) return;
        res = await send(true);
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error || 'Operation failed');
        return;
      }
      await refreshSeasons();
    } finally {
      setBusySeasonId(null);
    }
  };

  const deleteSeason = async (season: SeasonSummary) => {
    if (!confirm(fill(t.seasons.confirmDelete, { name: season.name }))) return;
    setBusySeasonId(season.id);
    try {
      const res = await fetch(`/api/seasons/${season.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error || 'Failed to delete season');
        return;
      }
      await refreshSeasons();
    } finally {
      setBusySeasonId(null);
    }
  };

  const statusLabel: Record<SeasonStatus, string> = {
    active: t.seasons.active,
    completed: t.seasons.completed,
    paused: t.seasons.paused,
    cancelled: t.seasons.cancelled,
  };

  const viewSeason = (season: SeasonSummary) => {
    setSelectedSeasonId(season.id);
    router.push('/standings');
  };

  const includedCount = rows.filter(r => r.included).length;

  const activeSeason = seasons.find(s => s.status === 'active');
  const pastSeasons = seasons.filter(s => s.status !== 'active');

  // Parti condivise tra la fascia della stagione attiva e le card delle stagioni concluse
  const renderName = (season: SeasonSummary, className: string) => (
      renamingId === season.id ? (
          <form onSubmit={e => { e.preventDefault(); renameSeason(season); }} className={styles.inlineForm}>
            <input className={styles.input} value={renameValue} onChange={e => setRenameValue(e.target.value)} maxLength={60} required autoFocus aria-label={t.seasons.rename} />
            <button type="submit" className={`btn btn-primary ${styles.smallBtn}`}>OK</button>
            <button type="button" className={`btn ${styles.smallBtn}`} onClick={() => setRenamingId(null)}>✕</button>
          </form>
      ) : (
          <h2 className={className}>{season.name}</h2>
      )
  );

  const renderChampion = (season: SeasonSummary) => (
      <div className={`plate ${styles.champion}`}>
        <span className={styles.championLabel}><Trophy size={18} aria-hidden="true" /> {t.seasons.champion}</span>
        {season.champion ? (
            <>
              <Link href={`/teams/${season.champion.team_id}`} className={styles.championTeam}>{season.champion.team_name}</Link>
              {season.champion.coach_name && <span className={styles.championCoach}>{t.coachPicker.label}: {season.champion.coach_name}</span>}
            </>
        ) : <span className={styles.championNone}>{t.seasons.noChampion}</span>}
      </div>
  );

  const renderActions = (season: SeasonSummary) => (
      <div className={styles.cardActions}>
        <button className={`btn ${season.status === 'active' ? 'btn-gold' : 'btn-navy'} ${styles.smallBtn}`} onClick={() => viewSeason(season)}>
          {t.seasons.view}
        </button>
        {isAdmin && renamingId !== season.id && (
            <button className={`btn ${styles.smallBtn}`} onClick={() => { setRenamingId(season.id); setRenameValue(season.name); }}>
              {t.seasons.rename}
            </button>
        )}
        {isAdmin && season.status === 'active' && (
            <button className={`btn ${styles.smallBtn}`} disabled={busySeasonId === season.id} onClick={() => changeStatus(season, 'pause')}>
              {t.seasons.pause}
            </button>
        )}
        {isAdmin && (season.status === 'paused' || season.status === 'cancelled') && (
            <button className={`btn btn-gold ${styles.smallBtn}`} disabled={busySeasonId === season.id} onClick={() => changeStatus(season, 'resume')}>
              {t.seasons.resume}
            </button>
        )}
        {isAdmin && season.status !== 'cancelled' && (
            <button className={`btn btn-slate ${styles.smallBtn}`} disabled={busySeasonId === season.id} onClick={() => changeStatus(season, 'cancel')}>
              {t.seasons.cancelSeason}
            </button>
        )}
        {isAdmin && season.status !== 'completed' && (
            <button className={`btn btn-primary ${styles.smallBtn}`} disabled={busySeasonId === season.id} onClick={() => deleteSeason(season)}>
              {t.seasons.deleteSeason}
            </button>
        )}
      </div>
  );

  const progress = (season: SeasonSummary) =>
      season.matches_total > 0 ? Math.round((season.matches_played / season.matches_total) * 100) : 0;

  return (
      <div className={styles.page}>
        <PageHeader
            title={t.seasons.title}
            icon={<CalendarRange size={44} />}
            actions={isAdmin && !showWizard ? (
                <button className="btn btn-gold" onClick={openWizard}><Plus size={22} /> {t.seasons.newSeason}</button>
            ) : undefined}
        />

        {decision && (
            <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="decision-title">
              <div className={`card chamfer ${styles.modal}`}>
                <span className={styles.wizardMicro}><i className={styles.microSquares} aria-hidden="true" />{`${decision.name} // ${decision.pending}`}</span>
                <h2 id="decision-title" className="title-slab">{t.seasons.decisionTitle}</h2>
                <p className={styles.wizardIntro}>{fill(t.seasons.decisionText, { name: decision.name, pending: decision.pending })}</p>
                <div className={styles.decisionGrid}>
                  <button type="button" className={`chamfer ${styles.decisionBtn} ${styles.decisionPause}`} onClick={() => chooseDecision('pause')} disabled={submitting}>
                    <span className={styles.decisionNum} aria-hidden="true">01</span>
                    <span className={styles.decisionLabel}>{t.seasons.decisionPause}</span>
                    <span className={styles.decisionHint}>{t.seasons.decisionPauseHint}</span>
                  </button>
                  <button type="button" className={`chamfer ${styles.decisionBtn}`} onClick={() => chooseDecision('cancel')} disabled={submitting}>
                    <span className={styles.decisionNum} aria-hidden="true">02</span>
                    <span className={styles.decisionLabel}>{t.seasons.decisionCancel}</span>
                    <span className={styles.decisionHint}>{t.seasons.decisionCancelHint}</span>
                  </button>
                  <button type="button" className={`chamfer ${styles.decisionBtn} ${styles.decisionDanger}`} onClick={() => chooseDecision('delete')} disabled={submitting}>
                    <span className={styles.decisionNum} aria-hidden="true">03</span>
                    <span className={styles.decisionLabel}>{t.seasons.decisionDelete}</span>
                    <span className={styles.decisionHint}>{t.seasons.decisionDeleteHint}</span>
                  </button>
                </div>
                <div className={styles.wizardActions}>
                  <button type="button" className="btn" onClick={() => setDecision(null)} disabled={submitting}>{t.seasons.decisionBack}</button>
                </div>
              </div>
            </div>
        )}

        {showWizard && (
            <section className={`card chamfer ${styles.wizard}`} aria-labelledby="wizard-title">
              <span className={styles.wizardMicro}><i className={styles.microSquares} aria-hidden="true" />{`S${pad(nextNumber)} // Setup`}</span>
              <h2 id="wizard-title" className="title-slab">{t.seasons.wizardTitle}</h2>
              <p className={styles.wizardIntro}>{t.seasons.wizardIntro}</p>

              {/* Passo 1: nome della stagione */}
              <div className={styles.step}>
                <h3 className={styles.stepTitle}>
                  <span className={styles.stepNum} aria-hidden="true">01</span>
                  <span className={styles.stepText}>
                    <span className={styles.stepMicro}><i className={styles.microSquares} aria-hidden="true" />Step 01 // 03</span>
                    <label htmlFor="season-name">{t.seasons.seasonName}</label>
                  </span>
                </h3>
                <input id="season-name" className={styles.input} value={seasonName} maxLength={60} onChange={e => setSeasonName(e.target.value)} />
              </div>

              {/* Passo 2: squadre e allenatori */}
              <div className={styles.step}>
                <h3 className={styles.stepTitle}>
                  <span className={styles.stepNum} aria-hidden="true">02</span>
                  <span className={styles.stepText}>
                    <span className={styles.stepMicro}><i className={styles.microSquares} aria-hidden="true" />Step 02 // 03</span>
                    <span>{t.seasons.team} · {t.seasons.coach}</span>
                  </span>
                </h3>

                <div className={styles.bulk}>
                  <button type="button" className={`btn btn-gold ${styles.smallBtn}`} onClick={() => setRows(prev => prev.map(r => ({ ...r, included: true })))}>{t.seasons.selectAll}</button>
                  <button type="button" className={`btn ${styles.smallBtn}`} onClick={() => setRows(prev => prev.map(r => ({ ...r, included: false })))}>{t.seasons.selectNone}</button>
                </div>

                <div className={`table-container ${styles.teamsTableWrapper}`}>
                  <table className={`data-table ${styles.teamsTable}`}>
                    <thead>
                    <tr>
                      <th className={styles.colCheck}>{t.seasons.continues}</th>
                      <th>{t.seasons.team}</th>
                      <th>{t.seasons.lastCoach}</th>
                      <th className={styles.colCoach}>{t.seasons.coach}</th>
                    </tr>
                    </thead>
                    <tbody>
                    {teams.map(team => {
                      const row = rows.find(r => r.teamId === team.id);
                      if (!row) return null;
                      return (
                          <tr key={team.id} className={row.included ? '' : styles.rowOff}>
                            <td className={styles.cellCheck}>
                              <label className={styles.checkWrap}>
                                <input
                                    type="checkbox"
                                    className={styles.checkbox}
                                    checked={row.included}
                                    aria-label={`${t.seasons.continues}: ${team.name}`}
                                    onChange={e => updateRow(team.id, { included: e.target.checked })}
                                />
                              </label>
                            </td>
                            <td className={styles.cellTeam}>
                              <span className={styles.teamName}>{team.name}</span>
                              <span className={styles.muted}>{team.race}{team.last_season_name ? ` · ${team.last_season_name}` : ''}</span>
                            </td>
                            <td className={styles.cellLast} data-label={t.seasons.lastCoach}>{team.last_coach_name ?? '—'}</td>
                            <td className={styles.cellCoach}>
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
              </div>

              {/* Passo 3: conferma */}
              <div className={styles.step}>
                <h3 className={styles.stepTitle}>
                  <span className={styles.stepNum} aria-hidden="true">03</span>
                  <span className={styles.stepText}>
                    <span className={styles.stepMicro}><i className={styles.microSquares} aria-hidden="true" />Step 03 // 03</span>
                    <span>{t.seasons.start}</span>
                  </span>
                </h3>
                {includedCount === 0 && <p className={styles.note}>{t.seasons.noTeams}</p>}

                <div className={styles.wizardActions}>
                  <button type="button" className="btn" onClick={() => setShowWizard(false)} disabled={submitting}>{t.seasons.cancel}</button>
                  <button type="button" className="btn btn-primary" onClick={startSeason} disabled={submitting}>
                    {submitting ? '...' : `${t.seasons.start} (${includedCount})`}
                  </button>
                </div>
              </div>
            </section>
        )}

        {/* STAGIONE IN CORSO: fascia in evidenza */}
        {activeSeason && (
            <section className={`bleed ${styles.activeBand}`} aria-label={`${activeSeason.name} · ${t.seasons.active}`}>
              <Shards variant="band" className={styles.activeShards} />
              <span className={`ghost-text ${styles.ghostActive}`} aria-hidden="true">Season</span>

              <div className={styles.activeInner}>
                <div className={styles.activeNumWrap} aria-hidden="true">
                  <span className={styles.activeNumLabel}>Season</span>
                  <span className={styles.activeNum}>{pad(activeSeason.number)}</span>
                </div>

                <div className={styles.activeContent}>
                  <div className={styles.activeMicro}>
                    <span className={STATUS_TAG.active}>{statusLabel.active}</span>
                    <span>{`BBL // S${pad(activeSeason.number)} // Live`}</span>
                  </div>

                  {renderName(activeSeason, styles.activeName)}

                  <div className={styles.meter}>
                    <div className={styles.meterHead}>
                      <span>{t.seasons.matches}</span>
                      <strong>{activeSeason.matches_played}<small> / {activeSeason.matches_total}</small></strong>
                    </div>
                    <div className={styles.meterTrack} role="progressbar" aria-valuemin={0} aria-valuemax={activeSeason.matches_total} aria-valuenow={activeSeason.matches_played} aria-label={t.seasons.matches}>
                      <span className={styles.meterFill} style={{ width: `${progress(activeSeason)}%` }} />
                    </div>
                  </div>

                  <dl className={styles.activeFacts}>
                    <div>
                      <dt>{t.seasons.teams}</dt>
                      <dd>{activeSeason.teams_count}</dd>
                    </div>
                    <div>
                      <dt>{t.seasons.started}</dt>
                      <dd>{formatDate(activeSeason.started_at)}</dd>
                    </div>
                  </dl>

                  <div className={styles.activeBottom}>
                    {renderChampion(activeSeason)}
                    {renderActions(activeSeason)}
                  </div>
                </div>
              </div>

              <div className={styles.activeTape} aria-hidden="true">
                <TapeStrip tone="mustard" angle={-2} moving text={`${activeSeason.name} ✦ ${t.seasons.active}`} />
              </div>
            </section>
        )}

        {/* STAGIONI CONCLUSE */}
        {pastSeasons.length > 0 && (
            <section className={styles.pastSection}>
              <span className={`ghost-text ${styles.ghostPast}`} aria-hidden="true">Archive</span>
              <SectionTitle
                  index={activeSeason ? '01' : undefined}
                  micro={`${pastSeasons.length} // ${t.seasons.title}`}
                  title={pastSeasons.every(past => past.status === 'completed') ? t.seasons.completed : t.seasons.title}
              />

              <div className={styles.seasonList}>
                {pastSeasons.map(season => (
                    <div key={season.id} className="offset-frame">
                      <article className={`chamfer ${styles.seasonCard} ${STATUS_CARD[season.status]}`}>
                        <span className={styles.cardNum} aria-hidden="true">{pad(season.number)}</span>

                        <div className={styles.cardTop}>
                          <span className={styles.cardMicro}><i className={styles.microSquares} aria-hidden="true" />{`S${pad(season.number)}`}</span>
                          <span className={STATUS_TAG[season.status]}>{statusLabel[season.status]}</span>
                        </div>

                        {renderName(season, styles.seasonName)}

                        <dl className={styles.facts}>
                          <dt>{t.seasons.teams}</dt><dd>{season.teams_count}</dd>
                          <dt>{t.seasons.matches}</dt><dd>{season.matches_played} / {season.matches_total}</dd>
                          <dt>{t.seasons.started}</dt><dd>{formatDate(season.started_at)}</dd>
                          {season.ended_at && (<><dt>{t.seasons.ended}</dt><dd>{formatDate(season.ended_at)}</dd></>)}
                        </dl>

                        {renderChampion(season)}
                        {renderActions(season)}
                      </article>
                    </div>
                ))}
              </div>
            </section>
        )}
      </div>
  );
}
