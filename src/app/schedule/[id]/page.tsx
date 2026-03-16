'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, Trophy, Save, ChevronDown, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function MatchDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const { t } = useLanguage();
  
  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({});

  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [homeCas, setHomeCas] = useState(0);
  const [awayCas, setAwayCas] = useState(0);
  
  // Array of { player_id, td, cas, int, comp, mvp }
  const [playerStats, setPlayerStats] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/schedule/${id}`)
      .then(res => res.json())
      .then(data => {
        setMatch(data);
        setHomeScore(data.home_score || 0);
        setAwayScore(data.away_score || 0);
        setHomeCas(data.home_casualties || 0);
        setAwayCas(data.away_casualties || 0);
        
        // Initialize player stats state
        const initialStats = [...data.homePlayers, ...data.awayPlayers].map((p: any) => {
          const existing = data.stats.find((s: any) => s.player_id === p.id);
          return {
            player_id: p.id,
            name: p.name,
            team_id: p.team_id,
            td: existing ? existing.touchdowns : 0,
            cas: existing ? existing.casualties : 0,
            int: existing ? existing.interceptions : 0,
            comp: existing ? existing.completions : 0,
            mvp: existing ? existing.mvp : 0,
            status: p.status || 'Active'
          };
        });
        setPlayerStats(initialStats);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        router.push('/schedule');
      });
  }, [id]);

  const handleStatChange = (playerId: string, field: string, value: number) => {
    setPlayerStats(prev => prev.map(p => {
      if (p.player_id === playerId) {
        return { ...p, [field]: value };
      }
      return p;
    }));
  };

  const handleStatusChange = (playerId: string, status: string) => {
    setPlayerStats(prev => prev.map(p => {
      if (p.player_id === playerId) {
        return { ...p, status };
      }
      return p;
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    // Auto-calculate total team stats based on individuals, to prevent mismatch
    // (Optional, but good UX. We'll use manual team totals if user overrides them)
    try {
      const res = await fetch(`/api/schedule/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          home_score: homeScore,
          away_score: awayScore,
          home_casualties: homeCas,
          away_casualties: awayCas,
          playerStats
        })
      });
      if (res.ok) {
        router.push('/schedule');
      } else {
        alert('Failed to save match results');
      }
    } catch (e) {
      alert('Error saving match');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !match) return <div>Preparing the pitch...</div>;

  const toggleTeam = (teamId: string) => {
    setExpandedTeams(prev => ({ ...prev, [teamId]: !prev[teamId] }));
  };

  const renderTeamStats = (teamName: string, players: any[], teamId: string, teamColor: string) => {
    const isExpanded = !!expandedTeams[teamId];
    
    return (
    <div className="card" style={{ borderTop: `4px solid ${teamColor}`, padding: '1rem' }}>
      <div 
        onClick={() => toggleTeam(teamId)} 
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
      >
        <h3 style={{ margin: 0, color: 'var(--color-bone)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isExpanded ? <ChevronDown size={24} color={teamColor} /> : <ChevronRight size={24} color={teamColor} />}
          {teamName} {t.match.players}
        </h3>
      </div>
      
      {isExpanded && (
        <div style={{ overflowX: 'auto', paddingTop: '1.5rem', paddingBottom: '1rem', marginTop: '1rem', borderTop: '1px solid var(--color-glass-border)' }}>
          <table className="data-table" style={{ fontSize: '1rem', minWidth: '900px' }}>
            <thead>
              <tr>
                <th style={{ padding: '1rem' }}>{t.match.thPlayer}</th>
                <th title="Touchdowns" style={{ width: '90px', textAlign: 'center', padding: '1rem' }}>TD</th>
                <th title="Casualties" style={{ width: '90px', textAlign: 'center', padding: '1rem' }}>CAS</th>
                <th title="Interceptions" style={{ width: '90px', textAlign: 'center', padding: '1rem' }}>INT</th>
                <th title="Completions" style={{ width: '90px', textAlign: 'center', padding: '1rem' }}>CMP</th>
                <th title="MVP" style={{ width: '90px', textAlign: 'center', padding: '1rem' }}>MVP</th>
                <th title="Status" style={{ width: '120px', padding: '1rem' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {playerStats.filter(p => match.homePlayers.find((h: any) => h.id === p.player_id && h.team_id === teamId) || match.awayPlayers.find((a: any) => a.id === p.player_id && a.team_id === teamId)).map((stat) => (
                <tr key={stat.player_id}>
                  <td style={{ fontWeight: 'bold', padding: '1rem', whiteSpace: 'nowrap' }}>{stat.name}</td>
                  <td style={{ textAlign: 'center', padding: '1rem' }}><input type="number" min="0" value={stat.td} onChange={e => handleStatChange(stat.player_id, 'td', parseInt(e.target.value) || 0)} style={{ width: '80px', padding: '0.8rem 0.5rem', background: 'rgba(0,0,0,0.8)', color: 'var(--color-bone)', border: '1px solid var(--color-glass-border)', borderRadius: '4px', textAlign: 'center', fontSize: '1.1rem', fontWeight: 'bold' }} /></td>
                  <td style={{ textAlign: 'center', padding: '1rem' }}><input type="number" min="0" value={stat.cas} onChange={e => handleStatChange(stat.player_id, 'cas', parseInt(e.target.value) || 0)} style={{ width: '80px', padding: '0.8rem 0.5rem', background: 'rgba(0,0,0,0.8)', color: 'var(--color-bone)', border: '1px solid var(--color-glass-border)', borderRadius: '4px', textAlign: 'center', fontSize: '1.1rem', fontWeight: 'bold' }} /></td>
                  <td style={{ textAlign: 'center', padding: '1rem' }}><input type="number" min="0" value={stat.int} onChange={e => handleStatChange(stat.player_id, 'int', parseInt(e.target.value) || 0)} style={{ width: '80px', padding: '0.8rem 0.5rem', background: 'rgba(0,0,0,0.8)', color: 'var(--color-bone)', border: '1px solid var(--color-glass-border)', borderRadius: '4px', textAlign: 'center', fontSize: '1.1rem', fontWeight: 'bold' }} /></td>
                  <td style={{ textAlign: 'center', padding: '1rem' }}><input type="number" min="0" value={stat.comp} onChange={e => handleStatChange(stat.player_id, 'comp', parseInt(e.target.value) || 0)} style={{ width: '80px', padding: '0.8rem 0.5rem', background: 'rgba(0,0,0,0.8)', color: 'var(--color-bone)', border: '1px solid var(--color-glass-border)', borderRadius: '4px', textAlign: 'center', fontSize: '1.1rem', fontWeight: 'bold' }} /></td>
                  <td style={{ textAlign: 'center', padding: '1rem' }}><input type="number" min="0" max="1" value={stat.mvp} onChange={e => handleStatChange(stat.player_id, 'mvp', parseInt(e.target.value) || 0)} style={{ width: '80px', padding: '0.8rem 0.5rem', background: 'rgba(0,0,0,0.8)', color: 'var(--color-bone)', border: '1px solid var(--color-glass-border)', borderRadius: '4px', textAlign: 'center', fontSize: '1.1rem', fontWeight: 'bold' }} /></td>
                  <td style={{ padding: '1rem' }}>
                    <select value={stat.status} onChange={e => handleStatusChange(stat.player_id, e.target.value)} style={{ width: '100%', minWidth: '110px', background: 'rgba(0,0,0,0.8)', color: 'var(--color-bone)', border: '1px solid var(--color-glass-border)', borderRadius: '4px', padding: '0.8rem 0.5rem', fontSize: '1rem' }}>
                      <option value="Active">Active</option>
                      <option value="Injured">Injured</option>
                      <option value="Dead">Dead</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

  return (
    <div style={{ width: '100%', padding: '0 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '2.5rem' }}>
          {match.match_type} - Round {match.round}
        </h1>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={20} /> {saving ? t.match.saving : t.match.saveResults}
        </button>
      </div>

      {/* Main Scoreboard */}
      <div className="card scoreboard-grid" style={{ display: 'flex', justifyContent: 'center', gap: '3rem', alignItems: 'center', marginBottom: '2rem', padding: '2rem', background: 'linear-gradient(to bottom, var(--color-grass-dark), var(--color-black))' }}>
        
        {/* Home */}
        <div className="team-score-card" style={{ textAlign: 'center', flex: 1 }}>
          <h2 style={{ fontSize: '3rem', color: match.home_color, textShadow: '2px 2px 0 #000' }}>{match.home_name}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem', alignItems: 'center' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--color-bone)', fontFamily: 'var(--font-varsity)', fontSize: '1.5rem' }}>{t.match.touchdowns}</label>
              <input type="number" min="0" value={homeScore} onChange={e => setHomeScore(parseInt(e.target.value) || 0)} style={{ fontSize: '3rem', width: '100px', textAlign: 'center', background: 'var(--color-black)', border: '2px solid var(--color-blood-red)', color: 'var(--color-blood-bright)', fontWeight: 'bold' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--color-bone)', fontFamily: 'var(--font-varsity)', fontSize: '1.2rem' }}>{t.match.casualties}</label>
              <input type="number" min="0" value={homeCas} onChange={e => setHomeCas(parseInt(e.target.value) || 0)} style={{ fontSize: '2rem', width: '80px', textAlign: 'center', background: 'var(--color-black)', border: '2px solid var(--color-mud)', color: 'var(--color-bone)' }} />
            </div>
          </div>
        </div>

        {/* VS */}
        <div className="vs-badge" style={{ fontSize: '4rem', fontFamily: 'var(--font-varsity)', color: 'var(--color-steel-light)', textShadow: '4px 4px 0 var(--color-mud)', textAlign: 'center' }}>
          VS
        </div>

        {/* Away */}
        <div className="team-score-card" style={{ textAlign: 'center', flex: 1 }}>
          <h2 style={{ fontSize: '3rem', color: match.away_color, textShadow: '2px 2px 0 #000' }}>{match.away_name}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem', alignItems: 'center' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--color-bone)', fontFamily: 'var(--font-varsity)', fontSize: '1.5rem' }}>{t.match.touchdowns}</label>
              <input type="number" min="0" value={awayScore} onChange={e => setAwayScore(parseInt(e.target.value) || 0)} style={{ fontSize: '3rem', width: '100px', textAlign: 'center', background: 'var(--color-black)', border: '2px solid var(--color-blood-red)', color: 'var(--color-blood-bright)', fontWeight: 'bold' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--color-bone)', fontFamily: 'var(--font-varsity)', fontSize: '1.2rem' }}>{t.match.casualties}</label>
              <input type="number" min="0" value={awayCas} onChange={e => setAwayCas(parseInt(e.target.value) || 0)} style={{ fontSize: '2rem', width: '80px', textAlign: 'center', background: 'var(--color-black)', border: '2px solid var(--color-mud)', color: 'var(--color-bone)' }} />
            </div>
          </div>
        </div>
        
      </div>

      {/* Player Stats Grids */}
      <h2 style={{ marginBottom: '1rem', borderBottom: '2px solid var(--color-mud)', paddingBottom: '0.5rem' }}>{t.match.postMatchReports}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {renderTeamStats(match.home_name, match.homePlayers, match.home_team_id, match.home_color)}
        {renderTeamStats(match.away_name, match.awayPlayers, match.away_team_id, match.away_color)}
      </div>

    </div>
  );
}
