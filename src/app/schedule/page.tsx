'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, RefreshCw, Trophy, Trash2, ShieldAlert } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function SchedulePage() {
  const { t } = useLanguage();
  const [matches, setMatches] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  
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

      // Group by round
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
      
      // Auto-set the next available round for the form
      const maxRound = formatted.length > 0 ? Math.max(...formatted.map(f => f.round)) : 1;
      setManualForm(prev => ({ ...prev, round: maxRound }));

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
      fetchData(); // Playoff rounds will be appended
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

  if (loading) return <div>Checking the match schedule...</div>;

  const isRegularSeasonComplete = matches.length > 0 && matches.every(r => r.matches.every((m: any) => m.is_played || m.match_type !== 'Regular Season'));
  const hasPlayoffs = matches.some(r => r.matches.some((m: any) => m.match_type.includes('Semifinal')));
  
  const areSemifinalsComplete = hasPlayoffs && matches.some(r => r.matches.some((m: any) => m.match_type.includes('Semifinal') && m.is_played));
  const hasFinals = matches.some(r => r.matches.some((m: any) => m.match_type.includes('Final')));

  return (
    <div>
      <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '2px solid var(--color-blood-red)', paddingBottom: '1rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '3rem' }}>
          <Calendar size={40} color="var(--color-blood-bright)" />
          {t.schedule.title}
        </h1>
        <div className="mobile-stack" style={{ display: 'flex', gap: '1rem' }}>
          {isRegularSeasonComplete && !hasPlayoffs && (
            <button className="btn" style={{ borderColor: '#ffd700', color: '#ffd700' }} onClick={handlePlayoffs}>
              <Trophy size={20} /> {t.schedule.startFinalFour}
            </button>
          )}
          {areSemifinalsComplete && !hasFinals && (
            <button className="btn" style={{ borderColor: '#ffd700', color: '#ffd700', backgroundColor: 'var(--color-blood-red)' }} onClick={handleFinals}>
              <Trophy size={20} /> {t.schedule.generateFinals}
            </button>
          )}
          <button className="btn" onClick={() => setShowManualForm(!showManualForm)} style={{ borderColor: 'var(--color-steel)', color: 'var(--color-bone)' }}>
            <Calendar size={20} /> Add Match
          </button>
          <button className="btn btn-primary" onClick={handleAutoFill} disabled={generating}>
            <RefreshCw size={20} className={generating ? "spin" : ""} />
            {generating ? t.schedule.generating : "Auto-Fill Remainder"}
          </button>
        </div>
      </div>

      {showManualForm && (
        <div className="card" style={{ marginBottom: '2rem', borderStyle: 'dashed' }}>
          <h3>Add Manual Match</h3>
          <form onSubmit={handleCreateManual} className="mobile-stack" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginTop: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-steel-light)' }}>Round / Matchday</label>
              <input type="number" min="1" required value={manualForm.round} onChange={e => setManualForm({...manualForm, round: parseInt(e.target.value) || 1})} style={{ width: '100%', padding: '0.75rem', background: 'var(--color-black)', border: '1px solid var(--color-mud)', color: 'var(--color-bone)' }} />
            </div>
            <div style={{ flex: 2 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-steel-light)' }}>Home Team</label>
              <select required value={manualForm.homeId} onChange={e => setManualForm({...manualForm, homeId: e.target.value})} style={{ width: '100%', padding: '0.75rem', background: 'var(--color-black)', border: '1px solid var(--color-mud)', color: 'var(--color-bone)' }}>
                <option value="">Select Team...</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div style={{ paddingBottom: '0.75rem', color: 'var(--color-steel-light)' }}>VS</div>
            <div style={{ flex: 2 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-steel-light)' }}>Away Team</label>
              <select required value={manualForm.awayId} onChange={e => setManualForm({...manualForm, awayId: e.target.value})} style={{ width: '100%', padding: '0.75rem', background: 'var(--color-black)', border: '1px solid var(--color-mud)', color: 'var(--color-bone)' }}>
                <option value="">Select Team...</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <button type="submit" className="btn btn-primary">Save Match</button>
          </form>
        </div>
      )}

      {matches.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
          <h2 style={{ color: 'var(--color-steel-light)', marginBottom: '1rem' }}>{t.schedule.noScheduleTitle}</h2>
          <p style={{ marginBottom: '2rem' }}>{t.schedule.noScheduleDesc}</p>
          <button className="btn btn-primary" onClick={handleAutoFill}>{t.schedule.generateRoundRobin}</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {matches.map((roundGroup) => (
            <div key={roundGroup.round} className="card" style={{ borderLeft: `4px solid ${roundGroup.matches[0].match_type.includes('Semifinal') || roundGroup.matches[0].match_type.includes('Final') ? '#ffd700' : 'var(--color-blood-red)'}` }}>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--color-steel-light)' }}>
                {roundGroup.matches[0].match_type === 'Regular Season' ? `Matchday ${roundGroup.round}` : roundGroup.matches[0].match_type}
              </h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {roundGroup.matches.map((match: any) => (
                  <div key={match.id} className="match-row-content" style={{ background: 'rgba(0,0,0,0.4)', padding: '2rem', borderRadius: '8px', border: '1px solid var(--color-glass-border)', transition: 'background 0.2s ease', boxShadow: '0 4px 15px rgba(0,0,0,0.4)' }}>
                    
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1.5rem' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '1.5rem' }}>{match.home_name}</span>
                      {match.home_logo ? (
                        <div style={{ width: '60px', height: '60px', borderRadius: '50%', border: `3px solid ${match.home_color}`, background: 'var(--color-black)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: `0 0 10px ${match.home_color}40` }}>
                          <img src={match.home_logo} alt={match.home_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ) : (
                        <div style={{ width: '60px', height: '60px', borderRadius: '50%', border: `3px solid ${match.home_color}`, background: 'var(--color-black)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 10px ${match.home_color}40` }}>
                          <ShieldAlert size={30} color={match.home_color} />
                        </div>
                      )}
                    </div>

                    <div style={{ padding: '0 3rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      {match.is_played ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(0,0,0,0.6)', padding: '1rem 2rem', borderRadius: '8px', border: '1px solid var(--color-mud)' }}>
                          <span style={{ fontSize: '2.5rem', fontWeight: 'bold', fontFamily: 'var(--font-varsity)', color: 'var(--color-bone)', textShadow: '2px 2px 0 var(--color-blood-red)' }}>
                            {match.home_score} - {match.away_score}
                          </span>
                          <span style={{ fontSize: '0.9rem', color: 'var(--color-steel-light)', marginTop: '0.2rem' }}>
                            CAS: {match.home_casualties} - {match.away_casualties}
                          </span>
                          <Link href={`/schedule/${match.id}`} style={{ fontSize: '0.9rem', marginTop: '1rem', color: 'var(--color-blood-bright)', textDecoration: 'none', borderBottom: '1px solid var(--color-blood-bright)' }}>{t.schedule.viewDetails}</Link>
                        </div>
                      ) : (
                        <Link href={`/schedule/${match.id}`} className="btn btn-primary" style={{ padding: '0.8rem 1.5rem', fontSize: '1.2rem', margin: '1rem 0' }}>
                          {t.schedule.playMatch}
                        </Link>
                      )}
                    </div>

                    <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '1.5rem' }}>
                      {match.away_logo ? (
                        <div style={{ width: '60px', height: '60px', borderRadius: '50%', border: `3px solid ${match.away_color}`, background: 'var(--color-black)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: `0 0 10px ${match.away_color}40` }}>
                          <img src={match.away_logo} alt={match.away_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ) : (
                        <div style={{ width: '60px', height: '60px', borderRadius: '50%', border: `3px solid ${match.away_color}`, background: 'var(--color-black)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 10px ${match.away_color}40` }}>
                          <ShieldAlert size={30} color={match.away_color} />
                        </div>
                      )}
                      <span style={{ fontWeight: 'bold', fontSize: '1.5rem' }}>{match.away_name}</span>
                    </div>
                    
                    <button 
                      onClick={() => handleDeleteMatch(match.id, match.is_played)} 
                      style={{ background: 'none', border: 'none', color: 'var(--color-blood-bright)', cursor: 'pointer', marginLeft: '1rem', padding: '0.5rem' }} 
                      title={t.schedule.deleteMatch || "Delete Match"}
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
