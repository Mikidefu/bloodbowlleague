import styles from './Wordmark.module.css';

type WordmarkProps = {
  title?: string;
  ribbon?: string;
  size?: 'sm' | 'lg';
  className?: string;
};

// Logotipo testuale: lettere cesellate color argento con nastro rosso sotto
export default function Wordmark({
  title = 'Blood Bowl',
  ribbon = 'League · New Season',
  size = 'sm',
  className = '',
}: WordmarkProps) {
  return (
    <span className={`${styles.wordmark} ${styles[size]} ${className}`}>
      <span className={styles.title} data-text={title}>{title}</span>
      {ribbon && <span className={styles.ribbon}>{ribbon}</span>}
    </span>
  );
}
