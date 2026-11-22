import type { ReactNode } from 'react';
import styles from './Deco.module.css';
import FitName from '@/components/FitName';

type SectionTitleProps = {
  index?: string;
  title: string;
  micro?: string;
  on?: 'dark' | 'light';
  align?: 'left' | 'right';
  action?: ReactNode;
};

// Titolo di sezione numerato: numero gigante in ottone, micro-etichetta tecnica e quadratini decorativi
export default function SectionTitle({ index, title, micro, on = 'dark', align = 'left', action }: SectionTitleProps) {
  return (
    <div className={`${styles.sectionTitle} ${styles[`on_${on}`]} ${align === 'right' ? styles.alignRight : ''}`}>
      {index && <span className={styles.sectionIndex} aria-hidden="true">{index}</span>}
      <div className={styles.sectionText}>
        {micro && (
          <span className={styles.sectionMicro}>
            <i className={styles.microSquares} aria-hidden="true" />
            {micro}
          </span>
        )}
        <h2 className={styles.sectionHeading}><FitName comfy={12}>{title}</FitName></h2>
      </div>
      {action && <div className={styles.sectionAction}>{action}</div>}
    </div>
  );
}
