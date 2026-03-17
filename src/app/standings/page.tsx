'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Trophy, ShieldAlert } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import styles from './Standings.module.css';

export default function StandingsPage() {
    const { t } = useLanguage();
    const [standings, setStandings] = useState<any[]>([]);
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

    if (loading) return <div style={{ fontFamily: 'var(--font-typewriter)', fontSize: '1.5rem', textAlign: 'center', marginTop: '4rem', color: '#fff' }}>Computing league standings...</div>;

    return (
        <div>
            {/* HEADER PAGE */}
            <div className={styles.headerArea}>
                <h1 className={styles.pageTitle}>
                    <Trophy size={48} color="var(--color-gold)" style={{ filter: 'drop-shadow(3px 3px 0 #111)' }} />
                    {t.standings.title}
                </h1>
            </div>

            <div className={styles.leaderboardCard}>
                {standings.length === 0 ? (
                    <p style={{ textAlign: 'center', fontFamily: 'var(--font-typewriter)', color: '#aaa', padding: '3rem' }}>
                        {t.standings.noStandings}
                    </p>
                ) : (
                    <div className={styles.tableWrapper}>
                        <table className={styles.standingsTable}>
                            <thead className={styles.stickyHeader}>
                            <tr>
                                <th style={{ width: '60px' }}>{t.standings.pos}</th>
                                <th className={styles.teamCol}>{t.standings.team}</th>
                                <th title="Played">P</th>
                                <th title="Wins">W</th>
                                <th title="Draws">D</th>
                                <th title="Losses">L</th>
                                <th title="Touchdowns For">TD+</th>
                                <th title="Touchdowns Against">TD-</th>
                                <th title="Touchdown Difference">TDD</th>
                                <th title="Casualties Inflicted">CAS+</th>
                                <th title="Casualties Suffered">CAS-</th>
                                <th title="Casualty Difference">CASD</th>
                                <th style={{ color: 'var(--color-blood-bright)' }}>{t.standings.pts}</th>
                            </tr>
                            </thead>
                            <tbody>
                            {standings.map((team, index) => {
                                const isPlayoffZone = index < 4;

                                return (
                                    <tr
                                        key={team.id}
                                        className={`${styles.teamRow} ${isPlayoffZone ? styles.playoffRow : ''}`}
                                    >
                                        {/* POSIZIONE */}
                                        <td className={`${styles.posCell} ${isPlayoffZone ? styles.playoffPos : ''}`}>
                                            {index + 1}
                                        </td>

                                        {/* SQUADRA (Logo + Nome) */}
                                        <td>
                                            <Link href={`/teams/${team.id}`} className={styles.teamLink}>
                                                <div className={styles.logoWrapper} style={{ borderColor: team.primary_color || '#333' }}>
                                                    {team.logo_url ? (
                                                        <img src={team.logo_url} alt={team.name} className={styles.teamLogo} />
                                                    ) : (
                                                        <ShieldAlert size={24} color={team.primary_color || '#fff'} />
                                                    )}
                                                </div>
                                                {team.name}
                                            </Link>
                                        </td>

                                        {/* STATISTICHE (Partite) - Aggiunti Fallback Sicuri */}
                                        <td className={styles.statCell} style={{ color: '#fff' }}>{team.played ?? 0}</td>
                                        <td className={styles.statCell}>{team.wins ?? team.won ?? 0}</td>
                                        <td className={styles.statCell}>{team.draws ?? team.drawn ?? 0}</td>
                                        <td className={styles.statCell}>{team.losses ?? team.lost ?? 0}</td>

                                        {/* STATISTICHE (Touchdown) */}
                                        <td className={styles.statCell}>{team.td_for ?? 0}</td>
                                        <td className={styles.statCell}>{team.td_against ?? 0}</td>
                                        <td className={`${styles.statCell} ${team.td_diff > 0 ? styles.statDiffPositive : team.td_diff < 0 ? styles.statDiffNegative : ''}`}>
                                            {team.td_diff > 0 ? `+${team.td_diff}` : (team.td_diff ?? 0)}
                                        </td>

                                        {/* STATISTICHE (Casualties) */}
                                        <td className={styles.statCell}>{team.cas_for ?? 0}</td>
                                        <td className={styles.statCell}>{team.cas_against ?? 0}</td>
                                        <td className={`${styles.statCell} ${team.cas_diff > 0 ? styles.statDiffPositive : team.cas_diff < 0 ? styles.statDiffNegative : ''}`}>
                                            {team.cas_diff > 0 ? `+${team.cas_diff}` : (team.cas_diff ?? 0)}
                                        </td>

                                        {/* PUNTI */}
                                        <td className={styles.ptsCell}>{team.points ?? 0}</td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>

                        {/* LEGENDA PLAYOFF */}
                        <div className={styles.legendArea}>
                            <div className={styles.legendBox}></div>
                            <span className={styles.legendText}>{t.standings.qualifyNote}</span>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
}