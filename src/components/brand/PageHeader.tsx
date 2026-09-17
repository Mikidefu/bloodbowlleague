'use client';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ART } from '@/lib/art';
import { useArt } from '@/lib/useArt';
import Emblem from './Emblem';
import styles from './PageHeader.module.css';

type PageHeaderProps = {
  title: string;
  kicker?: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  tone?: 'blood' | 'slate' | 'navy';
  /** Illustrazione scontornata a destra; di default si sceglie in base alla sezione */
  art?: string | null;
};

// Illustrazione di default per sezione (vedi docs/MIDJOURNEY.md)
function artForPath(pathname: string): string | undefined {
  if (/^\/schedule\/[^/]+/.test(pathname)) return ART.headers.match;
  const section = pathname.split('/')[1] as keyof typeof ART.headers;
  return ART.headers[section];
}

// Testata di pagina: fascia curva del Rulebook su scena di stadio, titolo dorato di Spike! e personaggio che "sfonda" la cornice
export default function PageHeader({ title, kicker, subtitle, icon, actions, tone = 'blood', art }: PageHeaderProps) {
  const pathname = usePathname();
  const artSrc = art === null ? undefined : art ?? artForPath(pathname);
  const hasArt = useArt(artSrc);
  const hasStadium = useArt(ART.stadium);

  return (
    <header className={`${styles.header} ${styles[tone]} ${hasArt ? styles.withArt : ''}`}>
      <div className={styles.trim} aria-hidden="true" />
      <div
        className={`${styles.bg} ${hasStadium ? styles.bgPhoto : ''}`}
        style={hasStadium ? { ['--stadium' as string]: `url(${ART.stadium})` } : undefined}
        aria-hidden="true"
      >
        {!hasArt && <Emblem size={220} className={styles.watermark} useCrestArt={false} />}
      </div>

      {hasArt && artSrc && (
         
        <img src={artSrc} alt="" className={styles.art} aria-hidden="true" />
      )}

      <div className={styles.inner}>
        <div className={styles.titles}>
          {kicker && <span className={styles.kicker}>{kicker}</span>}
          <h1 className={styles.title}>
            {icon && <span className={styles.icon} aria-hidden="true">{icon}</span>}
            <span className={styles.titleText}>{title}</span>
          </h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </header>
  );
}
