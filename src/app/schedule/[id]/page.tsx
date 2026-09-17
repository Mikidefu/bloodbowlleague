'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Save, ChevronDown, ChevronRight, ShieldAlert, Clock } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { displayMatchType } from '@/lib/matchTypes';
import styles from './MatchDetails.module.css';
import { isTrue, type MatchDetails } from '@/lib/types';

// Valore di un campo numerico mentre l'utente scrive: '' = campo svuotato
type NumericInput = number | '';
type StatField = 'td' | 'cas' | 'int' | 'comp' | 'mvp';
type PlayerStatDraft = {
  player_id: string;
  jersey_number: number | null;
  name: string;
  team_id: string;
  status: string;
} & Record<StatField, NumericInput>;

const toNumericInput = (value: string): NumericInput => (value === '' ? '' : Math.max(0, parseInt(value, 10) || 0));
// Lo zero si mostra come campo vuoto con placeholder "0", così si può scrivere subito sopra
const zeroAsEmpty = (value: NumericInput) => (value === 0 ? '' : value);

export default function MatchDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const { t } = useLanguage();
  const { isAdmin } = useAuth();

  const [match, setMatch] = useState<MatchDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({});

  const [homeScore, setHomeScore] = useState<NumericInput>(0);
  const [awayScore, setAwayScore] = useState<NumericInput>(0);
  const [homeCas, setHomeCas] = useState<NumericInput>(0);
  const [awayCas, setAwayCas] = useState<NumericInput>(0);

  // STATO PER LA DATA
  const [matchDate, setMatchDate] = useState('');

  const [playerStats, setPlayerStats] = useState<PlayerStatDraft[]>([]);

  useEffect(() => {
    fetch(`/api/schedule/${id}`)
        .then(res => res.json())
        .then((data: MatchDetails) => {
          setMatch(data);
          setHomeScore(data.home_score || 0);
          setAwayScore(data.away_score || 0);
          setHomeCas(data.home_casualties || 0);
          setAwayCas(data.away_casualties || 0);
          setMatchDate(data.match_date || ''); // IMPOSTA LA DATA

          const initialStats = [...data.homePlayers, ...data.awayPlayers].map((p): PlayerStatDraft => {
            const existing = data.stats.find(s => s.player_id === p.id);

            let currentStatus = 'Active';
            if (isTrue(p.dead)) currentStatus = 'Dead';
            else if (isTrue(p.mng)) currentStatus = 'Injured';

            return {
              player_id: p.id,
              jersey_number: p.jersey_number,
              name: p.name,
              team_id: p.team_id,
              td: existing ? existing.touchdowns : 0,
              cas: existing ? existing.casualties : 0,
              int: existing ? existing.interceptions : 0,
              comp: existing ? existing.completions : 0,
              mvp: existing ? existing.mvp : 0,
              status: currentStatus
            };
          });
          setPlayerStats(initialStats);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          router.push('/schedule');
        });
  }, [id, router]);

  // Ora accetta stringhe vuote
  const handleStatChange = (playerId: string, field: StatField, value: NumericInput) => {
    setPlayerStats(prev => {
      const updatedStats = prev.map(p => p.player_id === playerId ? { ...p, [field]: value } : p);

      if (field === 'td' || field === 'cas') {
        let hScore = 0, aScore = 0, hCas = 0, aCas = 0;

        updatedStats.forEach(p => {
          const isHome = match?.homePlayers.some(h => h.id === p.player_id);
          if (isHome) {
            hScore += Number(p.td) || 0; // Somma forzando a numero (se vuoto diventa 0)
            hCas += Number(p.cas) || 0;
          } else {
            aScore += Number(p.td) || 0;
            aCas += Number(p.cas) || 0;
          }
        });

        setHomeScore(hScore);
        setAwayScore(aScore);
        setHomeCas(hCas);
        setAwayCas(aCas);
      }

      return updatedStats;
    });
  };

  const handleStatusChange = (playerId: string, status: string) => {
    setPlayerStats(prev => prev.map(p => p.player_id === playerId ? { ...p, status } : p));
  };

  // Cambia solo la data: la partita non viene segnata come giocata
  const handleSaveDate = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/schedule/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date_only: true, match_date: matchDate })
      });
      if (res.ok) router.push('/schedule');
      else alert('Failed to save match date');
    } catch {
      alert('Error saving match date');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Puliamo i dati vuoti forzandoli a 0 prima di inviarli al DB
      const cleanPlayerStats = playerStats.map(p => ({
        ...p,
        td: Number(p.td) || 0,
        cas: Number(p.cas) || 0,
        int: Number(p.int) || 0,
        comp: Number(p.comp) || 0,
        mvp: Number(p.mvp) || 0,
      }));

      const res = await fetch(`/api/schedule/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          home_score: Number(homeScore) || 0,
          away_score: Number(awayScore) || 0,
          home_casualties: Number(homeCas) || 0,
          away_casualties: Number(awayCas) || 0,
          match_date: matchDate, // SALVA LA DATA MODIFICATA
          playerStats: cleanPlayerStats
        })
      });

      if (res.ok) {
        router.refresh();
        router.push('/schedule');
      } else {
        alert('Failed to save match results');
      }
    } catch {
      alert('Error saving match');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !match) return <div style={{ fontFamily: 'var(--font-typewriter)', color: 'var(--color-ink)', textShadow: '1px 1px 0 #fff' }}>Loading Graphics...</div>;

  const toggleTeam = (teamId: string) => {
    setExpandedTeams(prev => ({ ...prev, [teamId]: !prev[teamId] }));
  };

  const renderTeamStats = (teamName: string, teamId: string, teamColor: string | null) => {
    const isExpanded = !!expandedTeams[teamId];

    return (
        <div className={styles.folderTab} style={{ borderTop: `8px solid ${teamColor || '#333'}` }}>
          <div
              onClick={() => toggleTeam(teamId)}
              style={{ padding: '1.5rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
          >
            <h3 style={{ margin: 0, color: 'var(--color-paper)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.8rem', fontFamily: 'var(--font-impact)', letterSpacing: '1px' }}>
              {isExpanded ? <ChevronDown size={28} color={teamColor || undefined} /> : <ChevronRight size={28} color={teamColor || undefined} />}
              {teamName} {t.match.players}
            </h3>
          </div>

          {isExpanded && (
              <div className={styles.tableWrapper}>
                <table className="data-table" style={{ minWidth: '950px', margin: 0 }}>
                  <thead className={styles.stickyHeader}>
                  <tr>
                    <th style={{ width: '60px', textAlign: 'center', padding: '1rem', fontFamily: 'var(--font-impact)', letterSpacing: '1px', fontSize: '1.2rem' }}>N°</th>
                    <th style={{ padding: '1rem', fontFamily: 'var(--font-impact)', letterSpacing: '1px', fontSize: '1.2rem', textAlign: 'left' }}>{t.match.thPlayer}</th>
                    <th title="Touchdowns" style={{ width: '100px', textAlign: 'center', padding: '1rem', fontFamily: 'var(--font-impact)', letterSpacing: '1px', fontSize: '1.2rem' }}>TD</th>
                    <th title="Casualties" style={{ width: '100px', textAlign: 'center', padding: '1rem', fontFamily: 'var(--font-impact)', letterSpacing: '1px', fontSize: '1.2rem' }}>CAS</th>
                    <th title="Interceptions" style={{ width: '100px', textAlign: 'center', padding: '1rem', fontFamily: 'var(--font-impact)', letterSpacing: '1px', fontSize: '1.2rem' }}>INT</th>
                    <th title="Completions" style={{ width: '100px', textAlign: 'center', padding: '1rem', fontFamily: 'var(--font-impact)', letterSpacing: '1px', fontSize: '1.2rem' }}>CMP</th>
                    <th title="MVP" style={{ width: '100px', textAlign: 'center', padding: '1rem', fontFamily: 'var(--font-impact)', letterSpacing: '1px', fontSize: '1.2rem' }}>MVP</th>
                    <th title="Status" style={{ width: '150px', padding: '1rem', fontFamily: 'var(--font-impact)', letterSpacing: '1px', fontSize: '1.2rem' }}>STATUS</th>
                  </tr>
                  </thead>
                  <tbody>
                  {playerStats.filter(p => p.team_id === teamId).map((stat) => (
                      <tr key={stat.player_id} className={styles.playerRow} style={{ opacity: stat.status === 'Dead' ? 0.5 : 1 }}>

                        {/* ICONA MAGLIETTA CON NUMERO */}
                        <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                          <div style={{ position: 'relative', width: '40px', height: '40px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg viewBox="0 0 64 64" style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, zIndex: 0, filter: 'drop-shadow(2px 2px 0px rgba(0,0,0,0.4))' }}>
                              <path d="M16 8 L48 8 L60 24 L50 32 L46 28 L46 60 L18 60 L18 28 L14 32 L4 24 Z" fill={teamColor || '#333'} stroke={'#111'} strokeWidth="3" strokeLinejoin="round" />
                            </svg>
                            <span style={{ position: 'relative', zIndex: 1, fontFamily: 'var(--font-impact)', fontSize: '1.2rem', color: '#fff', textShadow: `1px 1px 0px #000` }}>
                              {stat.jersey_number || '-'}
                            </span>
                          </div>
                        </td>

                        {/* NOME GIOCATORE CON MIN-WIDTH PER NON SCHIACCIARSI */}
                        <td className={styles.playerName} style={{ padding: '1rem', whiteSpace: 'normal', minWidth: '220px', textDecoration: stat.status === 'Dead' ? 'line-through' : 'none' }}>
                          {stat.name}
                        </td>

                        <td style={{ textAlign: 'center', padding: '1rem' }}>
                          {/* e.target.value === '' evita lo zero bloccato */}
                          <input type="number" min="0" value={zeroAsEmpty(stat.td)} placeholder="0" onChange={e => handleStatChange(stat.player_id, 'td', toNumericInput(e.target.value))} className={styles.statsInput} disabled={stat.status === 'Dead'} />
                        </td>
                        <td style={{ textAlign: 'center', padding: '1rem' }}>
                          <input type="number" min="0" value={zeroAsEmpty(stat.cas)} placeholder="0" onChange={e => handleStatChange(stat.player_id, 'cas', toNumericInput(e.target.value))} className={styles.statsInput} disabled={stat.status === 'Dead'} />
                        </td>
                        <td style={{ textAlign: 'center', padding: '1rem' }}>
                          <input type="number" min="0" value={zeroAsEmpty(stat.int)} placeholder="0" onChange={e => handleStatChange(stat.player_id, 'int', toNumericInput(e.target.value))} className={styles.statsInput} disabled={stat.status === 'Dead'} />
                        </td>
                        <td style={{ textAlign: 'center', padding: '1rem' }}>
                          <input type="number" min="0" value={zeroAsEmpty(stat.comp)} placeholder="0" onChange={e => handleStatChange(stat.player_id, 'comp', toNumericInput(e.target.value))} className={styles.statsInput} disabled={stat.status === 'Dead'} />
                        </td>
                        <td style={{ textAlign: 'center', padding: '1rem' }}>
                          <input type="number" min="0" max="1" value={zeroAsEmpty(stat.mvp)} placeholder="0" onChange={e => handleStatChange(stat.player_id, 'mvp', toNumericInput(e.target.value))} className={styles.statsInput} disabled={stat.status === 'Dead'} />
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <select
                              value={stat.status}
                              onChange={e => handleStatusChange(stat.player_id, e.target.value)}
                              className={styles.statusSelect}
                              style={{
                                color: stat.status === 'Dead' ? 'var(--color-blood-bright)' : stat.status === 'Injured' ? '#f59e0b' : 'var(--color-ink)',
                                borderColor: stat.status === 'Dead' ? 'var(--color-blood-bright)' : stat.status === 'Injured' ? '#f59e0b' : 'var(--color-ink)',
                              }}
                          >
                            <option value="Active">ACTIVE</option>
                            <option value="Injured">MNG (INJ)</option>
                            <option value="Dead">DEAD (RIP)</option>
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
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '2.5rem', color: 'var(--color-ink)', textShadow: '2px 2px 0 var(--color-paper), -1px -1px 0 var(--color-paper), 1px -1px 0 var(--color-paper), -1px 1px 0 var(--color-paper), 1px 1px 0 var(--color-paper)', fontFamily: 'var(--font-impact)', letterSpacing: '2px', textTransform: 'uppercase' }}>
            {displayMatchType(match.match_type)} - ROUND {match.round}
          </h1>
          {isAdmin && (
              <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                <button className="btn" onClick={handleSaveDate} disabled={saving} style={{ fontFamily: 'var(--font-impact)', letterSpacing: '1px', fontSize: '1.2rem', padding: '0.5rem 1.5rem', boxShadow: '4px 4px 0 var(--color-ink)', background: '#fff' }}>
                  <Clock size={20} /> {t.match.saveDateOnly}
                </button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ fontFamily: 'var(--font-impact)', letterSpacing: '1px', fontSize: '1.2rem', padding: '0.5rem 1.5rem', boxShadow: '4px 4px 0 var(--color-ink)' }}>
                  <Save size={20} /> {saving ? t.match.saving : t.match.saveResults}
                </button>
              </div>
          )}
        </div>

        {/* Per i non-admin tutti i campi sono in sola lettura */}
        <fieldset disabled={!isAdmin} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        {/* GRAFICA MODERNA MATCHDAY CON EFFETTO GRUNGE */}
        <div className={styles.matchdayGraphic}>

          <svg style={{ width: 0, height: 0, position: 'absolute' }}>
            <filter id="rough-edges">
              <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="8" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </svg>

          <div className={styles.grungeOverlay}></div>

          <div className={`${styles.shard} ${styles.shardHomeDark}`}></div>
          <div className={`${styles.shard} ${styles.shardHomeColor}`} style={{ background: match.home_color ?? undefined }}></div>

          <div className={`${styles.shard} ${styles.shardAwayDark}`}></div>
          <div className={`${styles.shard} ${styles.shardAwayColor}`} style={{ background: match.away_color ?? undefined }}></div>

          <div className={styles.titleContainer}>
            <div className={styles.leagueTitle}>BLOODBOWL LEAGUE</div>
            <h1 className={styles.matchdayText}>MATCHDAY</h1>

            {/* NUOVO CAMPO DATA/ORA MODIFICABILE */}
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontFamily: 'var(--font-typewriter)', fontWeight: 'bold', color: '#111' }}>KICK-OFF:</label>
              <input
                  type="datetime-local"
                  value={matchDate}
                  onChange={(e) => setMatchDate(e.target.value)}
                  style={{
                    padding: '0.5rem 1rem',
                    fontFamily: 'var(--font-typewriter)',
                    fontSize: '1rem',
                    border: '3px solid var(--color-ink)',
                    background: '#fff',
                    color: 'var(--color-ink)',
                    fontWeight: 'bold',
                    boxShadow: '4px 4px 0 var(--color-ink)'
                  }}
              />
            </div>
          </div>

          <div className={styles.showcaseArea}>
            {/* HOME */}
            <div className={styles.teamSide}>
              <div className={`${styles.cursiveName} ${styles.cursiveHome}`} style={{ color: match.home_color ?? undefined }}>
                {match.home_name}
              </div>
              <div className={`${styles.logoBox} ${styles.logoBoxHome}`} style={{ backgroundColor: match.home_color ?? undefined }}>
                {match.home_logo ? (
                    <img src={match.home_logo} alt="Home Logo" className={styles.logoImage} />
                ) : (
                    <ShieldAlert size={80} color="#fff" />
                )}
              </div>
              <div className={styles.readableTeamName}>{match.home_name}</div>
            </div>

            <div className={styles.vsBadge}>VS</div>

            {/* AWAY */}
            <div className={styles.teamSide}>
              <div className={`${styles.cursiveName} ${styles.cursiveAway}`} style={{ color: match.away_color ?? undefined }}>
                {match.away_name}
              </div>
              <div className={`${styles.logoBox} ${styles.logoBoxAway}`} style={{ backgroundColor: match.away_color ?? undefined }}>
                {match.away_logo ? (
                    <img src={match.away_logo} alt="Away Logo" className={styles.logoImage} />
                ) : (
                    <ShieldAlert size={80} color="#fff" />
                )}
              </div>
              <div className={styles.readableTeamName}>{match.away_name}</div>
            </div>
          </div>

          {/* PANNELLO PUNTEGGI */}
          <div className={styles.scoresPanel}>
            {/* HOME SCORES */}
            <div className={styles.scoreGroup}>
              <div className={styles.statItem}>
                <label className={styles.label}>TD</label>
                <input type="number" min="0" value={zeroAsEmpty(homeScore)} placeholder="0" onChange={e => setHomeScore(toNumericInput(e.target.value))} className={styles.scoreInput} style={{ color: match.home_color || undefined }} />
              </div>
              <div className={styles.statItem}>
                <label className={styles.label}>CAS</label>
                <input type="number" min="0" value={zeroAsEmpty(homeCas)} placeholder="0" onChange={e => setHomeCas(toNumericInput(e.target.value))} className={styles.casInput} />
              </div>
            </div>

            {/* AWAY SCORES */}
            <div className={styles.scoreGroup}>
              <div className={styles.statItem}>
                <label className={styles.label}>TD</label>
                <input type="number" min="0" value={zeroAsEmpty(awayScore)} placeholder="0" onChange={e => setAwayScore(toNumericInput(e.target.value))} className={styles.scoreInput} style={{ color: match.away_color || undefined }} />
              </div>
              <div className={styles.statItem}>
                <label className={styles.label}>CAS</label>
                <input type="number" min="0" value={zeroAsEmpty(awayCas)} placeholder="0" onChange={e => setAwayCas(toNumericInput(e.target.value))} className={styles.casInput} />
              </div>
            </div>
          </div>

        </div>

        {/* TABELLE DEI GIOCATORI */}
        <h2 style={{ marginBottom: '1.5rem', color: 'var(--color-ink)', borderBottom: '4px solid var(--color-ink)', paddingBottom: '0.5rem', fontFamily: 'var(--font-impact)', fontSize: '2rem', textTransform: 'uppercase', letterSpacing: '2px', textShadow: '2px 2px 0 var(--color-paper), -1px -1px 0 var(--color-paper), 1px -1px 0 var(--color-paper), -1px 1px 0 var(--color-paper), 1px 1px 0 var(--color-paper)' }}>
          {t.match.postMatchReports}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {renderTeamStats(match.home_name, match.home_team_id, match.home_color)}
          {renderTeamStats(match.away_name, match.away_team_id, match.away_color)}
        </div>
        </fieldset>

      </div>
  );
}