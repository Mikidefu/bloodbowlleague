'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Save, ChevronDown, ChevronRight, ShieldAlert } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import styles from './MatchDetails.module.css';

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
        router.refresh();
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

  if (loading || !match) return <div style={{ fontFamily: 'var(--font-typewriter)', color: '#fff' }}>Loading Graphics...</div>;

  const toggleTeam = (teamId: string) => {
    setExpandedTeams(prev => ({ ...prev, [teamId]: !prev[teamId] }));
  };

  const renderTeamStats = (teamName: string, players: any[], teamId: string, teamColor: string) => {
    const isExpanded = !!expandedTeams[teamId];

    return (
        <div className={styles.folderTab} style={{ borderTop: `6px solid ${teamColor}` }}>
          <div
              onClick={() => toggleTeam(teamId)}
              style={{ padding: '1.5rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
          >
            <h3 style={{ margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.8rem', fontFamily: 'var(--font-varsity)' }}>
              {isExpanded ? <ChevronDown size={28} color={teamColor} /> : <ChevronRight size={28} color={teamColor} />}
              {teamName} {t.match.players}
            </h3>
          </div>

          {isExpanded && (
              <div className={styles.tableWrapper}>
                <table className="data-table" style={{ minWidth: '900px', margin: 0 }}>
                  <thead className={styles.stickyHeader}>
                  <tr>
                    <th style={{ padding: '1rem' }}>{t.match.thPlayer}</th>
                    <th title="Touchdowns" style={{ width: '90px', textAlign: 'center', padding: '1rem' }}>TD</th>
                    <th title="Casualties" style={{ width: '90px', textAlign: 'center', padding: '1rem' }}>CAS</th>
                    <th title="Interceptions" style={{ width: '90px', textAlign: 'center', padding: '1rem' }}>INT</th>
                    <th title="Completions" style={{ width: '90px', textAlign: 'center', padding: '1rem' }}>CMP</th>
                    <th title="MVP" style={{ width: '90px', textAlign: 'center', padding: '1rem' }}>MVP</th>
                    <th title="Status" style={{ width: '130px', padding: '1rem' }}>Status</th>
                  </tr>
                  </thead>
                  <tbody>
                  {playerStats.filter(p => match.homePlayers.find((h: any) => h.id === p.player_id && h.team_id === teamId) || match.awayPlayers.find((a: any) => a.id === p.player_id && a.team_id === teamId)).map((stat) => (
                      /* FORZATURA COLORI PER RISOLVERE IL PROBLEMA DELLA FOTO */
                      <tr key={stat.player_id} className={styles.playerRow}>
                        <td className={styles.playerName} style={{ padding: '1rem', whiteSpace: 'nowrap' }}>{stat.name}</td>
                        <td style={{ textAlign: 'center', padding: '1rem' }}>
                          <input type="number" min="0" value={stat.td} onChange={e => handleStatChange(stat.player_id, 'td', parseInt(e.target.value) || 0)} className={styles.statsInput} />
                        </td>
                        <td style={{ textAlign: 'center', padding: '1rem' }}>
                          <input type="number" min="0" value={stat.cas} onChange={e => handleStatChange(stat.player_id, 'cas', parseInt(e.target.value) || 0)} className={styles.statsInput} />
                        </td>
                        <td style={{ textAlign: 'center', padding: '1rem' }}>
                          <input type="number" min="0" value={stat.int} onChange={e => handleStatChange(stat.player_id, 'int', parseInt(e.target.value) || 0)} className={styles.statsInput} />
                        </td>
                        <td style={{ textAlign: 'center', padding: '1rem' }}>
                          <input type="number" min="0" value={stat.comp} onChange={e => handleStatChange(stat.player_id, 'comp', parseInt(e.target.value) || 0)} className={styles.statsInput} />
                        </td>
                        <td style={{ textAlign: 'center', padding: '1rem' }}>
                          <input type="number" min="0" max="1" value={stat.mvp} onChange={e => handleStatChange(stat.player_id, 'mvp', parseInt(e.target.value) || 0)} className={styles.statsInput} />
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <select value={stat.status} onChange={e => handleStatusChange(stat.player_id, e.target.value)} className={styles.statusSelect}>
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
      <div style={{ width: '100%', overflowX: 'hidden', padding: '1rem' }}>
        <div className={styles.reportHeader}>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '2.5rem', color: '#fff' }}>
            {match.match_type} - Round {match.round}
          </h1>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={20} /> {saving ? t.match.saving : t.match.saveResults}
          </button>
        </div>

        {/* GRAFICA MODERNA MATCHDAY CON EFFETTO GRUNGE */}
        <div className={styles.matchdayGraphic}>

          {/* DEFINIZIONE FILTRO SVG PER STRAPPARE I BORDI */}
          <svg style={{ width: 0, height: 0, position: 'absolute' }}>
            <filter id="rough-edges">
              <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="8" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </svg>

          {/* OVERLAY SPORCO */}
          <div className={styles.grungeOverlay}></div>

          {/* BACKGROUND SHARDS (Forme geometriche Strappate) */}
          <div className={`${styles.shard} ${styles.shardHomeDark}`}></div>
          <div className={`${styles.shard} ${styles.shardHomeColor}`} style={{ background: match.home_color }}></div>

          <div className={`${styles.shard} ${styles.shardAwayDark}`}></div>
          <div className={`${styles.shard} ${styles.shardAwayColor}`} style={{ background: match.away_color }}></div>

          {/* TITOLO IN ALTO */}
          <div className={styles.titleContainer}>
            <div className={styles.leagueTitle}>BLOODBOWL LEAGUE</div>
            <h1 className={styles.matchdayText}>MATCHDAY</h1>
          </div>

          {/* LOGHI SQUADRE E NOMI */}
          <div className={styles.showcaseArea}>
            {/* HOME */}
            <div className={styles.teamSide}>
              <div className={`${styles.cursiveName} ${styles.cursiveHome}`} style={{ color: match.home_color }}>
                {match.home_name}
              </div>
              <div className={`${styles.logoBox} ${styles.logoBoxHome}`} style={{ backgroundColor: match.home_color }}>
                {match.home_logo ? (
                    <img src={match.home_logo} alt="Home Logo" className={styles.logoImage} />
                ) : (
                    <ShieldAlert size={80} color="#fff" />
                )}
              </div>
              {/* NOME SQUADRA CHIARO E LEGGIBILE */}
              <div className={styles.readableTeamName}>{match.home_name}</div>
            </div>

            {/* VS CENTER */}
            <div className={styles.vsBadge}>VS</div>

            {/* AWAY */}
            <div className={styles.teamSide}>
              <div className={`${styles.cursiveName} ${styles.cursiveAway}`} style={{ color: match.away_color }}>
                {match.away_name}
              </div>
              <div className={`${styles.logoBox} ${styles.logoBoxAway}`} style={{ backgroundColor: match.away_color }}>
                {match.away_logo ? (
                    <img src={match.away_logo} alt="Away Logo" className={styles.logoImage} />
                ) : (
                    <ShieldAlert size={80} color="#fff" />
                )}
              </div>
              {/* NOME SQUADRA CHIARO E LEGGIBILE */}
              <div className={styles.readableTeamName}>{match.away_name}</div>
            </div>
          </div>

          {/* PANNELLO PUNTEGGI */}
          <div className={styles.scoresPanel}>
            {/* HOME SCORES */}
            <div className={styles.scoreGroup}>
              <div className={styles.statItem}>
                <label className={styles.label}>TD</label>
                <input type="number" min="0" value={homeScore} onChange={e => setHomeScore(parseInt(e.target.value) || 0)} className={styles.scoreInput} style={{ color: match.home_color }} />
              </div>
              <div className={styles.statItem}>
                <label className={styles.label}>CAS</label>
                <input type="number" min="0" value={homeCas} onChange={e => setHomeCas(parseInt(e.target.value) || 0)} className={styles.casInput} />
              </div>
            </div>

            {/* AWAY SCORES */}
            <div className={styles.scoreGroup}>
              <div className={styles.statItem}>
                <label className={styles.label}>TD</label>
                <input type="number" min="0" value={awayScore} onChange={e => setAwayScore(parseInt(e.target.value) || 0)} className={styles.scoreInput} style={{ color: match.away_color }} />
              </div>
              <div className={styles.statItem}>
                <label className={styles.label}>CAS</label>
                <input type="number" min="0" value={awayCas} onChange={e => setAwayCas(parseInt(e.target.value) || 0)} className={styles.casInput} />
              </div>
            </div>
          </div>

        </div>

        {/* TABELLE DEI GIOCATORI */}
        <h2 style={{ marginBottom: '1.5rem', color: '#fff', borderBottom: '2px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', fontFamily: 'var(--font-varsity)', fontSize: '2rem' }}>
          {t.match.postMatchReports}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {renderTeamStats(match.home_name, match.homePlayers, match.home_team_id, match.home_color)}
          {renderTeamStats(match.away_name, match.awayPlayers, match.away_team_id, match.away_color)}
        </div>

      </div>
  );
}