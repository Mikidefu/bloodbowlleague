'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Trophy, ShieldAlert } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import PageHeader from '@/components/brand/PageHeader';
import SectionTitle from '@/components/brand/SectionTitle';
import TapeStrip from '@/components/brand/TapeStrip';
import Emblem from '@/components/brand/Emblem';
import { useSeason } from '@/lib/SeasonContext';
import { ART } from '@/lib/art';
import { useArt } from '@/lib/useArt';
import styles from './Standings.module.css';
import type { TeamStanding } from '@/lib/standings';

const diffClass = (value: number) =>
    value > 0 ? styles.diffPositive : value < 0 ? styles.diffNegative : '';

const pad = (n: number) => String(n).padStart(2, '0');

const PLAYOFF_SPOTS = 4;

export default function StandingsPage() {
    const { t } = useLanguage();
    const { seasonQuery, seasonsLoading, selectedSeason } = useSeason();
    const [standings, setStandings] = useState<TeamStanding[]>([]);
    const [loading, setLoading] = useState(true);
    const hasTrophy = useArt(ART.trophy);

    // Classifica della stagione consultata
    useEffect(() => {
        if (seasonsLoading) return;
        let cancelled = false;
        fetch(`/api/stats${seasonQuery}`)
            .then(res => res.json())
            .then(data => {
                if (cancelled) return;
                setStandings(data.standings || []);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [seasonQuery, seasonsLoading]);

    if (loading) return <div className="loading-state">Computing league standings...</div>;

    const seasonName = selectedSeason?.name ?? 'Season';
    const seasonCode = `S${pad(selectedSeason?.number ?? 1)}`;
    const podium = standings.slice(0, 3);
    // Ordine da podio: 2° a sinistra, 1° al centro, 3° a destra
    const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean);

    return (
        <div className={styles.page}>
            <PageHeader title={t.standings.title} kicker={selectedSeason?.name} icon={<Trophy size={44} />} />

            {standings.length === 0 ? (
                <div className={`card ${styles.emptyCard}`}>
                    <p className={styles.emptyText}>{t.standings.noStandings}</p>
                </div>
            ) : (
                <>
                    {/* ============ 01 · PODIO (fascia pergamena) ============ */}
                    <section className={`bleed ${styles.podiumBand}`}>
                        <div className={styles.podiumBg} aria-hidden="true">
                            <span className={`ghost-text on-light ${styles.ghostPodium}`}>Podium</span>
                        </div>

                        <div className={styles.inner}>
                            <SectionTitle
                                index="01"
                                on="light"
                                micro={`${seasonCode} // ${seasonName} // Top 3`}
                                title={t.home.topOfTable}
                            />

                            <ol className={styles.podium}>
                                {podiumOrder.map(team => {
                                    const place = standings.indexOf(team) + 1;
                                    const isLeader = place === 1;
                                    return (
                                        <li
                                            key={team.id}
                                            className={`${styles.podiumSlot} ${styles[`slot${place}`]}`}
                                            style={{ ['--team' as string]: team.primary_color || 'var(--bb-slate-500)' }}
                                        >
                                            {isLeader && (
                                                <div className={styles.trophyWrap} aria-hidden="true">
                                                    {hasTrophy ? (
                                                        <img src={ART.trophy} alt="" className={styles.trophyArt} />
                                                    ) : (
                                                        <Emblem size={150} className={styles.trophyFallback} useCrestArt={false} />
                                                    )}
                                                </div>
                                            )}
                                            <div className={styles.podiumFrame}>
                                                <Link href={`/teams/${team.id}`} className={`chamfer ${styles.podiumCard}`}>
                                                    <span className={styles.podiumNumeral} aria-hidden="true">{place}</span>
                                                    <span className={styles.podiumMicro}>
                                                        {`P${pad(place)} // ${team.wins}W ${team.draws}D ${team.losses}L`}
                                                    </span>
                                                    <span className={styles.podiumBadge}>
                                                        {team.logo_url ? (
                                                            <img src={team.logo_url} alt={team.name} />
                                                        ) : (
                                                            <ShieldAlert size={isLeader ? 44 : 32} />
                                                        )}
                                                    </span>
                                                    <span className={styles.podiumName}>{team.name}</span>
                                                    {team.coach_name && (
                                                        <span className={styles.podiumCoach}>{team.coach_name}</span>
                                                    )}
                                                    <span className={styles.podiumPts}>
                                                        <strong>{team.points ?? 0}</strong>
                                                        <span>{t.standings.pts}</span>
                                                    </span>
                                                </Link>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                        </div>
                    </section>

                    {/* ============ NASTRO ============ */}
                    <div className={`bleed ${styles.tapes}`} aria-hidden="true">
                        <TapeStrip
                            tone="ink"
                            angle={-1.5}
                            text={`${seasonName} ✦ Final Four ✦ Top ${PLAYOFF_SPOTS}`}
                            className={styles.tape}
                        />
                    </div>

                    {/* ============ 02 · CLASSIFICA COMPLETA ============ */}
                    <section className={`bleed ${styles.tableBand}`}>
                        <div className={styles.tableBg} aria-hidden="true">
                            <span className={`ghost-text ${styles.ghostTable}`}>Standings</span>
                        </div>

                        <div className={styles.inner}>
                            <SectionTitle
                                index="02"
                                micro={`${seasonCode} // P · W · D · L // TD // CAS`}
                                title={t.standings.title}
                            />

                            <div className={`offset-frame ${styles.tableFrame}`}>
                                <div className={`chamfer table-container ${styles.tableContainer}`}>
                                    <div className="stars-bar" aria-hidden="true" />
                                    <table className={`data-table ${styles.table}`}>
                                        <thead>
                                        <tr>
                                            <th className={`num ${styles.posCol}`}>{t.standings.pos}</th>
                                            <th className={styles.teamCol}>{t.standings.team}</th>
                                            <th className="num" title="Played">P</th>
                                            <th className="num" title="Wins">W</th>
                                            <th className="num" title="Draws">D</th>
                                            <th className="num" title="Losses">L</th>
                                            <th className={`num ${styles.groupStart}`} title="Touchdowns For">TD+</th>
                                            <th className="num" title="Touchdowns Against">TD-</th>
                                            <th className="num" title="Touchdown Difference">TDD</th>
                                            <th className={`num ${styles.groupStart}`} title="Casualties Inflicted">CAS+</th>
                                            <th className="num" title="Casualties Suffered">CAS-</th>
                                            <th className="num" title="Casualty Difference">CASD</th>
                                            <th className={`num ${styles.ptsHead}`}>{t.standings.pts}</th>
                                        </tr>
                                        </thead>
                                        <tbody>
                                        {standings.map((team, index) => {
                                            const isPlayoffZone = index < PLAYOFF_SPOTS;
                                            const isCutLine = index === PLAYOFF_SPOTS - 1 && standings.length > PLAYOFF_SPOTS;
                                            const rowClass = [
                                                isPlayoffZone ? styles.playoffRow : '',
                                                isCutLine ? styles.cutRow : '',
                                            ].filter(Boolean).join(' ');

                                            return (
                                                <tr key={team.id} className={rowClass || undefined}>
                                                    {/* POSIZIONE */}
                                                    <td className={`num ${styles.posCell}`}>
                                                        <span
                                                            className={`${styles.posBadge} ${isPlayoffZone ? (index === 0 ? styles.posLeader : styles.posPlayoff) : ''}`}
                                                        >
                                                            {index + 1}
                                                        </span>
                                                    </td>

                                                    {/* SQUADRA (Logo + Nome) */}
                                                    <td className={styles.teamCell}>
                                                        <Link href={`/teams/${team.id}`} className={styles.teamLink}>
                                                            <span
                                                                className={styles.logoRing}
                                                                style={{ borderColor: team.primary_color || undefined }}
                                                            >
                                                                {team.logo_url ? (
                                                                    <img src={team.logo_url} alt={team.name} className={styles.teamLogo} />
                                                                ) : (
                                                                    <ShieldAlert size={20} color={team.primary_color || 'currentColor'} />
                                                                )}
                                                            </span>
                                                            <span className={styles.teamText}>
                                                                <span className={styles.teamName}>{team.name}</span>
                                                                {team.coach_name && (
                                                                    <span className={styles.coachName}>{team.coach_name}</span>
                                                                )}
                                                            </span>
                                                        </Link>
                                                    </td>

                                                    {/* STATISTICHE (Partite) */}
                                                    <td className="num">{team.played ?? 0}</td>
                                                    <td className="num">{team.wins}</td>
                                                    <td className="num">{team.draws}</td>
                                                    <td className="num">{team.losses}</td>

                                                    {/* STATISTICHE (Touchdown) */}
                                                    <td className={`num ${styles.groupStart}`}>{team.td_for ?? 0}</td>
                                                    <td className="num">{team.td_against ?? 0}</td>
                                                    <td className={`num ${styles.diffCell} ${diffClass(team.td_diff)}`}>
                                                        {team.td_diff > 0 ? `+${team.td_diff}` : (team.td_diff ?? 0)}
                                                    </td>

                                                    {/* STATISTICHE (Casualties) */}
                                                    <td className={`num ${styles.groupStart}`}>{team.cas_for ?? 0}</td>
                                                    <td className="num">{team.cas_against ?? 0}</td>
                                                    <td className={`num ${styles.diffCell} ${diffClass(team.cas_diff)}`}>
                                                        {team.cas_diff > 0 ? `+${team.cas_diff}` : (team.cas_diff ?? 0)}
                                                    </td>

                                                    {/* PUNTI */}
                                                    <td className={`num ${styles.ptsCell}`}>{team.points ?? 0}</td>
                                                </tr>
                                            );
                                        })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* LEGENDA PLAYOFF */}
                            <div className={styles.legend}>
                                <span className={styles.legendMarker} aria-hidden="true" />
                                <span className={styles.legendText}>{t.standings.qualifyNote}</span>
                            </div>
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}
