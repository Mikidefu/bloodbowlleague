'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, RefreshCw, Trophy, Trash2, ShieldAlert, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import styles from './Schedule.module.css';

export default function SchedulePage() {
  const { t } = useLanguage();
  const [matches, setMatches] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Paginator State
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);

  // Manual Match State
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState({ round: 1, homeId: '', awayId: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [scheduleRes, teamsRes] = await Promise.all([
        fetch('/api/schedule'),
        fetch('/api/teams')
      ]);
      const scheduleData = await scheduleRes.json();
      const teamsData = await teamsRes.json();

      setTeams(teamsData);

      // Raggruppa per Round (Giornata)
      const grouped = scheduleData.reduce((acc: any, match: any) => {
        const r = match.round;
        if (!acc[r]) acc[r] = [];
        acc[r].push(match);
        return acc;
      }, {});

      const formatted = Object.keys(grouped).map(r => ({
        round: parseInt(r),
        matches: grouped[r]
      })).sort((a, b) => a.round - b.round);

      setMatches(formatted);

      if (formatted.length > 0) {
        // Auto-imposta il form manuale alla giornata più alta
        const maxRound = Math.max(...formatted.map(f => f.round));
        setManualForm(prev => ({ ...prev, round: maxRound }));

        // Trova la prima giornata con partite da giocare per la Paginazione
        const activeIndex = formatted.findIndex(r => r.matches.some((m: any) => !m.is_played));
        setCurrentRoundIndex(activeIndex !== -1 ? activeIndex : formatted.length - 1);
      }

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAutoFill = async () => {
    if (!confirm(t.schedule.confirmGenerate || 'Auto-fill remainder?')) return;

    setGenerating(true);
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'auto-fill' })
      });
      if (res.ok) {
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to generate schedule');
      }
    } catch (e) {
      alert('Error generating schedule');
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (manualForm.homeId === manualForm.awayId) {
      alert("A team cannot play itself!");
      return;
    }

    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'manual',
          round: manualForm.round,
          home_team_id: manualForm.homeId,
          away_team_id: manualForm.awayId
        })
      });

      if (res.ok) {
        setShowManualForm(false);
        setManualForm({...manualForm, homeId: '', awayId: ''});
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || 'Error creating match');
      }
    } catch (err) {
      alert('Error creating match');
    }
  };

  const handleDeleteMatch = async (matchId: string, isPlayed: boolean) => {
    const msg = isPlayed ? t.schedule.confirmDeletePlayed : t.schedule.confirmDeleteUnplayed;
    if (!confirm(msg || 'Are you sure you want to delete this match?')) return;
    try {
      const res = await fetch(`/api/schedule/${matchId}/delete`, { method: 'DELETE' });
      if (res.ok) {
        fetchData();
      } else {
        alert('Failed to delete match');
      }
    } catch (err) {
      alert('Error deleting match');
    }
  };

  const handlePlayoffs = async () => {
    if (!confirm(t.schedule.confirmPlayoffs)) return;
    try {
      await fetch('/api/playoffs', { method: 'POST' });
      fetchData();
    } catch (e) {
      alert('Error starting playoffs');
    }
  };

  const handleFinals = async () => {
    if (!confirm(t.schedule.confirmFinals)) return;
    try {
      await fetch('/api/playoffs/finals', { method: 'POST' });
      fetchData();
    } catch (e) {
      alert('Error starting finals');
    }
  };

  if (loading) return <div style={{ fontFamily: 'var(--font-typewriter)', fontSize: '1.5rem', textAlign: 'center', marginTop: '4rem' }}>Consulting the League Commissioner...</div>;

  const isRegularSeasonComplete = matches.length > 0 && matches.every(r => r.matches.every((m: any) => m.is_played || m.match_type !== 'Regular Season'));
  const hasPlayoffs = matches.some(r => r.matches.some((m: any) => m.match_type.includes('Semifinal')));

  const areSemifinalsComplete = hasPlayoffs && matches.some(r => r.matches.some((m: any) => m.match_type.includes('Semifinal') && m.is_played));
  const hasFinals = matches.some(r => r.matches.some((m: any) => m.match_type.includes('Final')));

  const currentRoundData = matches[currentRoundIndex];

  return (
      <div>
        {/* HEADER AGGRESSIVO */}
        <div className={styles.headerArea}>
          <h1 className={styles.pageTitle}>
            <Calendar size={48} color="var(--color-blood-bright)" />
            {t.schedule.title}
          </h1>
          <div className={styles.actionBar}>
            {isRegularSeasonComplete && !hasPlayoffs && (
                <button className="btn" style={{ borderColor: '#b8860b', color: '#b8860b' }} onClick={handlePlayoffs}>
                  <Trophy size={20} /> {t.schedule.startFinalFour}
                </button>
            )}
            {areSemifinalsComplete && !hasFinals && (
                <button className="btn-primary" onClick={handleFinals}>
                  <Trophy size={20} /> {t.schedule.generateFinals}
                </button>
            )}
            <button className="btn" onClick={() => setShowManualForm(!showManualForm)}>
              <Calendar size={20} /> + Match
            </button>
            <button className="btn btn-primary" onClick={handleAutoFill} disabled={generating}>
              <RefreshCw size={20} className={generating ? "spin" : ""} />
              {generating ? t.schedule.generating : "Auto-Fill All"}
            </button>
          </div>
        </div>

        {/* FORM MANUALE (Dossier Style) */}
        {showManualForm && (
            <div className={styles.manualFormCard}>
              <h3 style={{ fontFamily: 'var(--font-impact)', fontSize: '2rem', margin: 0, color: 'var(--color-blood-bright)' }}>ADD CUSTOM MATCH</h3>
              <form onSubmit={handleCreateManual} className={styles.formGrid}>
                <div style={{ flex: 1 }}>
                  <label className={styles.formLabel}>MATCHDAY / ROUND</label>
                  <input type="number" min="1" required value={manualForm.round} onChange={e => setManualForm({...manualForm, round: parseInt(e.target.value) || 1})} className={styles.formInput} />
                </div>
                <div style={{ flex: 2 }}>
                  <label className={styles.formLabel}>HOME TEAM</label>
                  <select required value={manualForm.homeId} onChange={e => setManualForm({...manualForm, homeId: e.target.value})} className={styles.formInput}>
                    <option value="">Select Team...</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div style={{ flex: 2 }}>
                  <label className={styles.formLabel}>AWAY TEAM</label>
                  <select required value={manualForm.awayId} onChange={e => setManualForm({...manualForm, awayId: e.target.value})} className={styles.formInput}>
                    <option value="">Select Team...</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <button type="submit" className="btn btn-primary" style={{ padding: '1rem 2rem' }}>SAVE</button>
              </form>
            </div>
        )}

        {matches.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '5rem' }}>
              <h2 style={{ fontFamily: 'var(--font-impact)', fontSize: '3rem', marginBottom: '1rem' }}>{t.schedule.noScheduleTitle}</h2>
              <p style={{ fontFamily: 'var(--font-typewriter)', fontSize: '1.2rem', marginBottom: '2rem' }}>{t.schedule.noScheduleDesc}</p>
              <button className="btn btn-primary" onClick={handleAutoFill}>{t.schedule.generateRoundRobin}</button>
            </div>
        ) : (
            <>
              {/* PAGINAZIONE TATTICA */}
              <div className={styles.paginationBar}>
                <button
                    className={styles.pageBtn}
                    disabled={currentRoundIndex === 0}
                    onClick={() => setCurrentRoundIndex(prev => prev - 1)}
                >
                  <ChevronLeft size={28} />
                </button>

                <select
                    className={styles.roundSelect}
                    value={currentRoundIndex}
                    onChange={e => setCurrentRoundIndex(Number(e.target.value))}
                >
                  {matches.map((r, idx) => (
                      <option key={r.round} value={idx}>
                        {r.matches[0].match_type === 'Regular Season' ? `MATCHDAY ${r.round}` : r.matches[0].match_type}
                      </option>
                  ))}
                </select>

                <button
                    className={styles.pageBtn}
                    disabled={currentRoundIndex === matches.length - 1}
                    onClick={() => setCurrentRoundIndex(prev => prev + 1)}
                >
                  <ChevronRight size={28} />
                </button>
              </div>

              {/* LISTA MATCH (TICKET DELLO SCONTRO) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {currentRoundData?.matches.map((match: any) => (
                    <div key={match.id} className={styles.matchCard}>

                      {/* Texture Colori Squadre */}
                      <div className={styles.cardBgHome} style={{ backgroundColor: match.home_color }}></div>
                      <div className={styles.cardBgAway} style={{ backgroundColor: match.away_color }}></div>

                      {/* SQUADRA CASA */}
                      <div className={`${styles.teamSide} ${styles.homeSide}`}>
                        <span className={styles.teamName} style={{ color: match.home_color }}>{match.home_name}</span>
                        <div className={styles.logoWrapper} style={{ borderColor: match.home_color }}>
                          {match.home_logo ? (
                              <img src={match.home_logo} alt={match.home_name} className={styles.logoImage} />
                          ) : (
                              <ShieldAlert size={40} color={match.home_color} />
                          )}
                        </div>
                      </div>

                      {/* CENTRO: SCORE O VS */}
                      <div className={styles.scoreCenter}>
                        {match.is_played ? (
                            <>
                              <div className={styles.scoreBox}>
                                <span className={styles.scoreNum}>{match.home_score}</span>
                                <span className={styles.scoreDash}>-</span>
                                <span className={styles.scoreNum}>{match.away_score}</span>
                              </div>
                              <Link href={`/schedule/${match.id}`} className={styles.detailsLink}>
                                {t.schedule.viewDetails}
                              </Link>
                            </>
                        ) : (
                            <>
                              <div className={styles.vsBadge}>VS</div>
                              <Link href={`/schedule/${match.id}`} className={styles.playBtn}>
                                {t.schedule.playMatch}
                              </Link>
                            </>
                        )}
                      </div>

                      {/* SQUADRA TRASFERTA */}
                      <div className={`${styles.teamSide} ${styles.awaySide}`}>
                        <div className={styles.logoWrapper} style={{ borderColor: match.away_color }}>
                          {match.away_logo ? (
                              <img src={match.away_logo} alt={match.away_name} className={styles.logoImage} />
                          ) : (
                              <ShieldAlert size={40} color={match.away_color} />
                          )}
                        </div>
                        <span className={styles.teamName} style={{ color: match.away_color }}>{match.away_name}</span>
                      </div>

                      {/* ELIMINA TICKET */}
                      <button
                          className={styles.deleteBtn}
                          onClick={() => handleDeleteMatch(match.id, match.is_played)}
                          title={t.schedule.deleteMatch || "Delete Match"}
                      >
                        <Trash2 size={28} />
                      </button>
                    </div>
                ))}
              </div>
            </>
        )}
      </div>
  );
}