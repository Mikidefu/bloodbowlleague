'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Plus, ShieldAlert, Clock, Settings, ArrowRightLeft, AlertTriangle, Trash2, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function SchedulePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [matches, setMatches] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- STATO PER RESPONSIVE ---
  const [isMobile, setIsMobile] = useState(false);

  // Add Match Modal State
  const [showAddMatch, setShowAddMatch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    home_team_id: '',
    away_team_id: '',
    round: 1,
    match_type: 'League',
    match_date: ''
  });

  // Auto-Generate Modal State
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateStartRound, setGenerateStartRound] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);

  // --- STATI PER FILTRO E PAGINAZIONE ---
  const [selectedTeamFilter, setSelectedTeamFilter] = useState('');
  const [currentRound, setCurrentRound] = useState<number | null>(null);

  // Listener per le dimensioni della finestra
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchData = async () => {
    try {
      const [matchesRes, teamsRes] = await Promise.all([
        fetch('/api/schedule'),
        fetch('/api/teams')
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
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- RIVALRY CHECKER LOGIC ---
  const h2hMatches = matches.filter(m =>
      (m.home_team_id === form.home_team_id && m.away_team_id === form.away_team_id) ||
      (m.home_team_id === form.away_team_id && m.away_team_id === form.home_team_id)
  );

  const playedHomeVsAway = h2hMatches.some(m => m.home_team_id === form.home_team_id && m.away_team_id === form.away_team_id);
  const playedAwayVsHome = h2hMatches.some(m => m.home_team_id === form.away_team_id && m.away_team_id === form.home_team_id);

  const bothLegsPlayed = playedHomeVsAway && playedAwayVsHome;
  const needsSwap = playedHomeVsAway && !playedAwayVsHome && form.home_team_id && form.away_team_id;

  useEffect(() => {
    if (bothLegsPlayed && form.match_type !== 'Friendly') {
      setForm(prev => ({ ...prev, match_type: 'Friendly' }));
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
        setForm({ home_team_id: '', away_team_id: '', round: 1, match_type: 'League', match_date: '' });
        fetchData();
      } else {
        alert("Failed to add match");
      }
    } catch (err) {
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
        alert("Failed to generate schedule");
      }
    } catch (err) {
      alert("Error generating schedule");
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteMatch = async (id: string) => {
    if (!confirm("Delete this match? Stats will be lost.")) return;
    try {
      await fetch(`/api/schedule/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      alert("Error deleting match");
    }
  };

  const handleDeleteRound = async (round: number) => {
    if (!confirm(`ATTENZIONE! Vuoi davvero eliminare l'intero MATCHDAY ${round}?\nTutte le partite e le statistiche guadagnate dai giocatori in questo round andranno perdute per sempre.`)) return;
    try {
      await fetch(`/api/schedule/round/${round}`, { method: 'DELETE' });
      setCurrentRound(null);
      fetchData();
    } catch (err) {
      alert("Error deleting matchday");
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const filteredMatches = matches.filter(m =>
      selectedTeamFilter ? (m.home_team_id === selectedTeamFilter || m.away_team_id === selectedTeamFilter) : true
  );

  const groupedMatches = filteredMatches.reduce((acc: any, match) => {
    const round = match.round || 0;
    if (!acc[round]) acc[round] = [];
    acc[round].push(match);
    return acc;
  }, {});

  const rounds = Object.keys(groupedMatches).map(Number).sort((a, b) => a - b);

  useEffect(() => {
    if (rounds.length > 0) {
      if (currentRound === null || !rounds.includes(currentRound)) {
        const firstIncomplete = rounds.find(r => groupedMatches[r].some((m: any) => !m.is_played));
        setCurrentRound(firstIncomplete !== undefined ? firstIncomplete : rounds[0]);
      }
    } else {
      setCurrentRound(null);
    }
  }, [matches, selectedTeamFilter]);

  const currentRoundIndex = currentRound !== null ? rounds.indexOf(currentRound) : -1;

  if (loading) return <div style={{ fontFamily: 'var(--font-typewriter)', fontSize: '1.5rem', textAlign: 'center', marginTop: '4rem', color: 'var(--color-ink)' }}>Loading Schedule...</div>;

  return (
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: isMobile ? '0.5rem' : '1rem' }}>

        {/* HEADER DELLA PAGINA - RESPONSIVE */}
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'flex-start' : 'center',
          marginBottom: '2rem',
          borderBottom: '4px solid var(--color-ink)',
          paddingBottom: '1rem',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Calendar size={isMobile ? 30 : 40} color="var(--color-blood-bright)" />
            <h1 style={{
              fontFamily: 'var(--font-impact)',
              fontSize: isMobile ? '2.2rem' : '3.5rem',
              color: 'var(--color-ink)',
              margin: 0,
              textShadow: '2px 2px 0 #fff, 4px 4px 0 var(--color-blood-bright)',
              letterSpacing: '1px'
            }}>
              SEASON SCHEDULE
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', width: isMobile ? '100%' : 'auto' }}>
            <button
                style={{
                  background: '#fff',
                  color: 'var(--color-ink)',
                  border: '3px solid var(--color-ink)',
                  boxShadow: '4px 4px 0 var(--color-ink)',
                  padding: '0.5rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  fontFamily: 'var(--font-impact)',
                  fontSize: isMobile ? '0.9rem' : '1.1rem',
                  cursor: 'pointer',
                  flex: 1
                }}
                onClick={() => setShowGenerateModal(true)}
            >
              <Settings size={isMobile ? 16 : 20} /> {isMobile ? 'GENERATE' : 'AUTO-GENERATE'}
            </button>

            <button className="btn btn-primary" onClick={() => setShowAddMatch(true)} style={{ boxShadow: '4px 4px 0 var(--color-ink)', flex: 1, padding: '0.5rem 1rem', fontSize: isMobile ? '0.9rem' : '1.1rem' }}>
              <Plus size={isMobile ? 16 : 20} /> {isMobile ? 'MATCH' : 'ADD MATCH'}
            </button>
          </div>
        </div>

        {/* BARRA FILTRO SQUADRE - RESPONSIVE */}
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: '0.5rem',
          alignItems: isMobile ? 'flex-start' : 'center',
          marginBottom: '2rem',
          background: 'var(--color-paper)',
          padding: '1rem',
          border: '3px solid var(--color-ink)',
          boxShadow: '6px 6px 0 var(--color-ink)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={20} color="var(--color-ink)" />
            <label style={{ fontFamily: 'var(--font-typewriter)', fontWeight: 'bold', color: 'var(--color-ink)', fontSize: '1rem' }}>
              FILTER:
            </label>
          </div>
          <select
              value={selectedTeamFilter}
              onChange={e => setSelectedTeamFilter(e.target.value)}
              style={{
                padding: '0.5rem', fontFamily: 'var(--font-impact)', fontSize: '1.1rem',
                flex: 1, width: isMobile ? '100%' : 'auto', border: '2px solid var(--color-ink)', background: '#fff', color: 'var(--color-ink)', cursor: 'pointer'
              }}
          >
            <option value="">-- ALL TEAMS --</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {/* AUTO-GENERATE MODAL - MOBILE OPTIMIZED */}
        {showGenerateModal && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              <div style={{ background: 'var(--color-paper)', padding: '1.5rem', border: '4px solid var(--color-ink)', maxWidth: '500px', width: '100%', boxShadow: '8px 8px 0 rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto' }}>
                <h2 style={{ fontFamily: 'var(--font-impact)', fontSize: '1.8rem', color: 'var(--color-ink)', marginTop: 0, marginBottom: '1rem', textTransform: 'uppercase' }}>
                  Generate Schedule
                </h2>
                <p style={{ fontFamily: 'var(--font-typewriter)', marginBottom: '1.5rem', color: '#444', fontSize: '0.9rem' }}>
                  Round-Robin schedule for all active teams.
                </p>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontFamily: 'var(--font-typewriter)', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--color-ink)' }}>START FROM ROUND</label>
                  <input
                      type="number"
                      min="1"
                      value={generateStartRound}
                      onChange={e => setGenerateStartRound(Number(e.target.value))}
                      style={{ width: '100%', padding: '0.8rem', fontFamily: 'var(--font-impact)', fontSize: '1.5rem', border: '3px solid var(--color-ink)' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn" style={{ flex: 1 }} onClick={() => setShowGenerateModal(false)}>CANCEL</button>
                  <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleGenerateSchedule} disabled={isGenerating}>
                    {isGenerating ? '...' : 'GENERATE'}
                  </button>
                </div>
              </div>
            </div>
        )}

        {/* ADD MATCH MODAL - MOBILE OPTIMIZED */}
        {showAddMatch && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem' }}>
              <div style={{ background: 'var(--color-paper)', padding: '1.2rem', border: '4px solid var(--color-ink)', maxWidth: '600px', width: '100%', boxShadow: '8px 8px 0 rgba(0,0,0,0.5)', maxHeight: '95vh', overflowY: 'auto' }}>
                <h2 style={{ fontFamily: 'var(--font-impact)', fontSize: '1.8rem', color: 'var(--color-ink)', marginTop: 0, marginBottom: '1rem', textTransform: 'uppercase' }}>
                  SCHEDULE FIXTURE
                </h2>

                <form onSubmit={handleAddMatch} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontWeight: 'bold', color: 'var(--color-ink)', fontSize: '0.8rem' }}>ROUND</label>
                      <input type="number" min="1" required value={form.round} onChange={e => setForm({...form, round: parseInt(e.target.value) || 1})} style={{ width: '100%', padding: '0.5rem', fontFamily: 'var(--font-impact)', fontSize: '1.2rem', border: '2px solid var(--color-ink)' }} />
                    </div>
                    <div style={{ flex: 2 }}>
                      <label style={{ display: 'block', fontWeight: 'bold', color: 'var(--color-ink)', fontSize: '0.8rem' }}>DATE & TIME</label>
                      <input type="datetime-local" value={form.match_date} onChange={e => setForm({...form, match_date: e.target.value})} style={{ width: '100%', padding: '0.5rem', fontFamily: 'var(--font-typewriter)', border: '2px solid var(--color-ink)', fontSize: '0.9rem' }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>HOME TEAM</label>
                    <select required value={form.home_team_id} onChange={e => setForm({...form, home_team_id: e.target.value})} style={{ width: '100%', padding: '0.6rem', border: '2px solid var(--color-ink)' }}>
                      <option value="">Select Team...</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>

                  <div style={{ textAlign: 'center', fontFamily: 'var(--font-impact)', fontSize: '1.5rem', color: 'var(--color-blood-bright)' }}>VS</div>

                  <div>
                    <label style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>AWAY TEAM</label>
                    <select required value={form.away_team_id} onChange={e => setForm({...form, away_team_id: e.target.value})} style={{ width: '100%', padding: '0.6rem', border: '2px solid var(--color-ink)' }}>
                      <option value="">Select Team...</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>

                  {form.home_team_id && form.away_team_id && (
                      <div style={{ background: '#f5f5f5', padding: '0.8rem', border: '2px dashed var(--color-ink)', fontSize: '0.85rem' }}>
                        {bothLegsPlayed ? (
                            <div style={{ color: 'var(--color-blood-bright)', fontWeight: 'bold' }}>H/A legs played! Friendly forced.</div>
                        ) : needsSwap ? (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ color: '#f59e0b' }}>Fixture already played!</span>
                              <button type="button" onClick={handleSwapTeams} style={{ background: 'var(--color-ink)', color: '#fff', border: 'none', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'var(--font-impact)' }}>SWAP H/A</button>
                            </div>
                        ) : (
                            <div style={{ color: 'var(--color-grass)', fontWeight: 'bold' }}>✓ Matchup is valid.</div>
                        )}
                      </div>
                  )}

                  <div>
                    <label style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>MATCH TYPE</label>
                    <select
                        value={form.match_type}
                        onChange={e => setForm({...form, match_type: e.target.value})}
                        style={{ width: '100%', padding: '0.6rem', border: '2px solid var(--color-ink)' }}
                        disabled={bothLegsPlayed}
                    >
                      <option value="League">League Match</option>
                      <option value="Playoff">Playoff / Tournament</option>
                      <option value="Friendly">Friendly Match</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setShowAddMatch(false)}>CANCEL</button>
                    <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={isSubmitting}>
                      {isSubmitting ? '...' : 'SCHEDULE'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
        )}

        {/* MATCH LIST CON PAGINAZIONE E TASTO ELIMINA ROUND - MOBILE OPTIMIZED */}
        {rounds.length === 0 || currentRound === null || !groupedMatches[currentRound] ? (
            <div style={{ textAlign: 'center', padding: '4rem', background: 'var(--color-paper)', border: '4px dashed var(--color-ink)' }}>
              <p style={{ fontFamily: 'var(--font-impact)', fontSize: '1.5rem', color: '#555', margin: 0 }}>NO MATCHES FOUND</p>
            </div>
        ) : (
            <div>
              {/* CONTROLLI PAGINAZIONE - MOBILE FRIENDLY */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'var(--color-ink)', padding: isMobile ? '0.6rem' : '1rem 2rem', marginBottom: '2rem',
                boxShadow: '4px 4px 0 rgba(0,0,0,0.3)'
              }}>
                <button
                    onClick={() => setCurrentRound(rounds[currentRoundIndex - 1])}
                    disabled={currentRoundIndex <= 0}
                    style={{
                      background: 'transparent', border: 'none', color: currentRoundIndex <= 0 ? '#555' : '#fff',
                      cursor: 'pointer'
                    }}
                >
                  <ChevronLeft size={isMobile ? 35 : 45} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '1.5rem' }}>
                  <h2 style={{
                    fontFamily: 'var(--font-impact)', color: '#fff', margin: 0, letterSpacing: '1px',
                    fontSize: isMobile ? '1.4rem' : '2.5rem'
                  }}>
                    DAY <span style={{ color: 'var(--color-blood-bright)', fontSize: isMobile ? '2.4rem' : '3.5rem' }}>{currentRound}</span>
                  </h2>

                  <button
                      onClick={() => handleDeleteRound(currentRound)}
                      style={{
                        background: 'var(--color-blood-bright)', border: '2px solid #fff', color: '#fff',
                        cursor: 'pointer', padding: isMobile ? '0.3rem' : '0.5rem',
                        boxShadow: '2px 2px 0 #000', borderRadius: '4px'
                      }}
                      title={`Elimina Round ${currentRound}`}
                  >
                    <Trash2 size={isMobile ? 18 : 24} />
                  </button>
                </div>

                <button
                    onClick={() => setCurrentRound(rounds[currentRoundIndex + 1])}
                    disabled={currentRoundIndex >= rounds.length - 1}
                    style={{
                      background: 'transparent', border: 'none', color: currentRoundIndex >= rounds.length - 1 ? '#555' : '#fff',
                      cursor: 'pointer'
                    }}
                >
                  <ChevronRight size={isMobile ? 35 : 45} />
                </button>
              </div>

              {/* GRIGLIA PARTITE - RESPONSIVE */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(350px, 1fr))',
                gap: isMobile ? '1rem' : '2rem'
              }}>
                {groupedMatches[currentRound]?.map((match: any) => (
                    <div key={match.id} style={{
                      background: 'var(--color-paper)', border: '4px solid var(--color-ink)',
                      boxShadow: '6px 6px 0 var(--color-ink)', position: 'relative', overflow: 'hidden',
                      display: 'flex', flexDirection: 'column'
                    }}>

                      <div style={{ display: 'flex', justifyContent: 'space-between', background: '#111', color: '#fff', padding: '0.4rem 0.8rem', fontFamily: 'var(--font-typewriter)', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        <span style={{ color: match.is_played ? 'var(--color-grass)' : '#f59e0b' }}>
                          {match.is_played ? 'COMPLETED' : 'UPCOMING'}
                        </span>
                        <span style={{ color: 'var(--color-gold)' }}>{match.match_type}</span>
                      </div>

                      {match.match_date && (
                          <div style={{ background: '#333', color: '#fff', textAlign: 'center', padding: '0.2rem', fontFamily: 'var(--font-typewriter)', fontSize: '0.7rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.3rem' }}>
                            <Clock size={12} color="var(--color-gold)" /> {formatDate(match.match_date)}
                          </div>
                      )}

                      <div style={{ padding: '1.5rem 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1, gap: '0.2rem' }}>

                        {/* HOME TEAM */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '38%' }}>
                          <div style={{ width: isMobile ? '50px' : '70px', height: isMobile ? '50px' : '70px', border: `3px solid ${match.home_color || '#111'}`, padding: '5px', background: '#fff', marginBottom: '0.4rem', transform: 'rotate(-3deg)' }}>
                            {match.home_logo ? <img src={match.home_logo} alt="H" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <ShieldAlert size={isMobile ? 30 : 45} color={match.home_color} />}
                          </div>
                          <span style={{ fontFamily: 'var(--font-varsity)', fontSize: isMobile ? '0.85rem' : '1.1rem', textAlign: 'center', color: 'var(--color-ink)', lineHeight: 1, wordBreak: 'break-word' }}>{match.home_name}</span>
                        </div>

                        {/* PUNTEGGIO O VS */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '24%' }}>
                          {match.is_played ? (
                              <div style={{ fontFamily: 'var(--font-impact)', fontSize: isMobile ? '1.8rem' : '2.8rem', color: 'var(--color-ink)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                <span>{match.home_score}</span> <span style={{ color: 'var(--color-blood-bright)', fontSize: '1rem' }}>-</span> <span>{match.away_score}</span>
                              </div>
                          ) : (
                              <div style={{ fontFamily: 'var(--font-impact)', fontSize: isMobile ? '1.5rem' : '2rem', color: 'var(--color-blood-bright)' }}>VS</div>
                          )}
                        </div>

                        {/* AWAY TEAM */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '38%' }}>
                          <div style={{ width: isMobile ? '50px' : '70px', height: isMobile ? '50px' : '70px', border: `3px solid ${match.away_color || '#111'}`, padding: '5px', background: '#fff', marginBottom: '0.4rem', transform: 'rotate(3deg)' }}>
                            {match.away_logo ? <img src={match.away_logo} alt="A" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <ShieldAlert size={isMobile ? 30 : 45} color={match.away_color} />}
                          </div>
                          <span style={{ fontFamily: 'var(--font-varsity)', fontSize: isMobile ? '0.85rem' : '1.1rem', textAlign: 'center', color: 'var(--color-ink)', lineHeight: 1, wordBreak: 'break-word' }}>{match.away_name}</span>
                        </div>

                      </div>

                      <div style={{ display: 'flex', borderTop: '2px solid var(--color-ink)' }}>
                        <button onClick={() => router.push(`/schedule/${match.id}`)} style={{ flex: 1, padding: isMobile ? '0.8rem 0.4rem' : '1rem', background: 'transparent', border: 'none', borderRight: '2px solid var(--color-ink)', fontFamily: 'var(--font-impact)', fontSize: isMobile ? '0.9rem' : '1.1rem', color: 'var(--color-ink)', cursor: 'pointer' }}>
                          {match.is_played ? (isMobile ? 'REPORT' : 'MATCH REPORT') : (isMobile ? 'PLAY' : 'PLAY MATCH')}
                        </button>
                        <button onClick={() => deleteMatch(match.id)} style={{ padding: '0.8rem', background: 'transparent', border: 'none', color: 'var(--color-blood-bright)', cursor: 'pointer' }}>
                          <Trash2 size={isMobile ? 20 : 24} />
                        </button>
                      </div>
                    </div>
                ))}
              </div>
            </div>
        )}
      </div>
  );
}