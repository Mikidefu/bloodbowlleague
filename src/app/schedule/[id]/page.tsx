'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Save, ChevronDown, ChevronRight, ShieldAlert, Clock } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { displayMatchType } from '@/lib/matchTypes';
import PageHeader from '@/components/brand/PageHeader';
import SectionTitle from '@/components/brand/SectionTitle';
import TapeStrip from '@/components/brand/TapeStrip';
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

// Il colore squadra arriva dal DB: lo passiamo come variabile CSS e lo usiamo solo come accento
const teamAccent = (color: string | null | undefined) =>
  (color ? { '--team-color': color } : undefined) as React.CSSProperties | undefined;

const pad = (n: number) => String(n).padStart(2, '0');

const STAT_COLUMNS: { field: StatField; label: string; title: string }[] = [
  { field: 'td', label: 'TD', title: 'Touchdowns' },
  { field: 'cas', label: 'CAS', title: 'Casualties' },
  { field: 'int', label: 'INT', title: 'Interceptions' },
  { field: 'comp', label: 'CMP', title: 'Completions' },
  { field: 'mvp', label: 'MVP', title: 'MVP' },
];

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

  // Le partite delle stagioni concluse restano consultabili ma non modificabili
  const canEdit = isAdmin && match?.season_status === 'active';

  if (loading || !match) return <div className="loading-state">Loading Graphics...</div>;

  const toggleTeam = (teamId: string) => {
    setExpandedTeams(prev => ({ ...prev, [teamId]: !prev[teamId] }));
  };

  const statusClass = (status: string) =>
      status === 'Dead' ? styles.statusDead : status === 'Injured' ? styles.statusInjured : '';

  const renderTeamStats = (index: string, side: 'home' | 'away', teamName: string, teamId: string, teamColor: string | null) => {
    const isExpanded = !!expandedTeams[teamId];
    const roster = playerStats.filter(p => p.team_id === teamId);

    return (
        <section className={`${styles.teamReport} ${isExpanded ? styles.teamReportOpen : ''}`} style={teamAccent(teamColor)}>
          {/* Non un <button>: dentro il fieldset disabilitato deve restare apribile anche per i non-admin */}
          <div
              role="button"
              tabIndex={0}
              aria-expanded={isExpanded}
              onClick={() => toggleTeam(teamId)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleTeam(teamId);
                }
              }}
              className={styles.teamToggle}
          >
            <SectionTitle
                index={index}
                on="light"
                micro={`${side === 'home' ? 'Home' : 'Away'} // ${pad(roster.length)} // ${t.match.postMatchReports}`}
                title={`${teamName} ${t.match.players}`}
                action={
                  <span className={`chamfer ${styles.toggleIcon}`} aria-hidden="true">
                    {isExpanded ? <ChevronDown size={28} /> : <ChevronRight size={28} />}
                  </span>
                }
            />
          </div>

          {isExpanded && (
              <div className={`offset-frame ${styles.tableFrame}`}>
              <div className={`table-container ${styles.tableContainer}`}>
                <div className="stars-bar" aria-hidden="true" />
                <div className={styles.tableScroll}>
                  <table className={`data-table ${styles.statsTable}`}>
                    <thead>
                    <tr>
                      <th className={`num ${styles.colJersey}`}>N°</th>
                      <th>{t.match.thPlayer}</th>
                      {STAT_COLUMNS.map(col => (
                          <th key={col.field} title={col.title} className={`num ${styles.colStat}`}>{col.label}</th>
                      ))}
                      <th title="Status" className={styles.colStatus}>STATUS</th>
                    </tr>
                    </thead>
                    <tbody>
                    {roster.map((stat) => (
                        <tr key={stat.player_id} className={stat.status === 'Dead' ? styles.rowDead : undefined}>

                          {/* ICONA MAGLIETTA CON NUMERO */}
                          <td className="num">
                            <div className={styles.jersey}>
                              <svg viewBox="0 0 64 64" className={styles.jerseyIcon} aria-hidden="true">
                                <path d="M16 8 L48 8 L60 24 L50 32 L46 28 L46 60 L18 60 L18 28 L14 32 L4 24 Z" style={{ fill: teamColor ?? undefined }} />
                              </svg>
                              <span className={styles.jerseyNumber}>{stat.jersey_number || '-'}</span>
                            </div>
                          </td>

                          <td className={styles.playerName}>{stat.name}</td>

                          {STAT_COLUMNS.map(col => (
                              <td key={col.field} className={`num ${styles.statCell}`}>
                                <input
                                    type="number"
                                    min="0"
                                    max={col.field === 'mvp' ? '1' : undefined}
                                    value={zeroAsEmpty(stat[col.field])}
                                    placeholder="0"
                                    aria-label={`${stat.name} ${col.label}`}
                                    onChange={e => handleStatChange(stat.player_id, col.field, toNumericInput(e.target.value))}
                                    className={styles.statsInput}
                                    disabled={stat.status === 'Dead'}
                                />
                              </td>
                          ))}

                          <td>
                            <select
                                value={stat.status}
                                onChange={e => handleStatusChange(stat.player_id, e.target.value)}
                                className={`${styles.statusSelect} ${statusClass(stat.status)}`}
                                aria-label={`${stat.name} status`}
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
              </div>
              </div>
          )}
        </section>
    );
  };

  const renderSide = (
      side: 'home' | 'away',
      name: string,
      logo: string | null,
      color: string | null,
      score: NumericInput,
      setScore: (v: NumericInput) => void,
      cas: NumericInput,
      setCas: (v: NumericInput) => void,
  ) => (
      <div className={`${styles.side} ${side === 'home' ? styles.sideHome : styles.sideAway}`} style={teamAccent(color)}>
        <span className={styles.sideCode} aria-hidden="true">{side === 'home' ? 'HOME // H' : 'AWAY // A'}</span>
        <div className={styles.logoRing}>
          {logo ? (
              <img src={logo} alt={side === 'home' ? 'Home Logo' : 'Away Logo'} className={styles.logoImage} />
          ) : (
              <ShieldAlert size={56} className={styles.logoFallback} />
          )}
        </div>
        <div className={styles.teamName}>{name}</div>

        <div className={styles.scoreItem}>
          <label htmlFor={`${side}-td`} className={styles.scoreLabel}>TD</label>
          <input id={`${side}-td`} type="number" min="0" value={zeroAsEmpty(score)} placeholder="0" onChange={e => setScore(toNumericInput(e.target.value))} className={styles.scoreInput} />
        </div>
        <div className={styles.casItem}>
          <label htmlFor={`${side}-cas`} className={styles.scoreLabel}>CAS</label>
          <input id={`${side}-cas`} type="number" min="0" value={zeroAsEmpty(cas)} placeholder="0" onChange={e => setCas(toNumericInput(e.target.value))} className={styles.casInput} />
        </div>
      </div>
  );

  return (
      <div className={styles.page}>
        <PageHeader
            kicker="BLOODBOWL LEAGUE"
            title={`${displayMatchType(match.match_type)} - ROUND ${match.round}`}
            subtitle={match.season_name ?? undefined}
            actions={canEdit ? (
                <>
                  <button type="button" className="btn btn-slate" onClick={handleSaveDate} disabled={saving}>
                    <Clock size={20} /> {t.match.saveDateOnly}
                  </button>
                  <button type="button" className="btn btn-gold" onClick={handleSave} disabled={saving}>
                    <Save size={20} /> {saving ? t.match.saving : t.match.saveResults}
                  </button>
                </>
            ) : undefined}
        />

        {/* Per i non-admin tutti i campi sono in sola lettura */}
        <fieldset disabled={!canEdit} className={styles.fieldset}>
          {/* TABELLONE DELLA PARTITA: versus con diagonale nei colori delle squadre */}
          <section
              className={`bleed ${styles.scoreboard}`}
              style={{
                ...(match.home_color ? { ['--home-color' as string]: match.home_color } : {}),
                ...(match.away_color ? { ['--away-color' as string]: match.away_color } : {}),
              }}
          >
            <div className={styles.tintHome} aria-hidden="true" />
            <div className={styles.tintAway} aria-hidden="true" />
            <div className={styles.splitLine} aria-hidden="true" />
            <span className={`ghost-text ${styles.ghostVs}`} aria-hidden="true">VS</span>

            <div className={styles.inner}>
              <div className={styles.boardTop}>
                <span className={styles.boardMicro}>
                  <i className={styles.microSquares} aria-hidden="true" />
                  {`R${pad(match.round || 0)} // ${displayMatchType(match.match_type)} // KICK-OFF`}
                </span>
                <h2 className={styles.matchdayTitle}>MATCHDAY <span>{pad(match.round || 0)}</span></h2>
                <div className={`chamfer ${styles.kickoff}`}>
                  <label htmlFor="match-kickoff" className={styles.kickoffLabel}>KICK-OFF:</label>
                  <input
                      id="match-kickoff"
                      type="datetime-local"
                      value={matchDate}
                      onChange={(e) => setMatchDate(e.target.value)}
                      className={styles.kickoffInput}
                  />
                </div>
              </div>

              <div className={styles.faceoff}>
                {renderSide('home', match.home_name, match.home_logo, match.home_color, homeScore, setHomeScore, homeCas, setHomeCas)}
                <div className={styles.vs} aria-hidden="true">VS</div>
                {renderSide('away', match.away_name, match.away_logo, match.away_color, awayScore, setAwayScore, awayCas, setAwayCas)}
              </div>
            </div>
          </section>

          <div className={`bleed ${styles.tapeWrap}`}>
            <TapeStrip tone="mustard" angle={-1.5} moving={false} text={`${match.home_name} ✦ VS ✦ ${match.away_name}`} />
          </div>

          {/* TABELLE DEI GIOCATORI */}
          <section className={`bleed ${styles.reports}`}>
            <span className={`ghost-text on-light ${styles.ghostReport}`} aria-hidden="true">Report</span>
            <div className={`${styles.inner} ${styles.teamReports}`}>
              {renderTeamStats('01', 'home', match.home_name, match.home_team_id, match.home_color)}
              {renderTeamStats('02', 'away', match.away_name, match.away_team_id, match.away_color)}
            </div>
          </section>
        </fieldset>
      </div>
  );
}
