'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import styles from './Home.module.css';
import { Users, Calendar, ShieldAlert } from 'lucide-react';

export default function Home() {
    const { t } = useLanguage();
    const [stats, setStats] = useState({ teams: 0, matches: 0, casualties: 0 });

    useEffect(() => {
        fetch('/api/stats')
            .then(res => res.json())
            .then(data => {
                const teamsCount = data.standings?.length || 0;
                const matchesCount = data.standings?.reduce((sum: number, t: any) => sum + (t.played || 0), 0) / 2 || 0;
                const casualtiesCount = data.playerStats?.killers?.reduce((sum: number, p: any) => sum + p.total_cas, 0) || 0;
                setStats({ teams: teamsCount, matches: Math.floor(matchesCount), casualties: casualtiesCount });
            })
            .catch(console.error);
    }, []);

    return (
        <div className={styles.dashboard}>
            {/* FILTRO SVG (Assicuriamoci che sia presente per l'effetto strappato) */}
            <svg style={{ position: 'absolute', width: 0, height: 0 }}>
                <filter id="rough-edges">
                    <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" result="noise" />
                    <feDisplacementMap in="SourceGraphic" in2="noise" scale="6" xChannelSelector="R" yChannelSelector="G" />
                </filter>
            </svg>

            {/* HERO POSTER */}
            <div className={styles.heroPoster}>
                <div className={styles.heroBg}></div>
                <div className={styles.heroContent}>
                    <h1 className={styles.heroTitle}>{t.home.title}</h1>
                    <p className={styles.heroSubtitle}>{t.home.subtitle}</p>
                    <Link href="/teams" className="btn btn-primary" style={{ fontSize: '1.8rem', padding: '1.5rem 4rem' }}>
                        {t.home.manageTeamsBtn}
                    </Link>
                </div>
            </div>

            {/* LEAGUE STATUS (Note Card) */}
            <div className={styles.noteCard}>
                <h2 className={styles.cardTitle}>{t.home.leagueStatus}</h2>
                <ul className={styles.statList}>
                    <li className={styles.statItem}>
                        <span className={styles.statLabel}>{t.home.registeredTeams}</span>
                        <span className={styles.statValue}>{stats.teams}</span>
                    </li>
                    <li className={styles.statItem}>
                        <span className={styles.statLabel}>{t.home.matchesPlayed}</span>
                        <span className={styles.statValue}>{stats.matches}</span>
                    </li>
                    <li className={styles.statItem}>
                        <span className={styles.statLabel}>{t.home.totalCasualties}</span>
                        <span className={`${styles.statValue} styles.statValueBlood`}>{stats.casualties}</span>
                    </li>
                </ul>
            </div>

            {/* QUICK ACTIONS (Note Card) */}
            <div className={styles.noteCard}>
                <h2 className={styles.cardTitle}>{t.home.quickActions}</h2>
                <div className={styles.actionGrid}>
                    <Link href="/teams/new" className="btn btn-primary" style={{ width: '100%' }}>
                        <Users size={20} style={{marginRight: '10px'}} /> {t.home.draftNewTeam}
                    </Link>
                    <Link href="/schedule" className="btn" style={{ width: '100%', backgroundColor: '#fff' }}>
                        <Calendar size={20} style={{marginRight: '10px'}} /> {t.home.generateSchedule}
                    </Link>
                </div>
            </div>

        </div>
    );
}