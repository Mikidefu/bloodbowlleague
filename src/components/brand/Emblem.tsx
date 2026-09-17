import { ART } from '@/lib/art';
import styles from './Emblem.module.css';

type EmblemProps = {
  size?: number;
  className?: string;
  alt?: string;
};

// Logo della lega: solo illustrazione (public/art/logo.webp, vedi docs/MIDJOURNEY.md)
export default function Emblem({ size = 160, className = '', alt = 'Blood Bowl League' }: EmblemProps) {
  return (
    <img
      src={ART.logo}
      alt={alt}
      width={size}
      height={size}
      className={`${styles.emblem} ${className}`}
      draggable={false}
    />
  );
}
