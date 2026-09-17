'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import Emblem from '@/components/brand/Emblem';
import styles from './Home.module.css';
import { Users, Calendar, Trophy } from 'lucide-react';

export default function Home() {
    const { t } = useLanguage();
    const { isAdmin } = useAuth();
    const [stats, setStats] = useState({ teams: 0, matches: 0, casualties: 0 });

    useEffect(() => {
        fetch('/api/stats')
            .then(res => res.json())
            .then(data => {
                setStats({
                    teams: data.totals?.teams || 0,
                    matches: data.totals?.matches_played || 0,
                    casualties: data.totals?.casualties || 0,
                });
            })
            .catch(console.error);
    }, []);

    const headlines = [
        { value: stats.teams, label: t.home.registeredTeams },
        { value: stats.matches, label: t.home.matchesPlayed },
        { value: stats.casualties, label: t.home.totalCasualties, blood: true },
    ];

    return (
        <div className={styles.dashboard}>
            {/* COPERTINA (stile Spike! Journal) */}
            <section className={styles.cover}>
                <div className={styles.issueBox} aria-hidden="true">
                    <span>New</span>
                    <strong>{new Date().getFullYear()}</strong>
                </div>

                <div className={styles.banner}>
                    <h1 className={styles.heroTitle}>{t.home.title}</h1>
                    <p className={styles.bannerLine}>The Game of Fantasy Football</p>
                </div>

                <div className={styles.coverBody}>
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

                <Emblem size={210} className={styles.coverEmblem} />
                <span className={`splatter ${styles.coverSplatter}`} aria-hidden="true" />
            </section>

            {/* STATO DELLA LEGA: titoli a capolettera come in copertina */}
            <section className={styles.statusPanel}>
                <h2 className="title-spike">{t.home.leagueStatus}</h2>
                <ul className={styles.headlineList}>
                    {headlines.map(item => (
                        <li key={item.label} className={styles.headline}>
                            <span className={`${styles.headlineValue} ${item.blood ? styles.headlineBlood : ''}`}>
                                {item.value}
                            </span>
                            <span className={styles.headlineLabel}>{item.label.replace(/:\s*$/, '')}</span>
                        </li>
                    ))}
                </ul>
            </section>

            {/* AZIONI RAPIDE */}
            <section className={`card ${styles.actionsCard}`}>
                <h2 className="title-slab">{t.home.quickActions}</h2>
                <div className={styles.actionGrid}>
                    {isAdmin && (
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
