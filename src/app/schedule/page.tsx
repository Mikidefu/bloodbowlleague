'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Plus, ShieldAlert, Clock, Settings, Trash2, ChevronLeft, ChevronRight, Filter, Trophy, ArrowRight, Play } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { useSeason } from '@/lib/SeasonContext';
import { MATCH_TYPES, displayMatchType, isFinal, isLeagueMatch, isSemifinal } from '@/lib/matchTypes';
import type { Match, Team } from '@/lib/types';
import PageHeader from '@/components/brand/PageHeader';
import Shards from '@/components/brand/Shards';
import TapeStrip from '@/components/brand/TapeStrip';
import SectionTitle from '@/components/brand/SectionTitle';
import styles from './Schedule.module.css';

// Messaggio d'errore restituito dall'API, se presente
const errorMessage = async (res: Response, fallback: string) => {
  const data = await res.json().catch(() => null);
  return data?.error || fallback;
};

// Il colore squadra arriva dal DB: lo passiamo come variabile CSS e lo usiamo solo come anello del logo
const teamRing = (color: string | null | undefined) =>
  (color ? { '--team-color': color } : undefined) as React.CSSProperties | undefined;

const pad = (n: number) => String(n).padStart(2, '0');

export default function SchedulePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
  const { seasonQuery, seasonsLoading, isViewingActive, selectedSeason } = useSeason();
  // Le stagioni concluse sono in sola lettura anche per l'admin
  const canEdit = isAdmin && isViewingActive;
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  // --- STATO PER RESPONSIVE (solo per accorciare le etichette) ---
  const [isMobile, setIsMobile] = useState(false);

  // Add Match Modal State
  const [showAddMatch, setShowAddMatch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    home_team_id: '',
    away_team_id: '',
    round: 1,
    match_type: MATCH_TYPES.league as string,
    match_date: ''
  });

  // Auto-Generate Modal State
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateStartRound, setGenerateStartRound] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);

  // --- STATI PER FILTRO E PAGINAZIONE ---
  const [selectedTeamFilter, setSelectedTeamFilter] = useState('');
  // Giornata scelta con le frecce; null = scegli automaticamente la prima da giocare
  const [selectedRound, setSelectedRound] = useState<number | null>(null);

  // Listener per le dimensioni della finestra
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Partite e squadre della stagione consultata
  const fetchData = useCallback(async () => {
    if (seasonsLoading) return;
    try {
      const [matchesRes, teamsRes] = await Promise.all([
        fetch(`/api/schedule${seasonQuery}`),
        fetch(`/api/teams${seasonQuery}`)
      ]);
      const matchesData = await matchesRes.json();
      const teamsData = await teamsRes.json();
      setMatches(Array.isArray(matchesData) ? matchesData : []);
      setTeams(Array.isArray(teamsData) ? teamsData : []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data', err);
      setLoading(false);
    }
  }, [seasonQuery, seasonsLoading]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- RIVALRY CHECKER LOGIC ---
  // Andata e ritorno riguardano solo il campionato: amichevoli e playoff non contano
  const h2hMatches = matches.filter(m => isLeagueMatch(m.match_type) && (
      (m.home_team_id === form.home_team_id && m.away_team_id === form.away_team_id) ||
      (m.home_team_id === form.away_team_id && m.away_team_id === form.home_team_id)
  ));

  const playedHomeVsAway = h2hMatches.some(m => m.home_team_id === form.home_team_id && m.away_team_id === form.away_team_id);
  const playedAwayVsHome = h2hMatches.some(m => m.home_team_id === form.away_team_id && m.away_team_id === form.home_team_id);

  const bothLegsPlayed = playedHomeVsAway && playedAwayVsHome;
  const needsSwap = playedHomeVsAway && !playedAwayVsHome && form.home_team_id && form.away_team_id;

  useEffect(() => {
    if (bothLegsPlayed && form.match_type === MATCH_TYPES.league) {
      setForm(prev => ({ ...prev, match_type: MATCH_TYPES.friendly }));
    }
  }, [bothLegsPlayed, form.match_type]);

  const handleSwapTeams = () => {
    setForm(prev => ({
      ...prev,
      home_team_id: prev.away_team_id,
      away_team_id: prev.home_team_id
    }));
  };

  const handleAddMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.home_team_id === form.away_team_id) {
      alert("A team cannot play against itself!");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        setShowAddMatch(false);
        setForm({ home_team_id: '', away_team_id: '', round: 1, match_type: MATCH_TYPES.league, match_date: '' });
        fetchData();
      } else {
        alert(await errorMessage(res, "Failed to add match"));
      }
    } catch {
      alert("Error adding match");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateSchedule = async () => {
    if (!confirm(`Are you sure you want to generate the schedule starting from Round ${generateStartRound}?`)) return;
    setIsGenerating(true);
    try {
      const res = await fetch('/api/schedule/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_round: generateStartRound })
      });
      if (res.ok) {
        setShowGenerateModal(false);
        fetchData();
      } else {
        alert(await errorMessage(res, "Failed to generate schedule"));
      }
    } catch {
      alert("Error generating schedule");
    } finally {
      setIsGenerating(false);
    }
  };

  // --- PLAYOFF (Final Four) ---
  const leagueMatches = matches.filter(m => isLeagueMatch(m.match_type));
  const semifinals = matches.filter(m => isSemifinal(m.match_type));
  const finals = matches.filter(m => isFinal(m.match_type));
  const canStartPlayoffs = leagueMatches.length > 0 && leagueMatches.every(m => m.is_played)
      && semifinals.length === 0 && teams.length >= 4;
  const canGenerateFinals = semifinals.length === 2 && semifinals.every(m => m.is_played) && finals.length === 0;

  const handlePlayoffs = async (stage: 'semifinals' | 'finals') => {
    if (!confirm(stage === 'semifinals' ? t.schedule.confirmPlayoffs : t.schedule.confirmFinals)) return;
    setIsGenerating(true);
    try {
      const url = stage === 'semifinals' ? '/api/playoffs' : '/api/playoffs/finals';
      const post = (force = false) => fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force })
      });

      let res = await post();
      if (res.status === 409) {
        // Girone incompleto: il server chiede una conferma esplicita
        const data = await res.json().catch(() => null);
        if (!data?.incomplete || !confirm(`${data.error}\n\n${t.schedule.confirmIncompletePlayoffs}`)) return;
        res = await post(true);
      }

      if (res.ok) {
        setSelectedRound(null); // torna alla prima giornata da giocare, cioè quella appena creata
        fetchData();
      } else {
        alert(await errorMessage(res, 'Failed to generate playoffs'));
      }
    } catch {
      alert('Error generating playoffs');
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteMatch = async (id: string) => {
    if (!confirm("Delete this match? Stats will be lost.")) return;
    try {
      const res = await fetch(`/api/schedule/${id}`, { method: 'DELETE' });
      if (!res.ok) alert(await errorMessage(res, "Failed to delete match"));
      fetchData();
    } catch {
      alert("Error deleting match");
    }
  };

  const handleDeleteRound = async (round: number) => {
    if (!confirm(`ATTENZIONE! Vuoi davvero eliminare l'intero MATCHDAY ${round}?\nTutte le partite e le statistiche guadagnate dai giocatori in questo round andranno perdute per sempre.`)) return;
    try {
      const res = await fetch(`/api/schedule/round/${round}`, { method: 'DELETE' });
      if (!res.ok) alert(await errorMessage(res, "Failed to delete matchday"));
      setSelectedRound(null);
      fetchData();
    } catch {
      alert("Error deleting matchday");
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const filteredMatches = matches.filter(m =>
      selectedTeamFilter ? (m.home_team_id === selectedTeamFilter || m.away_team_id === selectedTeamFilter) : true
  );

  const groupedMatches = filteredMatches.reduce((acc: Record<number, Match[]>, match) => {
    const round = match.round || 0;
    if (!acc[round]) acc[round] = [];
    acc[round].push(match);
    return acc;
  }, {});

  const rounds = Object.keys(groupedMatches).map(Number).sort((a, b) => a - b);

  const firstIncompleteRound = rounds.find(r => groupedMatches[r].some(m => !m.is_played));
  const currentRound: number | null = selectedRound !== null && rounds.includes(selectedRound)
      ? selectedRound
      : (firstIncompleteRound ?? rounds[0] ?? null);

  const currentRoundIndex = currentRound !== null ? rounds.indexOf(currentRound) : -1;

  // Le giornate dei playoff vanno nella fascia rossa "Final Four"
  const isPlayoffRound = currentRound !== null
      && (groupedMatches[currentRound] ?? []).some(m => isSemifinal(m.match_type) || isFinal(m.match_type));

  if (loading) return <div className="loading-state">Loading Schedule...</div>;

  const seasonCode = `S${pad(selectedSeason?.number ?? 1)}`;
  const roundMatches = currentRound !== null ? groupedMatches[currentRound] ?? [] : [];
  const playedInRound = roundMatches.filter(m => m.is_played).length;
  const roundType = isPlayoffRound ? 'Playoffs' : displayMatchType(roundMatches[0]?.match_type);

  const renderTeam = (name: string, logo: string | null, color: string | null, side: 'home' | 'away') => (
      <div className={styles.team}>
        <div className={`team-crest ${styles.logoRing}`} style={teamRing(color)}>
          {logo
              ? <img src={logo} alt="" />
              : <ShieldAlert size={28} color={color ?? undefined} />}
        </div>
        <span className={styles.teamName} data-side={side}>{name}</span>
      </div>
  );

  const matchGrid = currentRound !== null && (
      <div className={styles.fixtureGrid}>
        {groupedMatches[currentRound]?.map(match => (
            <div key={match.id} className={`offset-frame ${styles.frame}`}>
              <article className={`chamfer ${styles.fixture} ${match.is_played ? styles.fixturePlayed : styles.fixtureUpcoming}`}>
                <div className={styles.fixtureMeta}>
                  <span className={styles.metaCode}>
                    <b>R{pad(match.round || 0)}</b> {'// '}{displayMatchType(match.match_type)}
                  </span>
                  <span className={`${styles.status} ${match.is_played ? styles.statusDone : styles.statusNext}`}>
                    {match.is_played ? 'COMPLETED' : 'UPCOMING'}
                  </span>
                </div>

                {match.match_date && (
                    <div className={styles.fixtureDate}>
                      <Clock size={14} aria-hidden="true" /> {formatDate(match.match_date)}
                    </div>
                )}

                <div className={styles.fixtureBody}>
                  {renderTeam(match.home_name, match.home_logo, match.home_color, 'home')}

                  {/* PUNTEGGIO O VS */}
                  <div className={styles.scoreCenter}>
                    {match.is_played ? (
                        <div className={styles.score}>
                          <span>{match.home_score}</span>
                          <i className={styles.scoreDash} aria-hidden="true">–</i>
                          <span>{match.away_score}</span>
                        </div>
                    ) : (
                        <div className={styles.vs}>VS</div>
                    )}
                  </div>

                  {renderTeam(match.away_name, match.away_logo, match.away_color, 'away')}
                </div>

                <div className={styles.fixtureActions}>
                  {canEdit && (
                      <button
                          type="button"
                          onClick={() => deleteMatch(match.id)}
                          className={`chamfer ${styles.iconBtn}`}
                          aria-label={t.schedule.deleteMatch}
                          title={t.schedule.deleteMatch}
                      >
                        <Trash2 size={18} />
                      </button>
                  )}
                  <button
                      type="button"
                      onClick={() => router.push(`/schedule/${match.id}`)}
                      className={`${styles.fixtureMain} ${!match.is_played && canEdit ? `chamfer ${styles.playBtn}` : styles.reportLink}`}
                  >
                    {!match.is_played && canEdit && <Play size={16} aria-hidden="true" />}
                    {match.is_played
                        ? (isMobile ? 'REPORT' : 'MATCH REPORT')
                        : canEdit ? (isMobile ? 'PLAY' : 'PLAY MATCH') : 'DETAILS'}
                    {!(!match.is_played && canEdit) && <ArrowRight size={16} aria-hidden="true" />}
                  </button>
                </div>
              </article>
            </div>
        ))}
      </div>
  );

  return (
      <div className={styles.page}>
        <PageHeader
            title={t.schedule.title}
            icon={<Calendar size={44} />}
            actions={canEdit ? (
                <>
                  {(canStartPlayoffs || canGenerateFinals) && (
                      <button
                          type="button"
                          className="btn btn-gold"
                          disabled={isGenerating}
                          onClick={() => handlePlayoffs(canStartPlayoffs ? 'semifinals' : 'finals')}
                      >
                        <Trophy size={20} /> {isGenerating ? t.schedule.generating : canStartPlayoffs ? t.schedule.startFinalFour : t.schedule.generateFinals}
                      </button>
                  )}
                  <button type="button" className="btn btn-slate" onClick={() => setShowGenerateModal(true)}>
                    <Settings size={20} /> {isMobile ? 'GENERATE' : 'AUTO-GENERATE'}
                  </button>
                  <button type="button" className="btn" onClick={() => setShowAddMatch(true)}>
                    <Plus size={20} /> {isMobile ? 'MATCH' : 'ADD MATCH'}
                  </button>
                </>
            ) : undefined}
        />

        {/* BARRA FILTRO SQUADRE */}
        <div className={styles.filterBar}>
          <span className={styles.filterCode} aria-hidden="true">
            <i className={styles.filterSquares} />{`${seasonCode} // ${pad(teams.length)} TEAMS`}
          </span>
          <label htmlFor="schedule-team-filter" className={styles.filterLabel}>
            <Filter size={18} aria-hidden="true" /> FILTER:
          </label>
          <select
              id="schedule-team-filter"
              value={selectedTeamFilter}
              onChange={e => setSelectedTeamFilter(e.target.value)}
              className={styles.filterSelect}
          >
            <option value="">-- ALL TEAMS --</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {/* NASTRO DI SEPARAZIONE */}
        <div className={`bleed ${styles.tapeWrap}`}>
          <TapeStrip
              tone={isPlayoffRound ? 'mustard' : 'red'}
              angle={-1.6}
              moving={false}
              text={currentRound !== null ? `Matchday ${pad(currentRound)} ✦ ${roundType}` : `Blood Bowl League ✦ ${t.schedule.title}`}
          />
        </div>

        {/* AUTO-GENERATE MODAL */}
        {showGenerateModal && (
            <div className={styles.modalOverlay}>
              <div className={`card ${styles.modal}`} role="dialog" aria-modal="true" aria-labelledby="generate-title">
                <h2 id="generate-title" className="title-slab">Generate Schedule</h2>
                <p className={styles.modalText}>Round-Robin schedule for all active teams.</p>

                <div className={styles.field}>
                  <label htmlFor="generate-start-round" className={styles.fieldLabel}>START FROM ROUND</label>
                  <input
                      id="generate-start-round"
                      type="number"
                      min="1"
                      value={generateStartRound}
                      onChange={e => setGenerateStartRound(Number(e.target.value))}
                      className={styles.fieldInput}
                  />
                </div>

                <div className={styles.modalActions}>
                  <button type="button" className={`btn ${styles.cancelBtn}`} onClick={() => setShowGenerateModal(false)}>CANCEL</button>
                  <button type="button" className={`btn btn-primary ${styles.confirmBtn}`} onClick={handleGenerateSchedule} disabled={isGenerating}>
                    {isGenerating ? '...' : 'GENERATE'}
                  </button>
                </div>
              </div>
            </div>
        )}

        {/* ADD MATCH MODAL */}
        {showAddMatch && (
            <div className={styles.modalOverlay}>
              <div className={`card ${styles.modal} ${styles.modalWide}`} role="dialog" aria-modal="true" aria-labelledby="add-match-title">
                <h2 id="add-match-title" className="title-slab">SCHEDULE FIXTURE</h2>

                <form onSubmit={handleAddMatch} className={styles.form}>
                  <div className={styles.formRow}>
                    <div className={styles.field}>
                      <label htmlFor="add-round" className={styles.fieldLabel}>ROUND</label>
                      <input id="add-round" type="number" min="1" required value={form.round} onChange={e => setForm({...form, round: parseInt(e.target.value) || 1})} className={styles.fieldInput} />
                    </div>
                    <div className={`${styles.field} ${styles.fieldWide}`}>
                      <label htmlFor="add-date" className={styles.fieldLabel}>DATE & TIME</label>
                      <input id="add-date" type="datetime-local" value={form.match_date} onChange={e => setForm({...form, match_date: e.target.value})} className={styles.fieldInput} />
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="add-home" className={styles.fieldLabel}>HOME TEAM</label>
                    <select id="add-home" required value={form.home_team_id} onChange={e => setForm({...form, home_team_id: e.target.value})} className={styles.fieldInput}>
                      <option value="">Select Team...</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>

                  <div className={styles.formVs} aria-hidden="true">VS</div>

                  <div className={styles.field}>
                    <label htmlFor="add-away" className={styles.fieldLabel}>AWAY TEAM</label>
                    <select id="add-away" required value={form.away_team_id} onChange={e => setForm({...form, away_team_id: e.target.value})} className={styles.fieldInput}>
                      <option value="">Select Team...</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>

                  {form.home_team_id && form.away_team_id && (
                      <div className={styles.rivalryNote}>
                        {bothLegsPlayed ? (
                            <div className={styles.noteDanger}>H/A legs played! Friendly forced.</div>
                        ) : needsSwap ? (
                            <div className={styles.noteSwap}>
                              <span className={styles.noteWarning}>Fixture already played!</span>
                              <button type="button" onClick={handleSwapTeams} className={`btn btn-slate ${styles.swapBtn}`}>SWAP H/A</button>
                            </div>
                        ) : (
                            <div className={styles.noteOk}>✓ Matchup is valid.</div>
                        )}
                      </div>
                  )}

                  <div className={styles.field}>
                    <label htmlFor="add-type" className={styles.fieldLabel}>MATCH TYPE</label>
                    <select
                        id="add-type"
                        value={form.match_type}
                        onChange={e => setForm({...form, match_type: e.target.value})}
                        className={styles.fieldInput}
                        disabled={bothLegsPlayed}
                    >
                      <option value={MATCH_TYPES.league}>League Match</option>
                      <option value={MATCH_TYPES.playoff}>Playoff / Tournament</option>
                      <option value={MATCH_TYPES.friendly}>Friendly Match</option>
                    </select>
                  </div>

                  <div className={styles.modalActions}>
                    <button type="button" className={`btn ${styles.cancelBtn}`} onClick={() => setShowAddMatch(false)}>CANCEL</button>
                    <button type="submit" className={`btn btn-primary ${styles.confirmBtn}`} disabled={isSubmitting}>
                      {isSubmitting ? '...' : 'SCHEDULE'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
        )}

        {/* GIORNATE: NAVIGAZIONE, ELIMINA ROUND E PARTITE */}
        {rounds.length === 0 || currentRound === null || !groupedMatches[currentRound] ? (
            <section className={`bleed ${styles.band}`}>
              <span className={`ghost-text on-light ${styles.ghost}`} aria-hidden="true">Fixtures</span>
              <div className={`chamfer ${styles.emptyState}`}>
                <span className={styles.emptyCode}>{`${seasonCode} // 00 FIXTURES`}</span>
                <p className={styles.emptyText}>NO MATCHES FOUND</p>
              </div>
            </section>
        ) : (
            <section className={`bleed ${styles.band} ${isPlayoffRound ? styles.bandPlayoff : ''}`}>
              {isPlayoffRound && <Shards variant="band" className={styles.bandShards} />}
              <span className={`ghost-text ${isPlayoffRound ? '' : 'on-light'} ${styles.ghost}`} aria-hidden="true">
                {isPlayoffRound ? 'Final Four' : 'Matchday'}
              </span>

              <div className={styles.inner}>
                {/* STRISCIA NUMERATA DELLA GIORNATA */}
                <div className={styles.roundNav}>
                  <button
                      type="button"
                      onClick={() => setSelectedRound(rounds[currentRoundIndex - 1])}
                      disabled={currentRoundIndex <= 0}
                      className={`chamfer ${styles.navBtn} ${styles.navPrev}`}
                      aria-label="Previous round"
                  >
                    <ChevronLeft size={32} />
                  </button>

                  <h2 className={styles.roundHeading}>
                    <span className={styles.roundLabel}>DAY</span>
                    <span className={styles.roundNumber}>{pad(currentRound)}</span>
                  </h2>

                  <div className={styles.roundInfo}>
                    <span className={styles.roundMicro}>
                      <i className={styles.filterSquares} aria-hidden="true" />
                      {`R${pad(currentRound)} // ${roundType} // ${seasonCode}`}
                    </span>
                    <span className={styles.roundStats}>
                      <b>{pad(roundMatches.length)}</b> fixtures <span aria-hidden="true">/</span> <b>{pad(playedInRound)}</b> played
                    </span>
                    <span className={styles.roundTicks} aria-hidden="true">
                      {rounds.map(r => (
                          <i
                              key={r}
                              className={`${r === currentRound ? styles.tickCurrent : ''} ${groupedMatches[r].every(m => m.is_played) ? styles.tickDone : ''}`}
                          />
                      ))}
                    </span>
                  </div>

                  {canEdit && (
                      <button
                          type="button"
                          onClick={() => handleDeleteRound(currentRound)}
                          className={`chamfer ${styles.roundDelete}`}
                          title={`Elimina Round ${currentRound}`}
                          aria-label={`Elimina Round ${currentRound}`}
                      >
                        <Trash2 size={20} />
                      </button>
                  )}

                  <button
                      type="button"
                      onClick={() => setSelectedRound(rounds[currentRoundIndex + 1])}
                      disabled={currentRoundIndex >= rounds.length - 1}
                      className={`chamfer ${styles.navBtn} ${styles.navNext}`}
                      aria-label="Next round"
                  >
                    <ChevronRight size={32} />
                  </button>
                </div>

                {isPlayoffRound && (
                    <div className={styles.playoffTitle}>
                      <SectionTitle
                          micro={`${seasonCode} // Knockout stage`}
                          title="Final Four"
                          action={<Trophy size={48} className={styles.playoffTrophy} aria-hidden="true" />}
                      />
                    </div>
                )}

                {matchGrid}
              </div>
            </section>
        )}
      </div>
  );
}
