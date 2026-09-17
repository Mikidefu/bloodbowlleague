import type { ReactNode } from 'react';
import styles from './Deco.module.css';

type HotspotProps = {
  /** Posizione del punto in percentuale sul contenitore */
  x: number;
  y: number;
  /** Direzione e lunghezza (px) della linea tratteggiata verso l'etichetta */
  side?: 'left' | 'right';
  length?: number;
  rise?: number;
  children: ReactNode;
};

// Punto caldo pulsante con linea tratteggiata e cartellino (stile scheda prodotto)
export default function Hotspot({ x, y, side = 'right', length = 120, rise = -40, children }: HotspotProps) {
  return (
    <div
      className={`${styles.hotspot} ${side === 'left' ? styles.hotspotLeft : ''}`}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        ['--hs-length' as string]: `${length}px`,
        ['--hs-rise' as string]: `${rise}px`,
      }}
    >
      <span className={styles.hotspotDot} aria-hidden="true" />
      <svg className={styles.hotspotLine} aria-hidden="true" focusable="false">
        <line x1="0" y1="100%" x2="100%" y2="0" />
      </svg>
      <div className={styles.hotspotCard}>{children}</div>
    </div>
  );
}
