'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Plus, ShieldAlert } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { useSeason } from '@/lib/SeasonContext';
import PageHeader from '@/components/brand/PageHeader';
import styles from './Teams.module.css';
import type { Team } from '@/lib/types';

type SeasonTeam = Team & { coach_id: string | null; coach_name: string | null };

export default function TeamsPage() {
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
  const { seasonQuery, seasonsLoading, isViewingActive } = useSeason();
  const [teams, setTeams] = useState<SeasonTeam[]>([]);
  const [loading, setLoading] = useState(true);

  // Squadre iscritte alla stagione consultata
  useEffect(() => {
    if (seasonsLoading) return;
    let cancelled = false;
    fetch(`/api/teams${seasonQuery}`)
        .then(res => res.json())
        .then(data => {
          if (cancelled) return;
          setTeams(Array.isArray(data) ? data : []);
          setLoading(false);
        })
        .catch(err => {
          console.error('Error loading teams', err);
          if (!cancelled) setLoading(false);
        });
    return () => { cancelled = true; };
  }, [seasonQuery, seasonsLoading]);

  // Le squadre nuove entrano sempre nella stagione in corso
  const canDraft = isAdmin && isViewingActive;

  return (
      <div>
        <PageHeader
            title={t.teams.title}
            icon={<Users size={48} />}
            actions={canDraft && (
                <Link href="/teams/new" className="btn btn-gold">
                  <Plus size={22} />
                  {t.teams.draftBtn}
                </Link>
            )}
        />

        {loading ? (
            <div className="loading-state">Opening archives...</div>
        ) : teams.length === 0 ? (
            <div className={`card ${styles.emptyCard}`}>
              <h2 className="title-slab">{t.teams.noTeamsTitle}</h2>
              <p>{t.teams.noTeamsDesc}</p>
              {canDraft && (
                  <Link href="/teams/new" className={`btn btn-primary ${styles.emptyAction}`}>
                    {t.teams.createFirstBtn}
                  </Link>
              )}
            </div>
        ) : (
            <div className={styles.teamsGrid}>
              {teams.map(team => (
                  <Link
                      href={`/teams/${team.id}`}
                      key={team.id}
                      className={styles.teamCard}
                      style={{ '--team-color': team.primary_color || 'var(--bb-blood-700)' } as React.CSSProperties}
                  >
                    <span className={styles.accentStripe} aria-hidden="true" />

                    <div className={styles.logoWrapper}>
                      {team.logo_url ? (
                          <img src={team.logo_url} alt={team.name} className={styles.teamLogo} />
                      ) : (
                          <ShieldAlert size={120} className={styles.fallbackLogo} aria-hidden="true" />
                      )}
                    </div>

                    <div className={styles.cardFooter}>
                      <h2 className={styles.teamName}>{team.name}</h2>
                      <span className="tag">{team.race}</span>
                      {team.coach_name && (
                          <span className={styles.coachLine}>
                            <span className={styles.coachLabel}>{t.coachPicker.label}:</span> {team.coach_name}
                          </span>
                      )}
                    </div>
                  </Link>
              ))}
            </div>
        )}
      </div>
  );
}
