'use client';
import Link from 'next/link';
import { CalendarRange, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useSeason } from '@/lib/SeasonContext';
import styles from './SeasonBar.module.css';

// Barra sotto la navbar: stagione consultata, stato, avanzamento e link alla gestione delle stagioni
export default function SeasonBar() {
  const { t } = useLanguage();
  const { seasons, selectedSeason, isViewingActive, setSelectedSeasonId, seasonsLoading } = useSeason();

  if (seasonsLoading || !selectedSeason) return null;

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
                      {s.name}{s.status === 'active' ? ` (${t.seasons.active})` : ''}
                    </option>
                ))}
              </select>
              <ChevronDown size={18} className={styles.chevron} aria-hidden="true" />
            </div>

            <span className={`${styles.badge} ${isViewingActive ? styles.badgeActive : styles.badgeCompleted}`}>
              <i className={styles.dot} aria-hidden="true" />
              {isViewingActive ? t.seasons.active : t.seasons.completed}
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
        {!isViewingActive && (
            <div className={styles.readOnlyBanner} role="status">
              <span>{t.seasons.readOnlyBanner}</span>
            </div>
        )}
      </>
  );
}
