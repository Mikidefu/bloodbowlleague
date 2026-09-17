'use client';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ART } from '@/lib/art';
import { useArt } from '@/lib/useArt';
import { useSeason } from '@/lib/SeasonContext';
import Emblem from './Emblem';
import Shards from './Shards';
import TapeStrip from './TapeStrip';
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

// Numero e sigla di ogni sezione (come i capitoli numerati di una rivista)
const SECTIONS: Record<string, { index: string; code: string }> = {
  teams: { index: '01', code: 'Teams' },
  schedule: { index: '02', code: 'Fixtures' },
  standings: { index: '03', code: 'Standings' },
  stats: { index: '04', code: 'Hall of fame' },
  coaches: { index: '05', code: 'Coaches' },
  skills: { index: '06', code: 'Playbook' },
  seasons: { index: '07', code: 'Seasons' },
  login: { index: '00', code: 'Locker room' },
  brand: { index: '99', code: 'Brand kit' },
};

function artForPath(pathname: string): string | undefined {
  if (/^\/schedule\/[^/]+/.test(pathname)) return ART.headers.match;
  const section = pathname.split('/')[1] as keyof typeof ART.headers;
  return ART.headers[section];
}

// Testata di pagina: sagoma spigolosa su scena di stadio, schegge, numero di sezione e personaggio che sfonda la cornice
export default function PageHeader({ title, kicker, subtitle, icon, actions, tone = 'blood', art }: PageHeaderProps) {
  const pathname = usePathname();
  const { selectedSeason } = useSeason();
  const artSrc = art === null ? undefined : art ?? artForPath(pathname);
  const hasArt = useArt(artSrc);
  const hasStadium = useArt(ART.stadium);

  const sectionKey = pathname.split('/')[1] ?? '';
  const section = SECTIONS[sectionKey];
  const seasonCode = `S${String(selectedSeason?.number ?? 1).padStart(2, '0')}`;
  const isDetail = pathname.split('/').filter(Boolean).length > 1;

  return (
    <header className={`${styles.header} ${styles[tone] ?? ''} ${hasArt ? styles.withArt : ''}`}>
      <div className={styles.trim} aria-hidden="true" />
      <div
        className={`${styles.bg} ${hasStadium ? styles.bgPhoto : ''}`}
        style={hasStadium ? { ['--stadium' as string]: `url(${ART.stadium})` } : undefined}
        aria-hidden="true"
      >
        <Shards variant="header" />
        <span className={styles.ghost}>{title}</span>
        {!hasArt && <Emblem size={220} className={styles.watermark} useCrestArt={false} />}
      </div>

      {hasArt && artSrc && <img src={artSrc} alt="" className={styles.art} aria-hidden="true" />}

      <div className={styles.inner}>
        <div className={styles.titles}>
          <div className={styles.micro}>
            {icon && <span className={styles.icon} aria-hidden="true">{icon}</span>}
            <i className={styles.microSquares} aria-hidden="true" />
            <span>{`BBL // ${seasonCode}${section ? ` // ${section.code}` : ''}${isDetail ? ' // Detail' : ''}`}</span>
          </div>
          {kicker && <span className={styles.kicker}>{kicker}</span>}
          <h1 className={styles.title}>
            {section && !isDetail && <span className={styles.index} aria-hidden="true">{section.index}</span>}
            <span className={styles.titleText}>{title}</span>
          </h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>

      <div className={styles.tapeWrap} aria-hidden="true">
        <TapeStrip tone="ink" angle={-2} fit items={['Blood Bowl League', title]} />
      </div>
    </header>
  );
}
