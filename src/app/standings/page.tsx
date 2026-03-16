'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

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

  if (loading) return <div>Computing league standings...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '2px solid var(--color-blood-red)', paddingBottom: '1rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '3rem' }}>
          <Trophy size={40} color="#ffd700" />
          {t.standings.title}
        </h1>
      </div>

      <div className="card">
        {standings.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--color-steel-light)' }}>{t.standings.noStandings}</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '60px', textAlign: 'center' }}>{t.standings.pos}</th>
                  <th>{t.standings.team}</th>
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
                  <th style={{ color: 'var(--color-blood-bright)', fontSize: '1.2rem', padding: '1rem' }}>{t.standings.pts}</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((team, index) => {
                  const isPlayoffZone = index < 4;
                  return (
                    <tr key={team.id} style={{ 
                      backgroundColor: isPlayoffZone ? 'rgba(255, 215, 0, 0.05)' : 'transparent',
                      borderLeft: isPlayoffZone ? '4px solid #ffd700' : '4px solid transparent'
                    }}>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.2rem', color: isPlayoffZone ? '#ffd700' : 'var(--color-steel-light)' }}>
                        {index + 1}
                      </td>
                      <td>
                        <Link href={`/teams/${team.id}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: 'var(--color-bone)', fontWeight: 'bold' }}>
                          {team.logo_url ? (
                            <div style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <img src={team.logo_url} alt={team.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                            </div>
                          ) : (
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: team.primary_color, border: `1px solid ${team.secondary_color}` }}></div>
                          )}
                          {team.name}
                        </Link>
                      </td>
                      <td>{team.played}</td>
                      <td>{team.won}</td>
                      <td>{team.drawn}</td>
                      <td>{team.lost}</td>
                      <td>{team.td_for}</td>
                      <td>{team.td_against}</td>
                      <td style={{ color: team.td_diff > 0 ? 'var(--color-grass-light)' : team.td_diff < 0 ? 'var(--color-blood-bright)' : 'var(--color-steel-light)' }}>
                        {team.td_diff > 0 ? `+${team.td_diff}` : team.td_diff}
                      </td>
                      <td>{team.cas_for}</td>
                      <td>{team.cas_against}</td>
                      <td style={{ color: team.cas_diff > 0 ? 'var(--color-grass-light)' : team.cas_diff < 0 ? 'var(--color-blood-bright)' : 'var(--color-steel-light)' }}>
                        {team.cas_diff > 0 ? `+${team.cas_diff}` : team.cas_diff}
                      </td>
                      <td style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--color-blood-bright)' }}>{team.points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--color-steel-light)' }}>
              <div style={{ width: '12px', height: '12px', backgroundColor: '#ffd700' }}></div>
              <span>{t.standings.qualifyNote}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
