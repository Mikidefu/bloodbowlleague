'use client';
import { useState, useEffect, useCallback, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Save, ChevronDown, ChevronRight, ShieldAlert, Clock, Dices, Undo2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { displayMatchType, isLeagueMatch, MATCH_TYPES } from '@/lib/matchTypes';
import PageHeader from '@/components/brand/PageHeader';
import SectionTitle from '@/components/brand/SectionTitle';
import TapeStrip from '@/components/brand/TapeStrip';
import styles from './MatchDetails.module.css';
import PregamePanel from './PregamePanel';
import PregameWizard from './PregameWizard';
import InPlayPanel from './InPlayPanel';
import ReportWizard from './ReportWizard';
import PostgameWizard from './PostgameWizard';
import MatchPlayerStats from './MatchPlayerStats';
import LivePrefillNote from './LivePrefillNote';
import { livePrefill, type LivePrefill } from '@/lib/live/prefill';
import { toNumericInput, zeroAsEmpty, type NumericInput, type PlayerStatDraft, type StatField, type TeamResultDraft } from './reportModel';
import MatchTables from '@/components/match/MatchTables';
import { isTrue, type MatchDetails } from '@/lib/types';
import {
  CASUALTY_RESULTS, CONCEDE_QUIT_MIN_ADVANCEMENTS, LASTING_INJURIES, MATCH_OUTCOMES, casualtyInfo, concededScore, rollDie, winnings,
  type CasualtyResult, type InjuryStat, type MatchOutcome,
} from '@/lib/leagueRules';


// Il colore squadra arriva dal DB: lo passiamo come variabile CSS e lo usiamo solo come accento
const teamAccent = (color: string | null | undefined) =>
  (color ? { '--team-color': color } : undefined) as React.CSSProperties | undefined;

const pad = (n: number) => String(n).padStart(2, '0');

export default function MatchDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const { t, language } = useLanguage();
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

  // Esito e post-partita (regole di lega)
  const [outcome, setOutcome] = useState<MatchOutcome>('played');
  const [concededTeam, setConcededTeam] = useState('');
  const [penaltyWinner, setPenaltyWinner] = useState('');
  const [teamResults, setTeamResults] = useState<Record<string, TeamResultDraft>>({});

  // Percorso guidato: la fase si ricava dalla partita, questi flag spostano avanti o indietro a mano
  const [reportOpen, setReportOpen] = useState(false);     // "la partita è finita": dal campo al referto
  const [correcting, setCorrecting] = useState(false);     // correzione del referto dal post-partita
  const [redoPregame, setRedoPregame] = useState(false);   // rifare il pre-partita prima di giocare
  // Numeri della partita dal vivo per il referto (applied: già copiati nei campi)
  const [livePre, setLivePre] = useState<{ prefill: LivePrefill; applied: boolean } | null>(null);
  const liveAutoApplied = useRef(false);   // si copia da solo una volta: riaprendo il referto non si perdono le correzioni

  const STAT_COLUMNS: { field: StatField; label: string; title: string }[] = [
    { field: 'td', label: 'TD', title: 'Touchdowns (3 SPP)' },
    { field: 'cas', label: 'CAS', title: 'Casualties (2 SPP)' },
    { field: 'int', label: 'INT', title: 'Interceptions (2 SPP)' },
    { field: 'comp', label: 'CMP', title: 'Completions (1 SPP)' },
    { field: 'ttm', label: t.rules.ttm, title: t.rules.ttmTitle },
    { field: 'landing', label: t.rules.landing, title: t.rules.landingTitle },
    { field: 'mvp', label: 'MVP', title: 'MVP (4 SPP)' },
  ];

  const load = useCallback(() => {
    fetch(`/api/schedule/${id}`)
        .then(res => res.json())
        .then((data: MatchDetails) => {
          setMatch(data);
          setHomeScore(data.home_score || 0);
          setAwayScore(data.away_score || 0);
          setHomeCas(data.home_casualties || 0);
          setAwayCas(data.away_casualties || 0);
          setMatchDate(data.match_date || ''); // IMPOSTA LA DATA
          setOutcome((MATCH_OUTCOMES as string[]).includes(String(data.outcome)) ? data.outcome as MatchOutcome : 'played');
          setConcededTeam(data.conceded_team_id || '');
          setPenaltyWinner(data.penalty_winner_id || '');

          const results: Record<string, TeamResultDraft> = {};
          for (const teamId of [data.home_team_id, data.away_team_id]) {
            const report = data.reports.find(r => r.team_id === teamId);
            results[teamId] = { stalling: isTrue(report?.stalling), df_roll: report?.df_roll ? String(report.df_roll) : '', commitments_roll: '', quit_rolls: {} };
          }
          setTeamResults(results);

          const initialStats = [...data.homePlayers, ...data.awayPlayers].map((p): PlayerStatDraft => {
            const existing = data.stats.find(s => s.player_id === p.id);
            const injury = data.injuries.find(i => i.player_id === p.id);

            let currentStatus = 'Active';
            if (isTrue(p.dead)) currentStatus = 'Dead';
            else if (isTrue(p.mng)) currentStatus = 'Injured';

            return {
              player_id: p.id,
              jersey_number: p.jersey_number,
              name: p.name,
              team_id: p.team_id,
              unavailable: p.unavailable,
              advancements: p.advancements || 0,
              niggling: p.niggling_injuries || 0,
              td: existing ? existing.touchdowns : 0,
              cas: existing ? existing.casualties : 0,
              int: existing ? existing.interceptions : 0,
              comp: existing ? existing.completions : 0,
              ttm: existing ? existing.ttm || 0 : 0,
              landing: existing ? existing.landings || 0 : 0,
              mvp: existing ? existing.mvp : 0,
              status: currentStatus,
              injury: injury?.result ?? '',
              injuryStat: injury?.stat ?? '',
              hatred: injury?.hatred ?? '',
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

  useEffect(() => {
    load();
  }, [load]);

  // Aprendo la partita (es. da "Gioca partita") si arriva dritti al percorso guidato, se c'è
  useEffect(() => {
    if (!loading) document.getElementById('match-flow')?.scrollIntoView({ block: 'start' });
  }, [loading]);

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

  // Copia nel referto punteggio, Casualty e statistiche del live. Infortuni e MVP non si toccano.
  const applyLive = (prefill: LivePrefill) => {
    if (!match) return;
    setPlayerStats(prev => prev.map(p => {
      const s = prefill.players[p.player_id];
      return { ...p, td: s?.td ?? 0, cas: s?.cas ?? 0, int: s?.int ?? 0, comp: s?.comp ?? 0, ttm: s?.ttm ?? 0, landing: s?.landing ?? 0 };
    }));
    setHomeScore(prefill.scores[match.home_team_id] ?? 0);
    setAwayScore(prefill.scores[match.away_team_id] ?? 0);
    setHomeCas(prefill.casualties[match.home_team_id] ?? 0);
    setAwayCas(prefill.casualties[match.away_team_id] ?? 0);
    setLivePre({ prefill, applied: true });
  };

  // Aprendo il referto si guarda se c'è una partita dal vivo: su un referto nuovo i numeri si copiano subito,
  // correggendo un referto già salvato si propone soltanto (quello salvato potrebbe essere già stato corretto a mano)
  const loadLivePrefill = async (autoApply: boolean) => {
    if (!match) return;
    setLivePre(null);
    try {
      const json = await fetch(`/api/live/${id}`, { cache: 'no-store' }).then(r => r.json());
      const players = [...match.homePlayers, ...match.awayPlayers].map(p => ({ player_id: p.id, team_id: p.team_id, unavailable: p.unavailable }));
      const prefill = json?.live ? livePrefill(json.state, players) : null;
      if (!prefill) return;
      if (autoApply && !liveAutoApplied.current) {
        liveAutoApplied.current = true;
        applyLive(prefill);
      } else {
        setLivePre({ prefill, applied: false });
      }
    } catch { /* senza live il referto si compila a mano come sempre */ }
  };

  const updatePlayer = (playerId: string, patch: Partial<PlayerStatDraft>) => {
    setPlayerStats(prev => prev.map(p => p.player_id === playerId ? { ...p, ...patch } : p));
  };

  const updateTeamResult = (teamId: string, patch: Partial<TeamResultDraft>) => {
    setTeamResults(prev => ({ ...prev, [teamId]: { ...prev[teamId], ...patch } }));
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

  const handleSave = async (): Promise<boolean> => {
    if (!match) return false;
    setSaving(true);
    try {
      // Puliamo i dati vuoti forzandoli a 0 prima di inviarli al DB
      const cleanPlayerStats = playerStats.filter(p => !p.unavailable).map(p => ({
        player_id: p.player_id,
        status: p.status,
        td: Number(p.td) || 0,
        cas: Number(p.cas) || 0,
        int: Number(p.int) || 0,
        comp: Number(p.comp) || 0,
        ttm: Number(p.ttm) || 0,
        landing: Number(p.landing) || 0,
        mvp: Number(p.mvp) || 0,
        injury: p.injury ? { result: p.injury, stat: p.injury === 'LI' ? p.injuryStat || null : null, hatred: p.hatred.trim() || null } : null,
      }));

      const res = await fetch(`/api/schedule/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome,
          conceded_team_id: concededTeam || null,
          penalty_winner_id: penaltyWinner || null,
          home_score: Number(homeScore) || 0,
          away_score: Number(awayScore) || 0,
          home_casualties: Number(homeCas) || 0,
          away_casualties: Number(awayCas) || 0,
          match_date: matchDate, // SALVA LA DATA MODIFICATA
          teams: Object.fromEntries(Object.entries(teamResults).map(([teamId, r]) => [teamId, {
            stalling: r.stalling,
            df_roll: r.df_roll ? Number(r.df_roll) : null,
            commitments_roll: r.commitments_roll ? Number(r.commitments_roll) : null,
            quit_rolls: Object.fromEntries(Object.entries(r.quit_rolls).filter(([, v]) => v).map(([k, v]) => [k, Number(v)])),
          }])),
          playerStats: cleanPlayerStats
        })
      });

      if (res.ok) {
        router.refresh();
        setReportOpen(false);
        setCorrecting(false);
        load();
        return true;
      }
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Failed to save match results');
      return false;
    } catch {
      alert('Error saving match');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const undoMistakes = async (teamId: string) => {
    const res = await fetch(`/api/schedule/${id}/mistakes?team=${teamId}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) alert(data.error || 'Error');
    load();
  };

  // Le partite delle stagioni concluse restano consultabili ma non modificabili
  const canEdit = isAdmin && match?.season_status === 'active';

  if (loading || !match) return <div className="loading-state">Loading Graphics...</div>;

  const friendly = match.match_type === MATCH_TYPES.friendly;
  const legacy = isTrue(match.is_played) && !isTrue(match.rules_applied) && !friendly;
  const rulesMode = !friendly && !legacy;
  const knockout = !friendly && !isLeagueMatch(match.match_type);
  const played = outcome === 'played' || outcome === 'conceded' || outcome === 'conceded_no_penalty';
  const needsConceder = outcome !== 'played' && outcome !== 'forfeit_both';
  const mistakesDone = match.reports.some(r => r.mistake_result);
  const teamName = (teamId: string) => (teamId === match.home_team_id ? match.home_name : match.away_name);

  // Per l'admin le partite di lega si fanno con il percorso guidato:
  // Pre-partita -> In campo -> Referto -> Post-partita
  const wizardMode = !!canEdit && rulesMode;
  const phase = !wizardMode ? null
      : !isTrue(match.pregame_done) || (redoPregame && !isTrue(match.is_played)) ? 'pre'
      : !isTrue(match.rules_applied) ? (reportOpen ? 'report' : 'field')
      : correcting ? 'report' : 'post';
  const PHASES = [
    { key: 'pre', it: 'Pre-partita', en: 'Pre-game' },
    { key: 'field', it: 'In campo', en: 'On the pitch' },
    { key: 'report', it: 'Referto', en: 'Match report' },
    { key: 'post', it: 'Post-partita', en: 'Post-game' },
  ];
  const phaseIndex = PHASES.findIndex(ph => ph.key === phase);
  // Le statistiche in sola lettura si vedono a referto salvato (non mentre lo si sta correggendo)
  const showPlayedStats = isTrue(match.is_played) && phase !== 'report';
  const toFlow = () => requestAnimationFrame(() => document.getElementById('match-flow')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));

  // Anteprima del risultato registrato (il server applica le stesse regole, pp. 101-102)
  const projected = (() => {
    let h = Number(homeScore) || 0;
    let a = Number(awayScore) || 0;
    if (!played) { h = 0; a = 0; }
    if (needsConceder && concededTeam) {
      if (concededTeam === match.home_team_id) { a = concededScore(a); h = 0; } else { h = concededScore(h); a = 0; }
    }
    const result = (teamId: string): 'win' | 'draw' | 'loss' => {
      if (outcome === 'forfeit_both') return 'loss';
      const mine = teamId === match.home_team_id ? h : a;
      const theirs = teamId === match.home_team_id ? a : h;
      if (mine !== theirs) return mine > theirs ? 'win' : 'loss';
      if (knockout && penaltyWinner) return penaltyWinner === teamId ? 'win' : 'loss';
      return 'draw';
    };
    return { h, a, result };
  })();
  const fanAttendance = match.reports.reduce((sum, r) => sum + (r.fan_factor ?? 0), 0);
  const winningsPreview = (teamId: string) => {
    const score = teamId === match.home_team_id ? projected.h : projected.a;
    const r = teamResults[teamId];
    if (outcome === 'played' || outcome === 'conceded_no_penalty') return winnings(fanAttendance, score, !!r?.stalling);
    if (outcome === 'conceded') return concededTeam === teamId ? 0 : (fanAttendance + score) * 10000;
    if (outcome === 'forfeit_commitments' && concededTeam !== teamId) return (Number(r?.commitments_roll) || 0) * 10000;
    return 0;
  };

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
                      {legacy && <th title="Status" className={styles.colStatus}>STATUS</th>}
                      {rulesMode && played && <th className={styles.colInjury}>{t.rules.injury}</th>}
                    </tr>
                    </thead>
                    <tbody>
                    {roster.map((stat) => {
                      const locked = !!stat.unavailable || stat.status === 'Dead' && legacy;
                      const onlyMvp = rulesMode && !played;
                      return (
                        <tr key={stat.player_id} className={stat.injury === 'DEAD' || (legacy && stat.status === 'Dead') ? styles.rowDead : stat.unavailable ? styles.rowUnavailable : undefined}>

                          {/* ICONA MAGLIETTA CON NUMERO */}
                          <td className="num">
                            <div className={styles.jersey}>
                              <svg viewBox="0 0 64 64" className={styles.jerseyIcon} aria-hidden="true">
                                <path d="M16 8 L48 8 L60 24 L50 32 L46 28 L46 60 L18 60 L18 28 L14 32 L4 24 Z" style={{ fill: teamColor ?? undefined }} />
                              </svg>
                              <span className={styles.jerseyNumber}>{stat.jersey_number || '-'}</span>
                            </div>
                          </td>

                          <td className={styles.playerName}>
                            {stat.name}
                            {stat.unavailable && (
                                <span className={`tag tag-navy ${styles.unavailableTag}`}>
                                  {stat.unavailable === 'mng' ? t.rules.unavailableMng : t.rules.unavailableRetired}
                                </span>
                            )}
                          </td>

                          {STAT_COLUMNS.map(col => (
                              <td key={col.field} className={`num ${styles.statCell}`}>
                                <input
                                    type="number"
                                    min="0"
                                    max={col.field === 'mvp' ? '2' : undefined}
                                    value={zeroAsEmpty(stat[col.field])}
                                    placeholder="0"
                                    aria-label={`${stat.name} ${col.label}`}
                                    onChange={e => handleStatChange(stat.player_id, col.field, toNumericInput(e.target.value))}
                                    className={styles.statsInput}
                                    disabled={locked || (onlyMvp && col.field !== 'mvp')}
                                />
                              </td>
                          ))}

                          {legacy && (
                              <td>
                                <select
                                    value={stat.status}
                                    onChange={e => updatePlayer(stat.player_id, { status: e.target.value })}
                                    className={`${styles.statusSelect} ${statusClass(stat.status)}`}
                                    aria-label={`${stat.name} status`}
                                >
                                  <option value="Active">ACTIVE</option>
                                  <option value="Injured">MNG (INJ)</option>
                                  <option value="Dead">DEAD (RIP)</option>
                                </select>
                              </td>
                          )}

                          {rulesMode && played && (
                              <td className={styles.injuryCell}>
                                <select
                                    value={stat.injury}
                                    disabled={!!stat.unavailable}
                                    onChange={e => updatePlayer(stat.player_id, { injury: e.target.value as CasualtyResult | '', injuryStat: '', hatred: '' })}
                                    className={`${styles.statusSelect} ${stat.injury === 'DEAD' ? styles.statusDead : stat.injury ? styles.statusInjured : ''}`}
                                    aria-label={`${stat.name} ${t.rules.injury}`}
                                >
                                  <option value="">{t.rules.injuryNone}</option>
                                  {CASUALTY_RESULTS.map(c => <option key={c.key} value={c.key}>{c.name} ({c.d16})</option>)}
                                </select>
                                {stat.injury === 'LI' && (
                                    <span className={styles.injuryExtra}>
                                      <select value={stat.injuryStat} onChange={e => updatePlayer(stat.player_id, { injuryStat: e.target.value as InjuryStat })}
                                              className={styles.smallSelect} aria-label={`${stat.name} ${t.rules.lastingStat}`}>
                                        <option value="">{t.rules.lastingStat}</option>
                                        {LASTING_INJURIES.map(l => <option key={l.stat} value={l.stat}>{l.d6.join('-')}: {l.name} (-1 {l.stat.toUpperCase()})</option>)}
                                      </select>
                                      <button type="button" className={styles.iconBtnSmall} title={`${t.rules.roll} D6`} aria-label={`${t.rules.roll} D6`}
                                              onClick={() => updatePlayer(stat.player_id, { injuryStat: LASTING_INJURIES.find(l => l.d6.includes(rollDie(6)))!.stat })}>
                                        <Dices size={16} />
                                      </button>
                                    </span>
                                )}
                                {casualtyInfo(stat.injury)?.missNextGame && (
                                    <input type="text" value={stat.hatred} placeholder={t.rules.hatredKeyword} aria-label={`${stat.name} ${t.rules.hatredKeyword}`}
                                           title="Getting Even (p. 68): 4+ on a D6" onChange={e => updatePlayer(stat.player_id, { hatred: e.target.value })}
                                           className={styles.smallInput} />
                                )}
                              </td>
                          )}
                        </tr>
                      );
                    })}
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
        <div className={`team-crest ${styles.logoRing}`}>
          {logo ? (
              <img src={logo} alt={side === 'home' ? 'Home Logo' : 'Away Logo'} />
          ) : (
              <ShieldAlert size={56} />
          )}
        </div>
        <div className={styles.teamName}>{name}</div>

        <div className={styles.scoreItem}>
          <label htmlFor={`${side}-td`} className={styles.scoreLabel}>TD</label>
          <input id={`${side}-td`} type="number" min="0" readOnly={wizardMode} value={zeroAsEmpty(score)} placeholder="0" onChange={e => setScore(toNumericInput(e.target.value))} className={styles.scoreInput} />
        </div>
        <div className={styles.casItem}>
          <label htmlFor={`${side}-cas`} className={styles.scoreLabel}>CAS</label>
          <input id={`${side}-cas`} type="number" min="0" readOnly={wizardMode} value={zeroAsEmpty(cas)} placeholder="0" onChange={e => setCas(toNumericInput(e.target.value))} className={styles.casInput} />
        </div>
      </div>
  );

  const renderResultTeam = (teamId: string) => {
    const r = teamResults[teamId] ?? { stalling: false, df_roll: '', commitments_roll: '', quit_rolls: {} };
    const result = projected.result(teamId);
    const isConceder = needsConceder && concededTeam === teamId;
    const dfDie = outcome === 'conceded' && isConceder ? 3 : result === 'draw' ? 0 : 6;
    const veterans = outcome === 'conceded' && isConceder
        ? playerStats.filter(p => p.team_id === teamId && p.advancements >= CONCEDE_QUIT_MIN_ADVANCEMENTS && p.status !== 'Dead')
        : [];
    const report = match.reports.find(rep => rep.team_id === teamId);
    return (
        <div key={teamId} className={styles.rulesTeam}>
          <strong className={styles.rulesTeamName}>{teamName(teamId)} · {result.toUpperCase()}</strong>
          {(outcome === 'played' || outcome === 'conceded_no_penalty') && (
              <label className={styles.inlineCheck}>
                <input type="checkbox" checked={r.stalling} onChange={e => updateTeamResult(teamId, { stalling: e.target.checked })} /> {t.rules.stalling}
              </label>
          )}
          {dfDie > 0 && (
              <div className={styles.diceRow}>
                <label>{dfDie === 3 ? t.rules.dfRollConceder : `${t.rules.dfRoll} (D6)`}
                  <input type="number" min="1" max={dfDie} value={r.df_roll} onChange={e => updateTeamResult(teamId, { df_roll: e.target.value })} className={styles.diceInput} />
                </label>
                <button type="button" className={styles.iconBtnSmall} onClick={() => updateTeamResult(teamId, { df_roll: String(rollDie(dfDie)) })} aria-label={t.rules.roll} title={t.rules.roll}><Dices size={18} /></button>
                <span>{t.rules.dedicatedFans}: {match.teams.find(tm => tm.id === teamId)?.dedicated_fans}</span>
              </div>
          )}
          {outcome === 'forfeit_commitments' && concededTeam && !isConceder && (
              <div className={styles.diceRow}>
                <label>{t.rules.commitmentsRoll}
                  <input type="number" min="1" max="6" value={r.commitments_roll} onChange={e => updateTeamResult(teamId, { commitments_roll: e.target.value })} className={styles.diceInput} />
                </label>
                <button type="button" className={styles.iconBtnSmall} onClick={() => updateTeamResult(teamId, { commitments_roll: String(rollDie(6)) })} aria-label={t.rules.roll}><Dices size={18} /></button>
              </div>
          )}
          {veterans.length > 0 && (
              <div>
                <span>{t.rules.quitRolls}</span>
                {veterans.map(v => (
                    <div key={v.player_id} className={styles.diceRow}>
                      <label>{v.name}
                        <input type="number" min="1" max="6" value={r.quit_rolls[v.player_id] ?? ''} className={styles.diceInput}
                               onChange={e => updateTeamResult(teamId, { quit_rolls: { ...r.quit_rolls, [v.player_id]: e.target.value } })} />
                      </label>
                      <button type="button" className={styles.iconBtnSmall} aria-label={t.rules.roll}
                              onClick={() => updateTeamResult(teamId, { quit_rolls: { ...r.quit_rolls, [v.player_id]: String(rollDie(6)) } })}><Dices size={18} /></button>
                    </div>
                ))}
              </div>
          )}
          <span>{t.rules.winnings}: <strong>{winningsPreview(teamId).toLocaleString()} gp</strong>{played ? ` (Fan Attendance ${fanAttendance})` : ''}</span>
          {isTrue(match.rules_applied) && report && (
              <span className={styles.postgameLine}>
                {t.rules.postgameDone}: {t.rules.winnings} +{report.winnings.toLocaleString()} · {t.rules.dfChange} {report.df_change > 0 ? '+' : ''}{report.df_change}
                {' · '}{t.rules.mistakesTitle}: {report.mistake_result ? t.rules.mistakeResult[report.mistake_result as keyof typeof t.rules.mistakeResult] : '—'}
                {report.mistake_result && canEdit && (
                    <button type="button" className={styles.linkBtn} onClick={() => undoMistakes(teamId)}><Undo2 size={14} /> {t.rules.undo}</button>
                )}
              </span>
          )}
          {isTrue(match.rules_applied) && <Link href={`/teams/${teamId}`} className={styles.linkBtn}>{t.rules.openTeam}</Link>}
        </div>
    );
  };

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
                  {!wizardMode && (
                      <button type="button" className="btn btn-gold" onClick={handleSave} disabled={saving || (rulesMode && mistakesDone)}>
                        <Save size={20} /> {saving ? t.match.saving : t.match.saveResults}
                      </button>
                  )}
                </>
            ) : undefined}
        />

        {wizardMode && phase && (
            <section id="match-flow" className={styles.flow} aria-label={language === 'it' ? 'Svolgimento della partita' : 'Match flow'}>
              <ol className={styles.flowBar}>
                {PHASES.map((ph, i) => (
                    <li key={ph.key} className={`${styles.flowItem} ${i < phaseIndex ? styles.flowDone : i === phaseIndex ? styles.flowNow : ''}`} aria-current={i === phaseIndex ? 'step' : undefined}>
                      <span className={styles.flowNum}>{String(i + 1).padStart(2, '0')}</span> {language === 'it' ? ph.it : ph.en}
                    </li>
                ))}
              </ol>
              {phase === 'pre' && <PregameWizard match={match} onSaved={() => { setRedoPregame(false); load(); toFlow(); }} />}
              {phase === 'field' && <InPlayPanel match={match} onReport={() => { setReportOpen(true); void loadLivePrefill(!isTrue(match.is_played)); toFlow(); }} onRedoPregame={() => { setRedoPregame(true); toFlow(); }} />}
              {phase === 'report' && livePre && (
                  <LivePrefillNote match={match} prefill={livePre.prefill} applied={livePre.applied} onApply={() => applyLive(livePre.prefill)} />
              )}
              {phase === 'report' && (
                  <ReportWizard
                      match={match}
                      playerStats={playerStats}
                      onStatChange={handleStatChange}
                      updatePlayer={updatePlayer}
                      outcome={outcome}
                      setOutcome={setOutcome}
                      concededTeam={concededTeam}
                      setConcededTeam={setConcededTeam}
                      penaltyWinner={penaltyWinner}
                      setPenaltyWinner={setPenaltyWinner}
                      teamResults={teamResults}
                      updateTeamResult={updateTeamResult}
                      scores={{ home: homeScore, away: awayScore, setHome: setHomeScore, setAway: setAwayScore }}
                      projected={projected}
                      winningsPreview={winningsPreview}
                      onSave={async () => { const ok = await handleSave(); if (ok) toFlow(); return ok; }}
                      saving={saving}
                      onExit={() => { setReportOpen(false); setCorrecting(false); toFlow(); }}
                  />
              )}
              {phase === 'post' && <PostgameWizard match={match} onChanged={load} onCorrectReport={() => { setCorrecting(true); void loadLivePrefill(false); toFlow(); }} />}
            </section>
        )}

        {/* Per i non-admin tutti i campi sono in sola lettura (le tabelle di partita restano fuori: si tirano sempre) */}
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
        </fieldset>

        <div className={`bleed ${styles.tapeWrap}`}>
          <TapeStrip tone="mustard" angle={-1.5} moving={false} text={`${match.home_name} ✦ VS ✦ ${match.away_name}`} />
        </div>

        {/* TABELLE DEI GIOCATORI */}
        <section className={`bleed ${styles.reports}`}>
          <span className={`ghost-text on-light ${styles.ghostReport}`} aria-hidden="true">Report</span>
          <div className={`${styles.inner} ${styles.teamReports}`}>
            {/* Referto giocato: chi ha fatto cosa in questa partita, per tutti */}
            {showPlayedStats && <MatchPlayerStats match={match} playerStats={playerStats} />}

            {/* Tabelle di partita (meteo, kick-off, infortuni...): chiuse di default per non allungare il referto */}
            <details className={styles.tablesBox}>
              <summary className={styles.tablesSummary}>
                <Dices size={20} /> {t.tables.sectionTitle}
                <span className={styles.tablesMicro}>{t.tables.sectionMicro}</span>
              </summary>
              <div className={styles.tablesBody}>
                <MatchTables />
                <Link href="/tables" className={styles.linkBtn}>{t.tables.openAll}</Link>
              </div>
            </details>

            <fieldset disabled={!canEdit} className={`${styles.fieldset} ${styles.teamReports}`}>
              {friendly && <p className={styles.rulesNote}>{t.rules.friendlyNote}</p>}
              {legacy && <p className={styles.rulesNote}>{t.rules.legacyNote}</p>}

              {rulesMode && !wizardMode && <PregamePanel match={match} />}

              {rulesMode && !wizardMode && (
                  <section className={`card ${styles.rulesCard}`}>
                    <h3 className="subhead">{t.rules.resultTitle}</h3>
                    <div className={styles.outcomeRow}>
                      <label className={styles.fieldLine}>{t.rules.outcome}
                        <select value={outcome} onChange={e => setOutcome(e.target.value as MatchOutcome)} className={styles.smallSelect}>
                          {MATCH_OUTCOMES.map(o => <option key={o} value={o}>{t.rules.outcomes[o]}</option>)}
                        </select>
                      </label>
                      {needsConceder && (
                          <label className={styles.fieldLine}>{t.rules.concededBy}
                            <select value={concededTeam} onChange={e => setConcededTeam(e.target.value)} className={styles.smallSelect}>
                              <option value="">—</option>
                              <option value={match.home_team_id}>{match.home_name}</option>
                              <option value={match.away_team_id}>{match.away_name}</option>
                            </select>
                          </label>
                      )}
                      {knockout && played && projected.h === projected.a && (
                          <label className={styles.fieldLine} title={t.rules.penaltyHint}>{t.rules.penaltyWinner}
                            <select value={penaltyWinner} onChange={e => setPenaltyWinner(e.target.value)} className={styles.smallSelect}>
                              <option value="">—</option>
                              <option value={match.home_team_id}>{match.home_name}</option>
                              <option value={match.away_team_id}>{match.away_name}</option>
                            </select>
                          </label>
                      )}
                      <span className={styles.projectedScore}>{match.home_name} {projected.h} – {projected.a} {match.away_name}</span>
                    </div>
                    <div className={styles.rulesGrid}>
                      {renderResultTeam(match.home_team_id)}
                      {renderResultTeam(match.away_team_id)}
                    </div>
                  </section>
              )}

              {!wizardMode && !(showPlayedStats && !canEdit) && renderTeamStats('01', 'home', match.home_name, match.home_team_id, match.home_color)}
              {!wizardMode && !(showPlayedStats && !canEdit) && renderTeamStats('02', 'away', match.away_name, match.away_team_id, match.away_color)}
            </fieldset>
          </div>
        </section>
      </div>
  );
}
