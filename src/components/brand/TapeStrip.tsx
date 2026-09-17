import type { ReactNode } from 'react';
import styles from './Deco.module.css';

type TapeStripProps = {
  items?: ReactNode[];
  text?: string;
  tone?: 'mustard' | 'red' | 'ink';
  angle?: number;
  moving?: boolean;
  reverse?: boolean;
  className?: string;
  label?: string;
};

// Nastro "da cantiere" in diagonale con testo ripetuto (scorrevole o fermo)
export default function TapeStrip({
  items,
  text = 'BLOOD BOWL LEAGUE',
  tone = 'mustard',
  angle = -3,
  moving = true,
  reverse = false,
  className = '',
  label,
}: TapeStripProps) {
  const content = items && items.length > 0 ? items : Array.from({ length: 8 }, () => text);

  return (
    <div
      className={`${styles.tape} ${styles[`tape_${tone}`]} ${className}`}
      style={{ ['--tape-angle' as string]: `${angle}deg` }}
      role={label ? 'region' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <div className={`${styles.tapeTrack} ${moving ? styles.tapeMoving : ''} ${reverse ? styles.tapeReverse : ''}`}>
        {[0, 1].map(copy => (
          <ul key={copy} className={styles.tapeList} aria-hidden={copy === 1 ? true : undefined}>
            {content.map((item, i) => (
              <li key={`${copy}-${i}`} className={styles.tapeItem}>
                {item}
                <span className={styles.tapeSep} aria-hidden="true">✦</span>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
