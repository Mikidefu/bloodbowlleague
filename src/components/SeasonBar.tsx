'use client';
import Link from 'next/link';
import { CalendarRange } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useSeason } from '@/lib/SeasonContext';
import styles from './SeasonBar.module.css';

// Barra sotto la navbar: stagione consultata, stato e link alla gestione delle stagioni
export default function SeasonBar() {
  const { t } = useLanguage();
  const { seasons, selectedSeason, isViewingActive, setSelectedSeasonId, seasonsLoading } = useSeason();

  if (seasonsLoading || !selectedSeason) return null;

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
                  {s.name}{s.status === 'active' ? ` (${t.seasons.active})` : ''}
                </option>
            ))}
          </select>
          <span className={`${styles.badge} ${isViewingActive ? styles.badgeActive : styles.badgeCompleted}`}>
            {isViewingActive ? t.seasons.active : t.seasons.completed}
          </span>
          <Link href="/seasons" className={styles.manageLink}>
            <CalendarRange size={18} aria-hidden="true" /> <span className={styles.manageText}>{t.seasons.manage}</span>
          </Link>
        </div>
        {!isViewingActive && <div className={styles.readOnlyBanner}>{t.seasons.readOnlyBanner}</div>}
      </>
  );
}
