import { useId } from 'react';
import styles from './Deco.module.css';

type ShardsProps = {
  variant?: 'hero' | 'band' | 'header';
  className?: string;
};

// Schegge geometriche irregolari: poligoni volutamente storti, stirati sul contenitore
export default function Shards({ variant = 'hero', className = '' }: ShardsProps) {
  const id = useId().replace(/:/g, '');

  return (
    <svg
      className={`${styles.shards} ${className}`}
      viewBox="0 0 1440 800"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}-red`} x1="0" y1="0" x2="1" y2="0.6">
          <stop offset="0" stopColor="#c8252c" />
          <stop offset="0.55" stopColor="#7a1a1c" />
          <stop offset="1" stopColor="#3a0d0f" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id={`${id}-navy`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#34509a" />
          <stop offset="0.6" stopColor="#1a2852" />
          <stop offset="1" stopColor="#0d1530" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id={`${id}-brass`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f7e2ab" />
          <stop offset="0.5" stopColor="#b8893f" />
          <stop offset="1" stopColor="#f3d897" />
        </linearGradient>
      </defs>

      {variant === 'hero' && (
        <>
          <polygon fill={`url(#${id}-navy)`} opacity="0.92" points="1440,250 1180,330 1010,300 760,470 1440,640" />
          <polygon fill={`url(#${id}-red)`} opacity="0.94" points="0,360 250,310 470,405 690,350 905,520 1110,455 1440,610 1440,800 0,800" />
          <polygon fill="#16191e" opacity="0.55" points="0,560 330,500 520,610 810,560 1030,700 1440,660 1440,800 0,800" />
          <polyline fill="none" stroke={`url(#${id}-brass)`} strokeWidth="3" vectorEffect="non-scaling-stroke" points="0,358 250,308 470,403 690,348 905,518 1110,453 1440,608" />
          <polyline fill="none" stroke="#f3d897" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="6 8" vectorEffect="non-scaling-stroke" points="1440,248 1180,328 1010,298 760,468" />
          <polygon fill="#eab22a" opacity="0.85" points="1180,330 1225,318 1100,372 1072,380" />
          <polygon fill="#efe5d2" opacity="0.6" points="240,312 262,308 205,340 190,343" />
        </>
      )}

      {variant === 'band' && (
        <>
          <polygon fill={`url(#${id}-red)`} points="0,90 310,40 540,120 860,20 1130,95 1440,0 1440,720 1180,800 820,700 520,780 210,690 0,760" />
          <polygon fill={`url(#${id}-navy)`} opacity="0.85" points="760,60 1130,95 1440,0 1440,520 1040,640" />
          <polyline fill="none" stroke={`url(#${id}-brass)`} strokeWidth="3" vectorEffect="non-scaling-stroke" points="0,90 310,40 540,120 860,20 1130,95 1440,0" />
          <polyline fill="none" stroke={`url(#${id}-brass)`} strokeWidth="2" vectorEffect="non-scaling-stroke" points="0,760 210,690 520,780 820,700 1180,800" />
          <polygon fill="#eab22a" opacity="0.8" points="860,20 905,12 840,70 818,76" />
        </>
      )}

      {variant === 'header' && (
        <>
          <polygon fill={`url(#${id}-navy)`} opacity="0.7" points="1440,0 1440,800 980,800 1150,420 1060,0" />
          <polygon fill="#16191e" opacity="0.35" points="0,560 420,470 760,640 1100,560 1440,700 1440,800 0,800" />
          <polyline fill="none" stroke={`url(#${id}-brass)`} strokeWidth="2" vectorEffect="non-scaling-stroke" points="1060,0 1150,420 980,800" />
          <polygon fill="#eab22a" opacity="0.85" points="1150,420 1166,470 1036,780 1018,790" />
        </>
      )}
    </svg>
  );
}
