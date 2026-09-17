import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

type PageHeaderProps = {
  title: string;
  kicker?: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  tone?: 'blood' | 'slate' | 'navy';
};

// Testata di pagina: fascia rossa col bordo curvo del Rulebook e titolo corsivo giallo di Spike!
export default function PageHeader({ title, kicker, subtitle, icon, actions, tone = 'blood' }: PageHeaderProps) {
  return (
    <header className={`${styles.header} ${styles[tone]}`}>
      <div className={styles.inner}>
        <div className={styles.titles}>
          {kicker && <span className={styles.kicker}>{kicker}</span>}
          <h1 className={styles.title}>
            {icon && <span className={styles.icon} aria-hidden="true">{icon}</span>}
            <span>{title}</span>
          </h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </header>
  );
}
