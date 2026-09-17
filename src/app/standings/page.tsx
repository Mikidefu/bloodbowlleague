'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Trophy, ShieldAlert } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import PageHeader from '@/components/brand/PageHeader';
import styles from './Standings.module.css';
import type { TeamStanding } from '@/lib/standings';

const diffClass = (value: number) =>
    value > 0 ? styles.diffPositive : value < 0 ? styles.diffNegative : '';

export default function StandingsPage() {
    const { t } = useLanguage();
    const [standings, setStandings] = useState<TeamStanding[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/stats')
            .then(res => res.json())
            .then(data => {
                setStandings(data.standings || []);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    if (loading) return <div className="loading-state">Computing league standings...</div>;

    return (
        <div className={styles.page}>
            <PageHeader title={t.standings.title} icon={<Trophy size={44} />} />

            {standings.length === 0 ? (
                <div className={`card ${styles.emptyCard}`}>
                    <p className={styles.emptyText}>{t.standings.noStandings}</p>
                </div>
            ) : (
                <>
                    <div className={`table-container ${styles.tableContainer}`}>
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
                                const isPlayoffZone = index < 4;

                                return (
                                    <tr
                                        key={team.id}
                                        className={isPlayoffZone ? styles.playoffRow : undefined}
                                    >
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
                                                <span className={styles.teamName}>{team.name}</span>
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

                    {/* LEGENDA PLAYOFF */}
                    <div className={styles.legend}>
                        <span className={styles.legendMarker} aria-hidden="true" />
                        <span className={styles.legendText}>{t.standings.qualifyNote}</span>
                    </div>
                </>
            )}
        </div>
    );
}
