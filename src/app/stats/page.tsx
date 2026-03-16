'use client';
import { useState, useEffect } from 'react';
import { Skull, Star, Trophy } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

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

  if (loading) return <div>Scouting player stats...</div>;

  const renderPlayerTable = (players: any[], sortKey: string, highlightColor: string) => (
    <table className="data-table" style={{ fontSize: '0.9rem' }}>
      <thead>
        <tr>
          <th>{t.stats.thPlayer}</th>
          <th style={{ color: sortKey === 'td' ? highlightColor : '' }}>{t.stats.thTds}</th>
          <th style={{ color: sortKey === 'cas' ? highlightColor : '' }}>{t.stats.thCas}</th>
          <th style={{ color: sortKey === 'mvp' ? highlightColor : '' }}>{t.stats.thMvps}</th>
          <th style={{ color: sortKey === 'spp' ? highlightColor : '' }}>{t.stats.thSpp}</th>
        </tr>
      </thead>
      <tbody>
        {players.map((p, idx) => (
          <tr key={p.id} style={{ backgroundColor: idx === 0 ? `rgba(255,255,255,0.05)` : '' }}>
            <td>
              <div style={{ fontWeight: 'bold', color: idx === 0 ? highlightColor : 'var(--color-bone)' }}>{p.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-steel-light)' }}>{p.team_name}</div>
            </td>
            <td style={{ fontWeight: sortKey === 'td' ? 'bold' : 'normal' }}>{p.total_td}</td>
            <td style={{ fontWeight: sortKey === 'cas' ? 'bold' : 'normal' }}>{p.total_cas}</td>
            <td style={{ fontWeight: sortKey === 'mvp' ? 'bold' : 'normal' }}>{p.total_mvp}</td>
            <td style={{ fontWeight: sortKey === 'spp' ? 'bold' : 'normal' }}>{p.total_spp}</td>
          </tr>
        ))}
        {players.length === 0 && (
          <tr><td colSpan={5} style={{ textAlign: 'center' }}>-</td></tr>
        )}
      </tbody>
    </table>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '2px solid var(--color-blood-red)', paddingBottom: '1rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '3rem' }}>
          <Skull size={40} color="var(--color-bone)" />
          {t.stats.title}
        </h1>
      </div>

      {!stats || (!stats.scorers.length && !stats.killers.length) ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
          <p style={{ color: 'var(--color-steel-light)' }}>{t.stats.noStats}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
          
          <div className="card" style={{ borderTop: '4px solid var(--color-grass-light)' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--color-grass-light)' }}>
              <Star size={24} /> {t.stats.topScorers} (TD)
            </h2>
            {renderPlayerTable(stats.scorers, 'td', 'var(--color-grass-light)')}
          </div>

          <div className="card" style={{ borderTop: '4px solid var(--color-blood-bright)' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--color-blood-bright)' }}>
              <Skull size={24} /> {t.stats.topKillers} (CAS)
            </h2>
            {renderPlayerTable(stats.killers, 'cas', 'var(--color-blood-bright)')}
          </div>

          <div className="card" style={{ borderTop: '4px solid #ffd700' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#ffd700' }}>
              <Trophy size={24} /> {t.stats.mostMvps} (MVP)
            </h2>
            {renderPlayerTable(stats.mvps, 'mvp', '#ffd700')}
          </div>

          <div className="card" style={{ borderTop: '4px solid var(--color-bone)' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--color-bone)' }}>
              <Star size={24} /> {t.stats.topExperience} (SPP)
            </h2>
            {renderPlayerTable(stats.spp, 'spp', 'var(--color-bone)')}
          </div>

        </div>
      )}
    </div>
  );
}
