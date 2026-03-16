'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Plus } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function TeamsPage() {
  const { t } = useLanguage();
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/teams')
      .then(res => res.json())
      .then(data => {
        setTeams(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading teams', err);
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '2px solid var(--color-blood-red)', paddingBottom: '1rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '3rem' }}>
          <Users size={40} color="var(--color-blood-bright)" />
          {t.teams.title}
        </h1>
        <Link href="/teams/new" className="btn btn-primary">
          <Plus size={20} />
          {t.teams.draftBtn}
        </Link>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : teams.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
          <h2 style={{ color: 'var(--color-steel-light)', marginBottom: '1rem' }}>{t.teams.noTeamsTitle}</h2>
          <p style={{ marginBottom: '2rem' }}>{t.teams.noTeamsDesc}</p>
          <Link href="/teams/new" className="btn btn-primary">{t.teams.createFirstBtn}</Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {teams.map(team => (
            <Link href={`/teams/${team.id}`} key={team.id} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
                <div style={{ 
                  position: 'absolute', top: 0, left: 0, right: 0, height: '8px', 
                  background: `linear-gradient(to right, ${team.primary_color}, ${team.secondary_color})` 
                }}></div>
                <h2 style={{ fontSize: '2rem', marginTop: '0.5rem', marginBottom: '0.5rem', color: 'var(--color-bone)' }}>{team.name}</h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-steel-light)', marginBottom: '1rem' }}>
                  <span>{team.race}</span>
                </div>
                {team.logo_url && (
                  <div style={{ width: '100%', height: '150px', backgroundImage: `url(${team.logo_url})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', opacity: 0.8 }}></div>
                )}
                {!team.logo_url && (
                  <div style={{ width: '100%', height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '4px' }}>
                    <Users size={48} color="var(--color-steel)" />
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
