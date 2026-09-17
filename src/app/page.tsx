'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Calendar, Trophy, ShieldAlert, Star } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { useSeason } from '@/lib/SeasonContext';
import { ART } from '@/lib/art';
import { useArt } from '@/lib/useArt';
import Emblem from '@/components/brand/Emblem';
import styles from './Home.module.css';

type Standing = {
    id: string;
    name: string;
    logo_url: string | null;
    primary_color: string | null;
    points: number;
};

type Scorer = { id: string; name: string; team_name: string; primary_color: string | null; total_td: number };

type Result = {
    id: string;
    home_name: string;
    away_name: string;
    home_score: number;
    away_score: number;
    home_color: string | null;
    away_color: string | null;
    is_played: number;
};

function TeamBadge({ logo, color, name, size = 56 }: { logo: string | null; color: string | null; name: string; size?: number }) {
    return (
        <span className={styles.teamBadge} style={{ ['--team' as string]: color || 'var(--bb-slate-500)', width: size, height: size }}>
            {logo ? (
                 
                <img src={logo} alt={name} />
            ) : (
                <ShieldAlert size={size * 0.5} />
            )}
        </span>
    );
}

export default function Home() {
    const { t } = useLanguage();
    const { isAdmin } = useAuth();
    const { seasonQuery, seasonsLoading, selectedSeason, isViewingActive } = useSeason();
    const [stats, setStats] = useState({ teams: 0, matches: 0, casualties: 0 });
    const [standings, setStandings] = useState<Standing[]>([]);
    const [scorers, setScorers] = useState<Scorer[]>([]);
    const [results, setResults] = useState<Result[]>([]);

    const hasStadium = useArt(ART.stadium);
    const hasHeroPlayer = useArt(ART.heroPlayer);
    const hasTrophy = useArt(ART.trophy);
    const hasStarArt = useArt(ART.starPlayer);

    // Riepilogo, classifica e risultati della stagione consultata
    useEffect(() => {
        if (seasonsLoading) return;
        let cancelled = false;
        fetch(`/api/stats${seasonQuery}`)
            .then(res => res.json())
            .then(data => {
                if (cancelled) return;
                setStats({
                    teams: data.totals?.teams || 0,
                    matches: data.totals?.matches_played || 0,
                    casualties: data.totals?.casualties || 0,
                });
                setStandings(data.standings || []);
                setScorers(data.playerStats?.scorers || []);
            })
            .catch(console.error);
        fetch(`/api/schedule${seasonQuery}`)
            .then(res => res.json())
            .then((data: Result[]) => {
                if (cancelled || !Array.isArray(data)) return;
                setResults(data.filter(m => m.is_played).slice(-10).reverse());
            })
            .catch(console.error);
        return () => { cancelled = true; };
    }, [seasonQuery, seasonsLoading]);

    const headlines = [
        { value: stats.teams, label: t.home.registeredTeams },
        { value: stats.matches, label: t.home.matchesPlayed },
        { value: stats.casualties, label: t.home.totalCasualties, blood: true },
    ];

    const podium = standings.slice(0, 3);
    // Ordine visivo del podio: 2° - 1° - 3°
    const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean);
    const star = scorers[0];

    return (
        <div className={styles.dashboard}>
            {/* COPERTINA A TUTTA LARGHEZZA */}
            <section
                className={`${styles.hero} ${hasStadium ? styles.heroPhoto : ''}`}
                style={hasStadium ? { ['--stadium' as string]: `url(${ART.stadium})` } : undefined}
            >
                <div className={styles.floodlights} aria-hidden="true">
                    <span className={styles.beamLeft} />
                    <span className={styles.beamRight} />
                </div>

                <div className={styles.heroInner}>
                    <div className={styles.heroCopy}>
                        <div className={styles.heroKicker}>
                            <span className="tag">{selectedSeason?.name ?? 'New Season'}</span>
                            <span className={styles.heroKickerLine}>The Game of Fantasy Football</span>
                        </div>

                        <div className={styles.banner}>
                            <h1 className={styles.heroTitle}>{t.home.title}</h1>
                        </div>

                        <p className={styles.heroSubtitle}>{t.home.subtitle}</p>

                        <div className={styles.heroActions}>
                            <Link href="/teams" className="btn btn-gold">
                                <Users size={20} /> {t.home.manageTeamsBtn}
                            </Link>
                            <Link href="/standings" className="btn btn-slate">
                                <Trophy size={20} /> {t.nav.standings}
                            </Link>
                        </div>
                    </div>

                    <div className={styles.heroVisual} aria-hidden="true">
                        {hasHeroPlayer ? (
                             
                            <img src={ART.heroPlayer} alt="" className={styles.heroPlayer} />
                        ) : (
                            <div className={styles.emblemStage}>
                                <span className={styles.emblemGlow} />
                                <Emblem size={340} className={styles.heroEmblem} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Tabellone con i numeri della stagione */}
                <ul className={styles.scoreboard}>
                    {headlines.map(item => (
                        <li key={item.label} className={`plate ${styles.scorePlate}`}>
                            <span className={`${styles.scoreValue} ${item.blood ? styles.scoreBlood : ''}`}>{item.value}</span>
                            <span className={styles.scoreLabel}>{item.label.replace(/:\s*$/, '')}</span>
                        </li>
                    ))}
                </ul>
            </section>

            {/* TICKER DEGLI ULTIMI RISULTATI */}
            <section className={styles.ticker} aria-label={t.home.latestResults}>
                <span className={styles.tickerLabel}>{t.home.latestResults}</span>
                <div className={styles.tickerViewport}>
                    {results.length === 0 ? (
                        <span className={styles.tickerEmpty}>{t.home.noResults}</span>
                    ) : (
                        <div className={styles.tickerTrack}>
                            {[0, 1].map(copy => (
                                <ul key={copy} className={styles.tickerList} aria-hidden={copy === 1}>
                                    {results.map(match => (
                                        <li key={`${copy}-${match.id}`}>
                                            <Link href={`/schedule/${match.id}`} className={styles.tickerItem} tabIndex={copy === 1 ? -1 : undefined}>
                                                <span className={styles.tickerDot} style={{ background: match.home_color || 'var(--bb-slate-500)' }} />
                                                <span>{match.home_name}</span>
                                                <strong className={styles.tickerScore}>{match.home_score}–{match.away_score}</strong>
                                                <span>{match.away_name}</span>
                                                <span className={styles.tickerDot} style={{ background: match.away_color || 'var(--bb-slate-500)' }} />
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* PODIO */}
            <section className={`panel-blood ${styles.podiumPanel}`}>
                <div className={styles.sectionHead}>
                    <h2 className="title-spike">{t.home.topOfTable}</h2>
                    <Link href="/standings" className={styles.sectionLink}>{t.nav.standings} →</Link>
                </div>

                {podium.length === 0 ? (
                    <p className={styles.emptyNote}>{t.home.noResults}</p>
                ) : (
                    <ol className={styles.podium}>
                        {podiumOrder.map(team => {
                            const place = standings.indexOf(team) + 1;
                            return (
                                <li key={team.id} className={`${styles.podiumStep} ${styles[`place${place}`]}`}>
                                    <Link href={`/teams/${team.id}`} className={styles.podiumTeam}>
                                        {place === 1 && hasTrophy && (
                                             
                                            <img src={ART.trophy} alt="" className={styles.trophyArt} />
                                        )}
                                        <TeamBadge logo={team.logo_url} color={team.primary_color} name={team.name} size={place === 1 ? 88 : 68} />
                                        <span className={styles.podiumName}>{team.name}</span>
                                        <span className={styles.podiumPts}>{team.points} {t.home.points}</span>
                                    </Link>
                                    <span className={styles.podiumBlock}>
                                        <span className={styles.podiumPlace}>{place}</span>
                                    </span>
                                </li>
                            );
                        })}
                    </ol>
                )}
            </section>

            {/* STAR PLAYER */}
            <section className={`panel-slate ${styles.starPanel}`}>
                <div className={styles.sectionHead}>
                    <h2 className="title-spike">{t.home.starPlayer}</h2>
                    <Star size={30} className={styles.starIcon} aria-hidden="true" />
                </div>

                {star ? (
                    <div className={styles.starBody}>
                        {hasStarArt && (
                             
                            <img src={ART.starPlayer} alt="" className={styles.starArt} />
                        )}
                        <div className={styles.starInfo}>
                            <span className={styles.starTeam} style={{ ['--team' as string]: star.primary_color || 'var(--bb-mustard)' }}>
                                {star.team_name}
                            </span>
                            <span className={styles.starName}>{star.name}</span>
                            <span className={`plate ${styles.starStat}`}>
                                <strong>{star.total_td}</strong>
                                <span>{t.home.touchdowns}</span>
                            </span>
                        </div>
                        {scorers.length > 1 && (
                            <ol className={styles.chasers} start={2}>
                                {scorers.slice(1, 4).map(p => (
                                    <li key={p.id}>
                                        <span className={styles.chaserName}>{p.name}</span>
                                        <span className={styles.chaserTd}>{p.total_td}</span>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                ) : (
                    <p className={styles.emptyNote}>{t.home.noResults}</p>
                )}
            </section>

            {/* AZIONI RAPIDE */}
            <section className={`card ${styles.actionsCard}`}>
                <h2 className="title-slab">{t.home.quickActions}</h2>
                <div className={styles.actionGrid}>
                    {isAdmin && isViewingActive && (
                        <Link href="/teams/new" className="btn btn-primary">
                            <Users size={20} /> {t.home.draftNewTeam}
                        </Link>
                    )}
                    <Link href="/schedule" className="btn btn-navy">
                        <Calendar size={20} /> {t.home.generateSchedule}
                    </Link>
                </div>
                <div className={`chain-rule ${styles.chain}`} aria-hidden="true" />
            </section>
        </div>
    );
}
