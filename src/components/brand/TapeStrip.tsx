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
  /** Nastro "a misura": contenuto mostrato una sola volta, per intero, senza ripetizioni tagliate */
  fit?: boolean;
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
  fit = false,
}: TapeStripProps) {
  if (fit) {
    const parts = items && items.length > 0 ? items : [text];
    return (
      <div
        className={`${styles.tape} ${styles.tapeFit} ${styles[`tape_${tone}`]} ${className}`}
        style={{ ['--tape-angle' as string]: `${angle}deg` }}
        aria-hidden="true"
      >
        <ul className={styles.tapeList}>
          {parts.map((item, i) => (
            <li key={i} className={styles.tapeItem}>
              {i > 0 && <span className={styles.tapeSep} aria-hidden="true">✦</span>}
              {item}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const base = items && items.length > 0 ? items : [text];

  // Nastro fermo a tutta larghezza: solo ripetizioni intere, centrate (quelle che non entrano vanno a capo e restano nascoste)
  if (!moving) {
    // Il testo con ✦ viene diviso in parti, così ognuna va a capo intera invece di essere tagliata
    const parts = items && items.length > 0 ? items : text.split(" ✦ ").map(p => p.trim()).filter(Boolean);
    const repeated = Array.from({ length: 6 }, () => parts).flat();
    return (
      <div
        className={`${styles.tape} ${styles.tapeStatic} ${styles[`tape_${tone}`]} ${className}`}
        style={{ ['--tape-angle' as string]: `${angle}deg` }}
        role={label ? 'region' : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
      >
        <ul className={styles.tapeStaticList}>
          {repeated.map((item, i) => (
            <li key={i} className={styles.tapeItem} aria-hidden={i >= parts.length ? true : undefined}>
              {item}
              <span className={styles.tapeSep} aria-hidden="true">✦</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const content = Array.from({ length: Math.max(2, Math.ceil(8 / base.length)) }, () => base).flat();

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
