'use client';
import Link from 'next/link';
import { CalendarRange } from 'lucide-react';
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

// Barra sotto la navbar: stagione consultata, stato e link alla gestione delle stagioni
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

  return (
      <>
        <div className={styles.seasonBar}>
          <label htmlFor="season-select" className={styles.label}>{t.seasons.season}</label>
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
          <span className={`${styles.badge} ${BADGE_CLASS[status]}`}>{statusLabel[status]}</span>
          <Link href="/seasons" className={styles.manageLink}>
            <CalendarRange size={18} aria-hidden="true" /> <span className={styles.manageText}>{t.seasons.manage}</span>
          </Link>
        </div>
        {banner[status] && (
            <div className={`${styles.readOnlyBanner} ${status === 'cancelled' ? styles.cancelledBanner : ''}`}>{banner[status]}</div>
        )}
      </>
  );
}
