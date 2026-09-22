'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Plus, ShieldAlert, ArrowRight } from 'lucide-react';
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
  const { seasonQuery, seasonsLoading, isViewingActive, selectedSeason } = useSeason();
  const seasonName = selectedSeason?.name ?? 'New Season';
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
            <section className={`bleed ${styles.rosterBand}`}>
              <span className={`ghost-text ${styles.ghost}`} aria-hidden="true">Teams</span>
              <div className={styles.inner}>
                <div className={styles.countStrip}>
                  <span className={styles.countNumber}>{String(teams.length).padStart(2, '0')}</span>
                  <span className={styles.countLabel}>
                    <i className={styles.microSquares} aria-hidden="true" />
                    {`${seasonName} // ${t.teams.title}`}
                  </span>
                </div>

                <div className={styles.teamsGrid}>
                  {teams.map((team, i) => (
                      <div key={team.id} className={`offset-frame ${styles.cardFrame}`}>
                        <Link
                            href={`/teams/${team.id}`}
                            className={styles.teamCard}
                            style={{
                              '--team-color': team.primary_color || 'var(--bb-blood-700)',
                              '--team-color-2': team.secondary_color || 'var(--bb-navy)',
                            } as React.CSSProperties}
                        >
                          <span className={styles.cardShard} aria-hidden="true" />
                          <span className={styles.cardIndex} aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                          <span className={styles.cardMicro}>
                            <i className={styles.microSquares} aria-hidden="true" />
                            {`BBL // ${team.race}`}
                          </span>

                          <span className={`team-crest ${styles.logoWrapper}`}>
                            {team.logo_url ? (
                                <img src={team.logo_url} alt={team.name} />
                            ) : (
                                <ShieldAlert size={80} aria-hidden="true" />
                            )}
                          </span>

                          <div className={styles.cardBody}>
                            <h2 className={styles.teamName}>{team.name}</h2>
                            <span className={styles.tags}>
                              <span className={styles.raceTag}>{team.race}</span>
                            </span>
                            {team.coach_name && (
                                <span className={styles.coachLine}>
                                  <span className={styles.coachLabel}>{t.coachPicker.label}</span>
                                  <span className={styles.coachName}>{team.coach_name}</span>
                                </span>
                            )}
                          </div>

                          <span className={styles.cardFoot}>
                            <span>Team profile</span>
                            <ArrowRight size={16} aria-hidden="true" />
                          </span>
                        </Link>
                      </div>
                  ))}
                </div>
              </div>
            </section>
        )}
      </div>
  );
}
