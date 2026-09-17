'use client';
import { ART } from '@/lib/art';
import { useArt } from '@/lib/useArt';
import styles from './Emblem.module.css';

type EmblemProps = {
  size?: number;
  className?: string;
  alt?: string;
};

// Logo della lega: solo illustrazione (public/art/logo.webp, vedi docs/MIDJOURNEY.md).
// Finché il logo nuovo non c'è si usa il vecchio cuore dello stemma come segnaposto.
export default function Emblem({ size = 160, className = '', alt = 'Blood Bowl League' }: EmblemProps) {
  const hasLogo = useArt(ART.logo);
  const src = hasLogo ? ART.logo : ART.crest;

  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={`${styles.emblem} ${className}`}
      draggable={false}
    />
  );
}
