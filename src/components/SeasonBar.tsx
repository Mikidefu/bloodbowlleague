'use client';
import Link from 'next/link';
import { CalendarRange, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useSeason } from '@/lib/SeasonContext';
import type { SeasonStatus } from '@/lib/types';
import styles from './SeasonBar.module.css';

const BADGE_CLASS: Record<SeasonStatus, string> = {
  active: styles.badgeActive,
  completed: styles.badgeCompleted,
  paused: styles.badgePaused,
  cancelled: styles.badgeCancelled,
};

// Barra sotto la navbar: stagione consultata, stato, avanzamento e link alla gestione delle stagioni
export default function SeasonBar() {
  const { t } = useLanguage();
  const { seasons, selectedSeason, setSelectedSeasonId, seasonsLoading } = useSeason();

  if (seasonsLoading || !selectedSeason) return null;

  const statusLabel: Record<SeasonStatus, string> = {
    active: t.seasons.active,
    completed: t.seasons.completed,
    paused: t.seasons.paused,
    cancelled: t.seasons.cancelled,
  };
  const banner: Record<SeasonStatus, string | null> = {
    active: null,
    completed: t.seasons.readOnlyBanner,
    paused: t.seasons.pausedBanner,
    cancelled: t.seasons.cancelledBanner,
  };
  const status = selectedSeason.status;

  const code = `S${String(selectedSeason.number).padStart(2, '0')}`;
  const total = selectedSeason.matches_total || 0;
  const played = selectedSeason.matches_played || 0;
  const progress = total > 0 ? Math.round((played / total) * 100) : 0;

  return (
      <>
        <div className={styles.seasonBar}>
          <div className={styles.inner}>
            <label htmlFor="season-select" className={styles.label}>
              <span className={styles.labelCode}>{code}</span>
              <span className={styles.labelText}>{t.seasons.season}</span>
            </label>

            <div className={styles.selectWrap}>
              <select
                  id="season-select"
                  className={styles.select}
                  value={selectedSeason.id}
                  onChange={e => setSelectedSeasonId(e.target.value)}
              >
                {seasons.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.status !== 'completed' ? ` (${statusLabel[s.status]})` : ''}
                    </option>
                ))}
              </select>
              <ChevronDown size={18} className={styles.chevron} aria-hidden="true" />
            </div>

            <span className={`${styles.badge} ${BADGE_CLASS[status]}`}>
              <i className={styles.dot} aria-hidden="true" />
              {statusLabel[status]}
            </span>

            {total > 0 && (
                <span className={styles.progress} title={`${played} / ${total}`}>
                  <span className={styles.progressText}>{played}<small>/{total}</small></span>
                  <span className={styles.progressTrack} aria-hidden="true">
                    <span className={styles.progressFill} style={{ width: `${progress}%` }} />
                  </span>
                </span>
            )}

            <Link href="/seasons" className={styles.manageLink}>
              <CalendarRange size={16} aria-hidden="true" />
              <span className={styles.manageText}>{t.seasons.manage}</span>
            </Link>
          </div>
        </div>
        {banner[status] && (
            <div className={`${styles.readOnlyBanner} ${status === 'cancelled' ? styles.cancelledBanner : ''}`} role="status">
              <span>{banner[status]}</span>
            </div>
        )}
      </>
  );
}
