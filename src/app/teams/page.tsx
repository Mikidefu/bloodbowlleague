'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Plus, ShieldAlert } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import styles from './Teams.module.css';

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
        {/* FILTRO SVG PER EFFETTO CARTA STRAPPATA */}
        <svg style={{ position: 'absolute', width: 0, height: 0 }}>
          <filter id="rough-edges">
            <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>

        <div className={styles.headerArea}>
          <h1 className={styles.pageTitle}>
            <Users size={48} color="var(--color-ink)" />
            {t.teams.title}
          </h1>
          <Link href="/teams/new" className="btn btn-primary">
            <Plus size={24} />
            {t.teams.draftBtn}
          </Link>
        </div>

        {loading ? (
            <div style={{ fontFamily: 'var(--font-typewriter)', fontSize: '1.5rem', textAlign: 'center', marginTop: '4rem' }}>
              Opening archives...
            </div>
        ) : teams.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '5rem' }}>
              <h2 className={styles.emptyTitle}>{t.teams.noTeamsTitle}</h2>
              <p>{t.teams.noTeamsDesc}</p>
              <Link href="/teams/new" className="btn btn-primary" style={{ marginTop: '2rem' }}>
                {t.teams.createFirstBtn}
              </Link>
            </div>
        ) : (
            <div className={styles.teamsGrid}>
              {teams.map(team => (
                  <Link
                      href={`/teams/${team.id}`}
                      key={team.id}
                      className={styles.teamCard}
                  >
                    {/* Pezzetto di nastro adesivo in alto */}
                    <div className={styles.tape}></div>

                    {/* LOGO GIGANTE CENTRALE */}
                    <div className={styles.logoWrapper}>
                      {team.logo_url ? (
                          <img src={team.logo_url} alt={team.name} className={styles.teamLogo} />
                      ) : (
                          <ShieldAlert size={150} color={team.primary_color || '#333'} className={styles.teamLogo} />
                      )}
                    </div>

                    {/* ETICHETTE IN BASSO */}
                    <div className={styles.cardFooter}>
                      <div
                          className={styles.nameTag}
                          style={{ backgroundColor: team.primary_color || '#111' }}
                      >
                        {team.name}
                      </div>
                      <div className={styles.raceTag}>
                        {team.race}
                      </div>
                    </div>

                  </Link>
              ))}
            </div>
        )}
      </div>
  );
}