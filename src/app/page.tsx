'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/LanguageContext';

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
    <div className="dashboard-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '3rem', marginTop: '2rem' }}>
      
      <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '5rem 3rem', backgroundImage: 'linear-gradient(to bottom, rgba(8, 8, 8, 0.3), rgba(8, 8, 8, 0.9)), url("https://images.unsplash.com/photo-1566579090262-51cde5abe813?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80")', backgroundSize: 'cover', backgroundPosition: 'center', border: '1px solid var(--color-blood-red)', boxShadow: '0 0 30px rgba(229, 9, 20, 0.2)' }}>
        <h1 className="hero-title" style={{ marginBottom: '1.5rem', color: 'var(--color-blood-bright)', textShadow: '0 0 20px rgba(229, 9, 20, 0.8)' }}>
          {t.home.title}
        </h1>
        <p style={{ fontSize: '1.4rem', marginBottom: '3rem', maxWidth: '800px', margin: '0 auto 3rem', color: '#e0e0e0', lineHeight: 1.6, textShadow: '1px 1px 5px #000' }}>
          {t.home.subtitle}
        </p>
        <Link href="/teams" className="btn btn-primary" style={{ fontSize: '1.6rem', padding: '1.2rem 4rem' }}>
          {t.home.manageTeamsBtn}
        </Link>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <h2 style={{ borderBottom: '1px solid var(--color-glass-border)', paddingBottom: '1rem', marginBottom: '1.5rem', color: 'var(--color-steel-light)' }}>
          {t.home.leagueStatus}
        </h2>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '1.5rem', fontSize: '1.2rem' }}>
          <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
            <span style={{ color: 'var(--color-steel-light)' }}>{t.home.registeredTeams}</span>
            <span style={{ fontWeight: 'bold', fontSize: '1.5rem', color: 'var(--color-bone)' }}>{stats.teams}</span>
          </li>
          <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
            <span style={{ color: 'var(--color-steel-light)' }}>{t.home.matchesPlayed}</span>
            <span style={{ fontWeight: 'bold', fontSize: '1.5rem', color: 'var(--color-bone)' }}>{stats.matches}</span>
          </li>
          <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--color-steel-light)' }}>{t.home.totalCasualties}</span>
            <span style={{ fontWeight: 'bold', fontSize: '1.8rem', color: 'var(--color-blood-bright)', textShadow: '0 0 10px rgba(229, 9, 20, 0.5)' }}>{stats.casualties}</span>
          </li>
        </ul>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <h2 style={{ borderBottom: '1px solid var(--color-glass-border)', paddingBottom: '1rem', marginBottom: '1.5rem', color: 'var(--color-steel-light)' }}>
          {t.home.quickActions}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <Link href="/teams/new" className="btn btn-primary" style={{ justifyContent: 'center' }}>
            {t.home.draftNewTeam}
          </Link>
          <Link href="/schedule" className="btn" style={{ justifyContent: 'center', background: 'var(--color-steel)', borderColor: 'var(--color-steel-light)' }}>
            {t.home.generateSchedule}
          </Link>
        </div>
      </div>

    </div>
  );
}
