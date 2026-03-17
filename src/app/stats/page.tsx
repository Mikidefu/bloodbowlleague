'use client';
import { useState, useEffect } from 'react';
import { Skull, Star, Trophy, Target } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import styles from './Stats.module.css';

export default function StatsPage() {
    const { t } = useLanguage();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/stats')
            .then(res => res.json())
            .then(data => {
                setStats(data.playerStats);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    if (loading) return <div style={{ fontFamily: 'var(--font-typewriter)', fontSize: '1.5rem', textAlign: 'center', marginTop: '4rem' }}>Scouting player stats...</div>;

    // Renderizzatore intelligente delle tabelle
    const renderPlayerTable = (players: any[], sortKey: string, highlightColor: string) => (
        <div className={styles.tableWrapper}>
            <table className={styles.dataTable}>
                <thead className={styles.tableHead}>
                <tr>
                    <th className={styles.playerCol}>{t.stats.thPlayer}</th>
                    <th style={{ color: sortKey === 'td' ? highlightColor : '#888' }}>TD</th>
                    <th style={{ color: sortKey === 'cas' ? highlightColor : '#888' }}>CAS</th>
                    <th style={{ color: sortKey === 'mvp' ? highlightColor : '#888' }}>MVP</th>
                    <th style={{ color: sortKey === 'spp' ? highlightColor : '#888' }}>SPP</th>
                </tr>
                </thead>
                <tbody>
                {players.map((p, idx) => {
                    const isTopPlayer = idx === 0;
                    return (
                        <tr key={p.id} className={isTopPlayer ? styles.topPlayerRow : styles.playerRow}>
                            {/* Nome Giocatore e Squadra */}
                            <td className={styles.playerCell}>
                                <h3 className={styles.playerName} style={{ color: isTopPlayer ? highlightColor : '#fff' }}>
                                    {p.name}
                                </h3>
                                <div className={styles.teamName}>{p.team_name}</div>
                            </td>

                            {/* Statistiche */}
                            <td className={`${styles.numberCell} ${sortKey === 'td' ? styles.highlightNumber : ''}`} style={sortKey === 'td' ? { color: highlightColor } : {}}>
                                {p.total_td ?? 0}
                            </td>
                            <td className={`${styles.numberCell} ${sortKey === 'cas' ? styles.highlightNumber : ''}`} style={sortKey === 'cas' ? { color: highlightColor } : {}}>
                                {p.total_cas ?? 0}
                            </td>
                            <td className={`${styles.numberCell} ${sortKey === 'mvp' ? styles.highlightNumber : ''}`} style={sortKey === 'mvp' ? { color: highlightColor } : {}}>
                                {p.total_mvp ?? 0}
                            </td>
                            <td className={`${styles.numberCell} ${sortKey === 'spp' ? styles.highlightNumber : ''}`} style={sortKey === 'spp' ? { color: highlightColor } : {}}>
                                {p.total_spp ?? 0}
                            </td>
                        </tr>
                    );
                })}
                {players.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#555', fontFamily: 'var(--font-typewriter)' }}>NO DATA</td></tr>
                )}
                </tbody>
            </table>
        </div>
    );

    return (
        <div>
            {/* HEADER PAGE */}
            <div className={styles.headerArea}>
                <h1 className={styles.pageTitle}>
                    <Target size={48} color="var(--color-ink)" />
                    {t.stats.title}
                </h1>
            </div>

            {/* CONTENUTO */}
            {!stats || (!stats.scorers.length && !stats.killers.length) ? (
                <div className="card" style={{ textAlign: 'center', padding: '5rem' }}>
                    <p style={{ fontFamily: 'var(--font-impact)', fontSize: '2rem', color: 'var(--color-ink)' }}>{t.stats.noStats}</p>
                </div>
            ) : (
                <div className={styles.statsGrid}>

                    {/* TABELLONE TOP SCORERS (Verde) */}
                    <div className={styles.statCard} style={{ borderTopColor: '#4ade80' }}>
                        <div className={styles.cardHeader} style={{ color: '#4ade80' }}>
                            <Star size={32} /> {t.stats.topScorers} (TD)
                        </div>
                        {renderPlayerTable(stats.scorers, 'td', '#4ade80')}
                    </div>

                    {/* TABELLONE TOP KILLERS (Rosso) */}
                    <div className={styles.statCard} style={{ borderTopColor: 'var(--color-blood-bright)' }}>
                        <div className={styles.cardHeader} style={{ color: 'var(--color-blood-bright)' }}>
                            <Skull size={32} /> {t.stats.topKillers} (CAS)
                        </div>
                        {renderPlayerTable(stats.killers, 'cas', 'var(--color-blood-bright)')}
                    </div>

                    {/* TABELLONE MOST MVPs (Oro) */}
                    <div className={styles.statCard} style={{ borderTopColor: 'var(--color-gold)' }}>
                        <div className={styles.cardHeader} style={{ color: 'var(--color-gold)' }}>
                            <Trophy size={32} /> {t.stats.mostMvps} (MVP)
                        </div>
                        {renderPlayerTable(stats.mvps, 'mvp', 'var(--color-gold)')}
                    </div>

                    {/* TABELLONE TOP EXPERIENCE (Bianco/Osso) */}
                    <div className={styles.statCard} style={{ borderTopColor: '#fff' }}>
                        <div className={styles.cardHeader} style={{ color: '#fff' }}>
                            <Star size={32} /> {t.stats.topExperience} (SPP)
                        </div>
                        {renderPlayerTable(stats.spp, 'spp', '#fff')}
                    </div>

                </div>
            )}
        </div>
    );
}