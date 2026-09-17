'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Calendar, Trophy, ShieldAlert, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { useSeason } from '@/lib/SeasonContext';
import { ART } from '@/lib/art';
import { useArt } from '@/lib/useArt';
import Emblem from '@/components/brand/Emblem';
import Shards from '@/components/brand/Shards';
import TapeStrip from '@/components/brand/TapeStrip';
import SectionTitle from '@/components/brand/SectionTitle';
import Hotspot from '@/components/brand/Hotspot';
import styles from './Home.module.css';

type Standing = {
    id: string;
    name: string;
    logo_url: string | null;
    primary_color: string | null;
    points: number;
    played?: number;
};

type Scorer = { id: string; name: string; team_name: string; primary_color: string | null; total_td: number };

type Result = {
    id: string;
    round: number;
    match_type?: string;
    match_date?: string | null;
    home_name: string;
    away_name: string;
    home_logo: string | null;
    away_logo: string | null;
    home_score: number;
    away_score: number;
    home_color: string | null;
    away_color: string | null;
    is_played: number;
};

function TeamBadge({ logo, color, name, size = 56 }: { logo: string | null; color: string | null; name: string; size?: number }) {
    return (
        <span className={styles.teamBadge} style={{ ['--team' as string]: color || 'var(--bb-slate-500)', width: size, height: size }}>
            {logo ? <img src={logo} alt={name} /> : <ShieldAlert size={size * 0.5} />}
        </span>
    );
}

const pad = (n: number) => String(n).padStart(2, '0');

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
                setResults(data.filter(m => m.is_played).reverse());
            })
            .catch(console.error);
        return () => { cancelled = true; };
    }, [seasonQuery, seasonsLoading]);

    const clean = (label: string) => label.replace(/:\s*$/, '');
    const seasonName = selectedSeason?.name ?? 'New Season';
    const seasonCode = `S${pad(selectedSeason?.number ?? 1)}`;

    const podium = standings.slice(0, 3);
    const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean);
    const chasingPack = standings.slice(3, 8);
    const star = scorers[0];
    const latest = results.slice(0, 3);

    return (
        <div className={styles.home}>
            {/* ============ COPERTINA ============ */}
            <section className={`bleed ${styles.hero}`}>
                <div
                    className={`${styles.heroBg} ${hasStadium ? styles.heroBgPhoto : ''}`}
                    style={hasStadium ? { ['--stadium' as string]: `url(${ART.stadium})` } : undefined}
                    aria-hidden="true"
                />
                <Shards variant="hero" className={styles.heroShards} />

                <div className={styles.heroPresents}>
                    <img src={ART.trivium} alt="Trivium" className={styles.triviumLogo} />
                    <span className={styles.presentsText}>{t.home.presents}:</span>
                </div>
                <div className={styles.heroGiant} aria-hidden="true">Blood Bowl</div>

                <div className={styles.heroStage}>
                    {hasHeroPlayer ? (
                        <img src={ART.heroPlayer} alt="" className={styles.heroPlayer} />
                    ) : (
                        <Emblem size={380} className={styles.heroEmblem} />
                    )}

                    <div className={styles.hotspots}>
                        <Hotspot x={38} y={30} side="left" length={110} rise={-50}>
                            <span className={styles.hsValue}>{stats.teams}</span>
                            <span className={styles.hsLabel}>{clean(t.home.registeredTeams)}</span>
                        </Hotspot>
                        <Hotspot x={70} y={50} side="right" length={120} rise={-60}>
                            <span className={styles.hsValue}>{stats.matches}</span>
                            <span className={styles.hsLabel}>{clean(t.home.matchesPlayed)}</span>
                        </Hotspot>
                        <Hotspot x={52} y={84} side="right" length={150} rise={-24}>
                            <span className={`${styles.hsValue} ${styles.hsBlood}`}>{stats.casualties}</span>
                            <span className={styles.hsLabel}>{clean(t.home.totalCasualties)}</span>
                        </Hotspot>
                    </div>
                </div>

                <div className={styles.heroCopy}>
                    <div className={styles.heroMicro}>
                        <span className="tag">{seasonName}</span>
                        <span>{`BBL // ${seasonCode} // The Game of Fantasy Football`}</span>
                    </div>
                    <h1 className={styles.heroTitle}>{t.home.title}</h1>
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
            </section>

            {/* ============ NASTRI INCROCIATI ============ */}
            <div className={`bleed ${styles.tapes}`}>
                <TapeStrip tone="red" angle={2.5} moving reverse text={`Blood Bowl League ✦ ${seasonName}`} className={styles.tapeBack} />
                <TapeStrip
                    tone="mustard"
                    angle={-2}
                    label={t.home.latestResults}
                    className={styles.tapeFront}
                    items={
                        results.length > 0
                            ? results.slice(0, 10).map(m => (
                                <Link key={m.id} href={`/schedule/${m.id}`} className={styles.tapeResult}>
                                    {m.home_name} <b>{m.home_score}–{m.away_score}</b> {m.away_name}
                                </Link>
                            ))
                            : [t.home.latestResults, t.home.noResults]
                    }
                />
            </div>

            {/* ============ 01 · CLASSIFICA ============ */}
            <section className={`bleed ${styles.tableSection}`}>
                <span className={`ghost-text on-light ${styles.ghostTable}`} aria-hidden="true">Champions</span>
                <div className={styles.inner}>
                    <SectionTitle
                        index="01"
                        on="light"
                        micro={`${seasonCode} // ${seasonName}`}
                        title={t.home.topOfTable}
                        action={<Link href="/standings" className={styles.moreLink}>{t.nav.standings} <ArrowRight size={18} /></Link>}
                    />

                    {podium.length === 0 ? (
                        <p className={styles.emptyNote}>{t.home.noResults}</p>
                    ) : (
                        <div className={styles.tableGrid}>
                            <ol className={styles.podium}>
                                {podiumOrder.map(team => {
                                    const place = standings.indexOf(team) + 1;
                                    return (
                                        <li key={team.id} className={`${styles.podiumStep} ${styles[`place${place}`]}`}>
                                            <Link href={`/teams/${team.id}`} className={styles.podiumTeam}>
                                                {place === 1 && hasTrophy && <img src={ART.trophy} alt="" className={styles.trophyArt} />}
                                                <TeamBadge logo={team.logo_url} color={team.primary_color} name={team.name} size={place === 1 ? 92 : 70} />
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

                            {chasingPack.length > 0 && (
                                <ol className={styles.pack} start={4}>
                                    {chasingPack.map((team, i) => (
                                        <li key={team.id}>
                                            <Link href={`/teams/${team.id}`} className={`chamfer ${styles.packRow}`}>
                                                <span className={styles.packPos}>{pad(i + 4)}</span>
                                                <TeamBadge logo={team.logo_url} color={team.primary_color} name={team.name} size={40} />
                                                <span className={styles.packName}>{team.name}</span>
                                                <span className={styles.packPts}>{team.points}<small>{t.home.points}</small></span>
                                            </Link>
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </div>
                    )}
                </div>
            </section>

            {/* ============ 02 · STAR PLAYER ============ */}
            <section className={`bleed ${styles.starSection}`}>
                <Shards variant="band" className={styles.starShards} />
                <span className={`ghost-text ${styles.ghostStar}`} aria-hidden="true">MVP</span>

                <div className={`${styles.inner} ${styles.starInner}`}>
                    <div className={styles.starVisual} aria-hidden="true">
                        {hasStarArt ? <img src={ART.starPlayer} alt="" className={styles.starArt} /> : <Emblem size={300} />}
                    </div>

                    <div className={styles.starContent}>
                        <SectionTitle index="02" micro="Top scorer // Touchdowns" title={t.home.starPlayer} align="right" />

                        {star ? (
                            <>
                                <div className={styles.starCard}>
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
                                    <ol className={styles.chasers}>
                                        {scorers.slice(1, 4).map((p, i) => (
                                            <li key={p.id} className="chamfer">
                                                <span className={styles.chaserPos}>{pad(i + 2)}</span>
                                                <span className={styles.chaserName}>{p.name}</span>
                                                <span className={styles.chaserTd}>{p.total_td}</span>
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </>
                        ) : (
                            <p className={styles.emptyNote}>{t.home.noResults}</p>
                        )}
                    </div>
                </div>
            </section>

            {/* ============ 03 · ULTIME PARTITE ============ */}
            <section className={styles.resultsSection}>
                <span className={`ghost-text ${styles.ghostResults}`} aria-hidden="true">Results</span>
                <SectionTitle
                    index="03"
                    micro={`${seasonCode} // Match reports`}
                    title={t.home.latestResults}
                    action={<Link href="/schedule" className={`${styles.moreLink} ${styles.moreLinkDark}`}>{t.nav.schedule} <ArrowRight size={18} /></Link>}
                />

                {latest.length === 0 ? (
                    <p className={styles.emptyNote}>{t.home.noResults}</p>
                ) : (
                    <div className={styles.resultGrid}>
                        {latest.map(m => (
                            <div key={m.id} className="offset-frame">
                                <Link href={`/schedule/${m.id}`} className={`chamfer ${styles.resultCard}`}>
                                    <span className={styles.resultMeta}>
                                        <span className={styles.resultRound}>R{pad(m.round)}</span>
                                        <span>{m.match_type}</span>
                                    </span>
                                    <span className={styles.resultBody}>
                                        <span className={styles.resultTeam}>
                                            <TeamBadge logo={m.home_logo} color={m.home_color} name={m.home_name} size={62} />
                                            <span>{m.home_name}</span>
                                        </span>
                                        <span className={styles.resultScore}>
                                            {m.home_score}<i>–</i>{m.away_score}
                                        </span>
                                        <span className={styles.resultTeam}>
                                            <TeamBadge logo={m.away_logo} color={m.away_color} name={m.away_name} size={62} />
                                            <span>{m.away_name}</span>
                                        </span>
                                    </span>
                                    <span className={styles.resultFoot}>
                                        Match report <ArrowRight size={16} />
                                    </span>
                                </Link>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* ============ INVITO FINALE ============ */}
            <section className={`bleed ${styles.cta}`}>
                <div className={styles.ctaInner}>
                    <div className={styles.ctaLeft}>
                        <span className={styles.ctaArrow} aria-hidden="true" />
                        <h2 className={styles.ctaTitle}>{t.home.quickActions}</h2>
                    </div>
                    <div className={styles.ctaRight}>
                        {isAdmin && isViewingActive && (
                            <Link href="/teams/new" className="btn btn-primary">
                                <Users size={20} /> {t.home.draftNewTeam}
                            </Link>
                        )}
                        <Link href="/schedule" className="btn btn-gold">
                            <Calendar size={20} /> {t.home.generateSchedule}
                        </Link>
                        <span className={`${styles.ctaArrow} ${styles.ctaArrowRight}`} aria-hidden="true" />
                    </div>
                </div>
            </section>
        </div>
    );
}
