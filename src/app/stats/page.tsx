'use client';
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Skull, Star, Trophy, Target } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import PageHeader from '@/components/brand/PageHeader';
import SectionTitle from '@/components/brand/SectionTitle';
import Shards from '@/components/brand/Shards';
import { useSeason } from '@/lib/SeasonContext';
import { ART } from '@/lib/art';
import { useArt } from '@/lib/useArt';
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

const pad = (n: number) => String(n).padStart(2, '0');

type BoardConfig = {
    players: PlayerLeader[];
    sortKey: SortKey;
    title: string;
    icon: ReactNode;
    index: string;
    code: string;
    ghost: string;
    tone: 'light' | 'dark';
    flip?: boolean;
    withArt?: boolean;
};

export default function StatsPage() {
    const { t } = useLanguage();
    const { seasonQuery, seasonsLoading, selectedSeason } = useSeason();
    const [stats, setStats] = useState<PlayerStatsBoard | null>(null);
    const [loading, setLoading] = useState(true);
    const hasStarArt = useArt(ART.starPlayer);

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

    const seasonCode = `S${pad(selectedSeason?.number ?? 1)}`;

    // Sezione numerata della Hall of Fame: capoclassifica in grande + inseguitori in righe smussate
    const renderBoard = ({ players, sortKey, title, icon, index, code, ghost, tone, flip, withArt }: BoardConfig) => {
        const sortColumn = STAT_COLUMNS.find(c => c.key === sortKey)!;
        const leader = players[0];
        const chasers = players.slice(1);
        const isLight = tone === 'light';
        const showArt = withArt && hasStarArt;

        return (
            <section
                key={sortKey}
                className={[
                    'bleed',
                    styles.band,
                    isLight ? styles.bandLight : styles.bandDark,
                    flip ? styles.flip : '',
                    showArt ? styles.withArt : '',
                ].filter(Boolean).join(' ')}
            >
                <div className={styles.bandBg} aria-hidden="true">
                    {!isLight && <Shards variant="band" className={styles.bandShards} />}
                    <span className={`ghost-text ${isLight ? 'on-light' : ''} ${styles.ghost}`}>{ghost}</span>
                </div>

                <div className={styles.inner}>
                    <SectionTitle
                        index={index}
                        on={tone}
                        align={flip ? 'right' : 'left'}
                        micro={`${seasonCode} // ${code}`}
                        title={title}
                        action={<span className={`tag ${isLight ? 'tag-red' : ''} ${styles.boardTag}`}>{sortColumn.label}</span>}
                    />

                    <div className={styles.boardGrid}>
                        {showArt && (
                            <div className={styles.artCol} aria-hidden="true">
                                <img src={ART.starPlayer} alt="" className={styles.starArt} />
                            </div>
                        )}

                        <div className={styles.featureCol}>
                            {leader ? (
                                <div className={`offset-frame ${styles.featureFrame}`}>
                                    <div
                                        className={`chamfer ${styles.feature}`}
                                        style={{ ['--team' as string]: leader.primary_color || 'var(--bb-mustard)' }}
                                    >
                                        <span className={styles.featureNumeral} aria-hidden="true">01</span>
                                        <span className={styles.featureIcon} aria-hidden="true">{icon}</span>

                                        <span className={styles.featureMicro}>
                                            <i className={styles.microBar} aria-hidden="true" />
                                            {`#1 // ${code} // Leader`}
                                        </span>

                                        <div className={styles.featureBody}>
                                            <span className={styles.featureTeam}>
                                                <span className={styles.teamSwatch} aria-hidden="true" />
                                                {leader.team_name}
                                            </span>
                                            <h3 className={styles.featureName}>{leader.name}</h3>
                                        </div>

                                        <div className={styles.featureValue}>
                                            <strong>{sortColumn.value(leader)}</strong>
                                            <span>{sortColumn.label}</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className={styles.noData}>NO DATA</p>
                            )}
                        </div>

                        <div className={styles.rowsCol}>
                            <div className={styles.rowsHead} aria-hidden="true">
                                <span>#</span>
                                <span>{t.stats.thPlayer}</span>
                                <span>{sortColumn.label}</span>
                            </div>
                            {chasers.length > 0 ? (
                                <ol className={styles.rows} start={2}>
                                    {chasers.map((p, idx) => (
                                        <li
                                            key={p.id}
                                            className={`chamfer ${styles.row}`}
                                            style={{ ['--team' as string]: p.primary_color || 'var(--bb-slate-500)' }}
                                        >
                                            <span className={styles.rowPos}>{pad(idx + 2)}</span>
                                            <span className={styles.rowText}>
                                                <span className={styles.rowName}>{p.name}</span>
                                                <span className={styles.rowTeam}>{p.team_name}</span>
                                            </span>
                                            <span className={styles.rowValue}>{sortColumn.value(p)}</span>
                                        </li>
                                    ))}
                                </ol>
                            ) : (
                                <p className={styles.noData}>NO DATA</p>
                            )}
                        </div>
                    </div>
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
                <div className={styles.bands}>
                    {renderBoard({
                        players: stats.scorers, sortKey: 'td', title: t.stats.topScorers, icon: <Star size={30} />,
                        index: '01', code: 'Touchdowns', ghost: 'Scorers', tone: 'light', withArt: true,
                    })}
                    {renderBoard({
                        players: stats.killers, sortKey: 'cas', title: t.stats.topKillers, icon: <Skull size={30} />,
                        index: '02', code: 'Casualties', ghost: 'Killers', tone: 'dark', flip: true,
                    })}
                    {renderBoard({
                        players: stats.mvps, sortKey: 'mvp', title: t.stats.mostMvps, icon: <Trophy size={30} />,
                        index: '03', code: 'Most valuable', ghost: 'MVP', tone: 'light',
                    })}
                    {renderBoard({
                        players: stats.spp, sortKey: 'spp', title: t.stats.topExperience, icon: <Star size={30} />,
                        index: '04', code: 'Star player points', ghost: 'Legends', tone: 'dark', flip: true,
                    })}
                </div>
            )}
        </div>
    );
}
