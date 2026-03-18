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

  // --- NUOVI STATI PER FILTRO E PAGINAZIONE ---
  const [selectedTeamFilter, setSelectedTeamFilter] = useState('');
  const [currentRound, setCurrentRound] = useState<number | null>(null);

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
  // -----------------------------

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
      setCurrentRound(null); // Resetta la paginazione per farla ricalcolare
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

  // --- LOGICA DI FILTRAGGIO E RAGGRUPPAMENTO ---
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

  // Imposta la pagina/giornata corretta al caricamento o al cambio filtro
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
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1rem' }}>

        {/* HEADER DELLA PAGINA */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '4px solid var(--color-ink)', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Calendar size={40} color="var(--color-blood-bright)" />
            <h1 style={{
              fontFamily: 'var(--font-impact)',
              fontSize: '3.5rem',
              color: 'var(--color-ink)',
              margin: 0,
              textShadow: '2px 2px 0 #fff, 4px 4px 0 var(--color-blood-bright)',
              letterSpacing: '2px'
            }}>
              SEASON SCHEDULE
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
                style={{
                  background: '#fff',
                  color: 'var(--color-ink)',
                  border: '3px solid var(--color-ink)',
                  boxShadow: '4px 4px 0 var(--color-ink)',
                  padding: '0.5rem 1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontFamily: 'var(--font-impact)',
                  fontSize: '1.2rem',
                  cursor: 'pointer'
                }}
                onClick={() => setShowGenerateModal(true)}
            >
              <Settings size={20} /> AUTO-GENERATE
            </button>

            <button className="btn btn-primary" onClick={() => setShowAddMatch(true)} style={{ boxShadow: '4px 4px 0 var(--color-ink)' }}>
              <Plus size={20} /> ADD MATCH
            </button>
          </div>
        </div>

        {/* BARRA FILTRO SQUADRE */}
        <div style={{
          display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '3rem',
          background: 'var(--color-paper)', padding: '1rem 1.5rem',
          border: '3px solid var(--color-ink)', boxShadow: '6px 6px 0 var(--color-ink)'
        }}>
          <Filter size={24} color="var(--color-ink)" />
          <label style={{ fontFamily: 'var(--font-typewriter)', fontWeight: 'bold', color: 'var(--color-ink)', fontSize: '1.2rem' }}>
            TEAM FILTER:
          </label>
          <select
              value={selectedTeamFilter}
              onChange={e => setSelectedTeamFilter(e.target.value)}
              style={{
                padding: '0.5rem', fontFamily: 'var(--font-impact)', fontSize: '1.2rem',
                flex: 1, border: '2px solid var(--color-ink)', background: '#fff', color: 'var(--color-ink)', cursor: 'pointer'
              }}
          >
            <option value="">-- ALL TEAMS (FULL SCHEDULE) --</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {/* AUTO-GENERATE MODAL */}
        {showGenerateModal && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              <div style={{ background: 'var(--color-paper)', padding: '2rem', border: '4px solid var(--color-ink)', maxWidth: '500px', width: '100%', boxShadow: '8px 8px 0 rgba(0,0,0,0.5)' }}>
                <h2 style={{ fontFamily: 'var(--font-impact)', fontSize: '2rem', color: 'var(--color-ink)', marginTop: 0, marginBottom: '1.5rem', textTransform: 'uppercase' }}>
                  Generate League Schedule
                </h2>
                <p style={{ fontFamily: 'var(--font-typewriter)', marginBottom: '2rem', color: '#444' }}>
                  This will automatically create a Round-Robin schedule for all active teams.
                </p>

                <div style={{ marginBottom: '2rem' }}>
                  <label style={{ display: 'block', fontFamily: 'var(--font-typewriter)', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--color-ink)' }}>START FROM ROUND (MATCHDAY)</label>
                  <input
                      type="number"
                      min="1"
                      value={generateStartRound}
                      onChange={e => setGenerateStartRound(Number(e.target.value))}
                      style={{ width: '100%', padding: '0.8rem', fontFamily: 'var(--font-impact)', fontSize: '1.5rem', border: '3px solid var(--color-ink)' }}
                  />
                  <span style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem', display: 'block' }}>If you already played Round 1, set this to 2 to avoid duplicates.</span>
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <button className="btn" onClick={() => setShowGenerateModal(false)}>CANCEL</button>
                  <button className="btn btn-primary" onClick={handleGenerateSchedule} disabled={isGenerating}>
                    {isGenerating ? 'GENERATING...' : 'GENERATE'}
                  </button>
                </div>
              </div>
            </div>
        )}

        {/* ADD MATCH MODAL */}
        {showAddMatch && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              <div style={{ background: 'var(--color-paper)', padding: '2rem', border: '4px solid var(--color-ink)', maxWidth: '600px', width: '100%', boxShadow: '8px 8px 0 rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto' }}>
                <h2 style={{ fontFamily: 'var(--font-impact)', fontSize: '2rem', color: 'var(--color-ink)', marginTop: 0, marginBottom: '1.5rem', textTransform: 'uppercase' }}>
                  SCHEDULE A FIXTURE
                </h2>

                <form onSubmit={handleAddMatch} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontFamily: 'var(--font-typewriter)', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--color-ink)' }}>MATCHDAY (ROUND)</label>
                      <input type="number" min="1" required value={form.round} onChange={e => setForm({...form, round: parseInt(e.target.value) || 1})} style={{ width: '100%', padding: '0.8rem', fontFamily: 'var(--font-impact)', fontSize: '1.5rem', border: '3px solid var(--color-ink)' }} />
                    </div>
                    <div style={{ flex: 2 }}>
                      <label style={{ display: 'block', fontFamily: 'var(--font-typewriter)', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--color-ink)' }}>DATE & TIME</label>
                      <input type="datetime-local" value={form.match_date} onChange={e => setForm({...form, match_date: e.target.value})} style={{ width: '100%', padding: '0.8rem', fontFamily: 'var(--font-typewriter)', fontSize: '1.2rem', border: '3px solid var(--color-ink)', fontWeight: 'bold' }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontFamily: 'var(--font-typewriter)', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--color-ink)' }}>HOME TEAM</label>
                    <select required value={form.home_team_id} onChange={e => setForm({...form, home_team_id: e.target.value})} style={{ width: '100%', padding: '0.8rem', fontFamily: 'var(--font-impact)', fontSize: '1.2rem', border: '3px solid var(--color-ink)' }}>
                      <option value="">Select Home Team...</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>

                  <div style={{ textAlign: 'center', fontFamily: 'var(--font-impact)', fontSize: '2rem', color: 'var(--color-blood-bright)' }}>VS</div>

                  <div>
                    <label style={{ display: 'block', fontFamily: 'var(--font-typewriter)', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--color-ink)' }}>AWAY TEAM</label>
                    <select required value={form.away_team_id} onChange={e => setForm({...form, away_team_id: e.target.value})} style={{ width: '100%', padding: '0.8rem', fontFamily: 'var(--font-impact)', fontSize: '1.2rem', border: '3px solid var(--color-ink)' }}>
                      <option value="">Select Away Team...</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>

                  {/* RIVALRY CHECKER ALERTS */}
                  {form.home_team_id && form.away_team_id && (
                      <div style={{ background: '#f5f5f5', padding: '1rem', border: '2px dashed var(--color-ink)', marginTop: '0.5rem' }}>
                        {bothLegsPlayed ? (
                            <div style={{ color: 'var(--color-blood-bright)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-typewriter)', fontWeight: 'bold' }}>
                              <AlertTriangle size={20} />
                              <span>Both Home and Away legs already played! Forcing Friendly Match.</span>
                            </div>
                        ) : needsSwap ? (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-typewriter)', fontWeight: 'bold' }}>
                                <AlertTriangle size={20} />
                                <span>This exact fixture was already played!</span>
                              </div>
                              <button type="button" onClick={handleSwapTeams} style={{ background: 'var(--color-ink)', color: '#fff', border: 'none', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontFamily: 'var(--font-impact)', fontSize: '1rem' }}>
                                <ArrowRightLeft size={16} /> SWAP H/A
                              </button>
                            </div>
                        ) : (
                            <div style={{ color: 'var(--color-grass)', fontFamily: 'var(--font-typewriter)', fontWeight: 'bold' }}>
                              ✓ Matchup is valid for League play.
                            </div>
                        )}
                      </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontFamily: 'var(--font-typewriter)', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--color-ink)' }}>MATCH TYPE</label>
                    <select
                        value={form.match_type}
                        onChange={e => setForm({...form, match_type: e.target.value})}
                        style={{ width: '100%', padding: '0.8rem', fontFamily: 'var(--font-impact)', fontSize: '1.2rem', border: '3px solid var(--color-ink)', backgroundColor: bothLegsPlayed ? '#ddd' : '#fff' }}
                        disabled={bothLegsPlayed}
                    >
                      <option value="League">League Match</option>
                      <option value="Playoff">Playoff / Tournament</option>
                      <option value="Friendly">Friendly Match</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button type="button" className="btn" onClick={() => setShowAddMatch(false)}>CANCEL</button>
                    <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                      {isSubmitting ? 'SAVING...' : 'SCHEDULE FIXTURE'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
        )}

        {/* MATCH LIST CON PAGINAZIONE E TASTO ELIMINA ROUND (CORRETTO IL CRASH QUI) */}
        {rounds.length === 0 || currentRound === null || !groupedMatches[currentRound] ? (
            <div style={{ textAlign: 'center', padding: '4rem', background: 'var(--color-paper)', border: '4px dashed var(--color-ink)' }}>
              <p style={{ fontFamily: 'var(--font-impact)', fontSize: '2rem', color: '#555', margin: 0 }}>NO MATCHES FOUND</p>
            </div>
        ) : (
            <div>
              {/* CONTROLLI PAGINAZIONE E CANCELLAZIONE (Testata Matchday) */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'var(--color-ink)', padding: '1rem 2rem', marginBottom: '2rem',
                boxShadow: '4px 4px 0 rgba(0,0,0,0.3)'
              }}>
                <button
                    onClick={() => setCurrentRound(rounds[currentRoundIndex - 1])}
                    disabled={currentRoundIndex <= 0}
                    style={{
                      background: 'transparent', border: 'none', color: currentRoundIndex <= 0 ? '#555' : '#fff',
                      cursor: currentRoundIndex <= 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
                      fontFamily: 'var(--font-impact)', fontSize: '1.5rem', transition: 'color 0.2s'
                    }}
                >
                  <ChevronLeft size={30} /> <span style={{ display: 'none' }}>PREV</span>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <h2 style={{
                    fontFamily: 'var(--font-impact)', color: '#fff', margin: 0, letterSpacing: '2px',
                    display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '2.5rem'
                  }}>
                    MATCHDAY <span style={{ color: 'var(--color-blood-bright)', fontSize: '3.5rem' }}>{currentRound}</span>
                  </h2>

                  {/* TASTO ELIMINA ROUND */}
                  <button
                      onClick={() => handleDeleteRound(currentRound)}
                      style={{
                        background: 'var(--color-blood-bright)', border: '2px solid #fff', color: '#fff',
                        cursor: 'pointer', padding: '0.5rem', display: 'flex', alignItems: 'center',
                        boxShadow: '2px 2px 0 #000', borderRadius: '4px', transition: 'transform 0.1s'
                      }}
                      onMouseDown={e => e.currentTarget.style.transform = 'translate(2px, 2px)'}
                      onMouseUp={e => e.currentTarget.style.transform = 'none'}
                      title={`Elimina l'intero Matchday ${currentRound}`}
                  >
                    <Trash2 size={24} />
                  </button>
                </div>

                <button
                    onClick={() => setCurrentRound(rounds[currentRoundIndex + 1])}
                    disabled={currentRoundIndex >= rounds.length - 1}
                    style={{
                      background: 'transparent', border: 'none', color: currentRoundIndex >= rounds.length - 1 ? '#555' : '#fff',
                      cursor: currentRoundIndex >= rounds.length - 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
                      fontFamily: 'var(--font-impact)', fontSize: '1.5rem', transition: 'color 0.2s'
                    }}
                >
                  <span style={{ display: 'none' }}>NEXT</span> <ChevronRight size={30} />
                </button>
              </div>

              {/* GRIGLIA PARTITE DEL MATCHDAY CORRENTE (SICURA AL 100%) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '2rem' }}>
                {groupedMatches[currentRound]?.map((match: any) => (
                    <div key={match.id} style={{
                      background: 'var(--color-paper)', border: '4px solid var(--color-ink)',
                      boxShadow: '6px 6px 0 var(--color-ink)', position: 'relative', overflow: 'hidden',
                      display: 'flex', flexDirection: 'column'
                    }}>

                      {/* STATO E DATA IN ALTO */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', background: '#111', color: '#fff', padding: '0.5rem 1rem', fontFamily: 'var(--font-typewriter)', fontSize: '0.9rem', fontWeight: 'bold' }}>
                  <span style={{ color: match.is_played ? 'var(--color-grass)' : '#f59e0b' }}>
                    {match.is_played ? 'COMPLETED' : 'UPCOMING'}
                  </span>
                        <span style={{ color: 'var(--color-gold)' }}>{match.match_type}</span>
                      </div>

                      {match.match_date && (
                          <div style={{ background: '#333', color: '#fff', textAlign: 'center', padding: '0.3rem', fontFamily: 'var(--font-typewriter)', fontSize: '0.8rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                            <Clock size={14} color="var(--color-gold)" /> {formatDate(match.match_date)}
                          </div>
                      )}

                      {/* CORPO DEL MATCH */}
                      <div style={{ padding: '2rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>

                        {/* HOME TEAM */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '35%' }}>
                          <div style={{ width: '70px', height: '70px', border: `3px solid ${match.home_color || '#111'}`, padding: '5px', background: '#fff', marginBottom: '0.5rem', transform: 'rotate(-3deg)' }}>
                            {match.home_logo ? <img src={match.home_logo} alt="Home" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <ShieldAlert size={50} color={match.home_color} />}
                          </div>
                          <span style={{ fontFamily: 'var(--font-varsity)', fontSize: '1.2rem', textAlign: 'center', color: 'var(--color-ink)', lineHeight: 1.1 }}>{match.home_name}</span>
                        </div>

                        {/* PUNTEGGIO O VS */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '30%' }}>
                          {match.is_played ? (
                              <div style={{ fontFamily: 'var(--font-impact)', fontSize: '3rem', color: 'var(--color-ink)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>{match.home_score}</span> <span style={{ color: 'var(--color-blood-bright)', fontSize: '1.5rem' }}>-</span> <span>{match.away_score}</span>
                              </div>
                          ) : (
                              <div style={{ fontFamily: 'var(--font-impact)', fontSize: '2rem', color: 'var(--color-blood-bright)' }}>VS</div>
                          )}
                        </div>

                        {/* AWAY TEAM */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '35%' }}>
                          <div style={{ width: '70px', height: '70px', border: `3px solid ${match.away_color || '#111'}`, padding: '5px', background: '#fff', marginBottom: '0.5rem', transform: 'rotate(3deg)' }}>
                            {match.away_logo ? <img src={match.away_logo} alt="Away" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <ShieldAlert size={50} color={match.away_color} />}
                          </div>
                          <span style={{ fontFamily: 'var(--font-varsity)', fontSize: '1.2rem', textAlign: 'center', color: 'var(--color-ink)', lineHeight: 1.1 }}>{match.away_name}</span>
                        </div>

                      </div>

                      {/* AZIONI */}
                      <div style={{ display: 'flex', borderTop: '2px solid var(--color-ink)' }}>
                        <button onClick={() => router.push(`/schedule/${match.id}`)} style={{ flex: 1, padding: '1rem', background: 'transparent', border: 'none', borderRight: '2px solid var(--color-ink)', fontFamily: 'var(--font-impact)', fontSize: '1.2rem', color: 'var(--color-ink)', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          {match.is_played ? 'MATCH REPORT' : 'PLAY MATCH'}
                        </button>
                        <button onClick={() => deleteMatch(match.id)} style={{ padding: '1rem', background: 'transparent', border: 'none', color: 'var(--color-blood-bright)', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(229,9,20,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} title="Delete Match">
                          <Trash2 size={24} />
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