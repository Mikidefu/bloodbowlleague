'use client';
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Skull, Star, Trophy, Target } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import PageHeader from '@/components/brand/PageHeader';
import { useSeason } from '@/lib/SeasonContext';
import styles from './Stats.module.css';
import type { PlayerLeader } from '@/lib/types';

type PlayerStatsBoard = {
    scorers: PlayerLeader[];
    killers: PlayerLeader[];
    mvps: PlayerLeader[];
    spp: PlayerLeader[];
};

type SortKey = 'td' | 'cas' | 'mvp' | 'spp';

const STAT_COLUMNS: { key: SortKey; label: string; value: (p: PlayerLeader) => number }[] = [
    { key: 'td', label: 'TD', value: p => p.total_td ?? 0 },
    { key: 'cas', label: 'CAS', value: p => p.total_cas ?? 0 },
    { key: 'mvp', label: 'MVP', value: p => p.total_mvp ?? 0 },
    { key: 'spp', label: 'SPP', value: p => p.total_spp ?? 0 },
];

export default function StatsPage() {
    const { t } = useLanguage();
    const { seasonQuery, seasonsLoading, selectedSeason } = useSeason();
    const [stats, setStats] = useState<PlayerStatsBoard | null>(null);
    const [loading, setLoading] = useState(true);

    // Statistiche della stagione consultata
    useEffect(() => {
        if (seasonsLoading) return;
        let cancelled = false;
        fetch(`/api/stats${seasonQuery}`)
            .then(res => res.json())
            .then(data => {
                if (cancelled) return;
                setStats(data.playerStats ?? null);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [seasonQuery, seasonsLoading]);

    if (loading) return <div className="loading-state">Scouting player stats...</div>;

    // Tabellone Hall of Fame: capoclassifica in evidenza + tabella completa
    const renderBoard = (
        players: PlayerLeader[],
        sortKey: SortKey,
        title: string,
        icon: ReactNode,
        tone: 'slate' | 'blood',
    ) => {
        const sortColumn = STAT_COLUMNS.find(c => c.key === sortKey)!;
        const leader = players[0];

        return (
            <section className={`${tone === 'blood' ? 'panel-blood' : 'panel-slate'} ${styles.board}`}>
                <header className={styles.boardHeader}>
                    <h2 className={`title-spike ${styles.boardTitle}`}>
                        <span className={styles.boardIcon} aria-hidden="true">{icon}</span>
                        <span>{title}</span>
                    </h2>
                    <span className={`tag ${styles.boardTag}`}>{sortColumn.label}</span>
                </header>

                {leader && (
                    <div className={styles.leader}>
                        <span className={styles.leaderRank} aria-hidden="true">#1</span>
                        <div className={styles.leaderInfo}>
                            <h3 className={styles.leaderName}>{leader.name}</h3>
                            <div className={styles.leaderTeam}>
                                <span
                                    className={styles.teamSwatch}
                                    style={{ backgroundColor: leader.primary_color || undefined }}
                                    aria-hidden="true"
                                />
                                {leader.team_name}
                            </div>
                        </div>
                        <div className={styles.leaderValue}>
                            <strong>{sortColumn.value(leader)}</strong>
                            <span>{sortColumn.label}</span>
                        </div>
                    </div>
                )}

                <div className={`table-container ${styles.tableContainer}`}>
                    <table className={`data-table ${styles.table}`}>
                        <thead>
                        <tr>
                            <th className={`num ${styles.rankCol}`}>#</th>
                            <th>{t.stats.thPlayer}</th>
                            {STAT_COLUMNS.map(col => (
                                <th
                                    key={col.key}
                                    className={`num ${col.key === sortKey ? styles.sortHead : ''}`}
                                >
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                        </thead>
                        <tbody>
                        {players.map((p, idx) => {
                            const isTopPlayer = idx === 0;
                            return (
                                <tr key={p.id} className={isTopPlayer ? styles.topPlayerRow : undefined}>
                                    <td className={`num ${styles.rankCell}`}>{idx + 1}</td>

                                    {/* Nome Giocatore e Squadra */}
                                    <td className={styles.playerCell}>
                                        <span className={styles.playerName}>{p.name}</span>
                                        <span className={styles.teamName}>{p.team_name}</span>
                                    </td>

                                    {/* Statistiche */}
                                    {STAT_COLUMNS.map(col => (
                                        <td
                                            key={col.key}
                                            className={`num ${col.key === sortKey ? styles.sortCell : styles.statCell}`}
                                        >
                                            {col.value(p)}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                        {players.length === 0 && (
                            <tr><td colSpan={6} className={styles.noData}>NO DATA</td></tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </section>
        );
    };

    return (
        <div className={styles.page}>
            <PageHeader title={t.stats.title} kicker={selectedSeason?.name} icon={<Target size={44} />} tone="slate" />

            {!stats || (!stats.scorers.length && !stats.killers.length) ? (
                <div className={`card ${styles.emptyCard}`}>
                    <p className={styles.emptyText}>{t.stats.noStats}</p>
                </div>
            ) : (
                <div className={styles.statsGrid}>
                    {renderBoard(stats.scorers, 'td', t.stats.topScorers, <Star size={30} />, 'slate')}
                    {renderBoard(stats.killers, 'cas', t.stats.topKillers, <Skull size={30} />, 'blood')}
                    {renderBoard(stats.mvps, 'mvp', t.stats.mostMvps, <Trophy size={30} />, 'blood')}
                    {renderBoard(stats.spp, 'spp', t.stats.topExperience, <Star size={30} />, 'slate')}
                </div>
            )}
        </div>
    );
}
