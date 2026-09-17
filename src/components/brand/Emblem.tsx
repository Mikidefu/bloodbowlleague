'use client';
import { useId } from 'react';
import { ART } from '@/lib/art';
import { useArt } from '@/lib/useArt';

type EmblemProps = {
  size?: number;
  topText?: string;
  bottomText?: string;
  initials?: [string, string];
  className?: string;
  /** Usa l'illustrazione Midjourney al centro se presente in public/art (default true) */
  useCrestArt?: boolean;
};

// Punte dell'anello e rivetti: calcolati una volta sola
const SPIKES = 16;
const spikePoints = Array.from({ length: SPIKES * 2 }, (_, i) => {
  const angle = (Math.PI * i) / SPIKES - Math.PI / 2;
  const radius = i % 2 ? 150 : 196;
  return `${(200 + radius * Math.cos(angle)).toFixed(1)},${(200 + radius * Math.sin(angle)).toFixed(1)}`;
}).join(' ');

const rivets = Array.from({ length: SPIKES }, (_, i) => {
  const angle = (Math.PI * 2 * i) / SPIKES - Math.PI / 2 + Math.PI / SPIKES;
  return { cx: 200 + 162 * Math.cos(angle), cy: 200 + 162 * Math.sin(angle) };
});

// Stemma della lega: anello chiodato in ottone, fascia con scritte e cuore illustrato o vettoriale
export default function Emblem({
  size = 160,
  topText = 'BLOOD BOWL',
  bottomText = 'LEAGUE',
  initials = ['B', 'L'],
  className,
  useCrestArt = true,
}: EmblemProps) {
  const id = useId().replace(/:/g, '');
  const hasCrest = useArt(useCrestArt ? ART.crest : undefined);
  const letter = {
    fontFamily: 'var(--font-slab)',
    fontWeight: 900,
    fontSize: 92,
    paintOrder: 'stroke' as const,
  };

  return (
    <svg
      viewBox="0 0 400 400"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={`${topText} ${bottomText}`}
    >
      <defs>
        <path id={`${id}-top`} d="M 78 200 A 122 122 0 0 1 322 200" />
        <path id={`${id}-bottom`} d="M 88 200 A 112 112 0 0 0 312 200" />
        <clipPath id={`${id}-core`}>
          <circle cx="200" cy="200" r="100" />
        </clipPath>
        <linearGradient id={`${id}-brass`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f7e2ab" />
          <stop offset="0.3" stopColor="#b8893f" />
          <stop offset="0.5" stopColor="#f3d897" />
          <stop offset="0.75" stopColor="#8d6831" />
          <stop offset="1" stopColor="#d9b268" />
        </linearGradient>
        <linearGradient id={`${id}-navy`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3d58a8" />
          <stop offset="0.55" stopColor="#25386f" />
          <stop offset="1" stopColor="#141f40" />
        </linearGradient>
        <radialGradient id={`${id}-paper`} cx="0.5" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#fbf4e4" />
          <stop offset="1" stopColor="#dccaa6" />
        </radialGradient>
        <radialGradient id={`${id}-ball`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ef5a4c" />
          <stop offset="0.6" stopColor="#c8252c" />
          <stop offset="1" stopColor="#7a1a1c" />
        </radialGradient>
        <radialGradient id={`${id}-shade`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.7" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </radialGradient>
      </defs>

      {/* Anello chiodato */}
      <polygon points={spikePoints} fill={`url(#${id}-navy)`} stroke="#0f1834" strokeWidth="5" strokeLinejoin="round" />
      <circle cx="200" cy="200" r="176" fill="none" stroke={`url(#${id}-brass)`} strokeWidth="10" />
      {rivets.map((r, i) => (
        <g key={i}>
          <circle cx={r.cx} cy={r.cy} r="5.5" fill="#6b4d22" />
          <circle cx={r.cx - 1} cy={r.cy - 1} r="3.5" fill="#f7e2ab" />
        </g>
      ))}

      {/* Fascia con le scritte */}
      <circle cx="200" cy="200" r="150" fill={`url(#${id}-paper)`} stroke="#0f1834" strokeWidth="5" />
      <circle cx="200" cy="200" r="143" fill="none" stroke={`url(#${id}-brass)`} strokeWidth="3" />
      <circle cx="200" cy="200" r="108" fill={`url(#${id}-brass)`} />
      <circle cx="200" cy="200" r="102" fill={`url(#${id}-navy)`} />

      <text fill="#1a2852" fontFamily="var(--font-display)" fontWeight={800} fontSize="38" letterSpacing="4">
        <textPath href={`#${id}-top`} startOffset="50%" textAnchor="middle">{`★ ${topText} ★`}</textPath>
      </text>
      <text fill="#a51f25" fontFamily="var(--font-display)" fontWeight={800} fontSize="38" letterSpacing="6" dominantBaseline="hanging">
        <textPath href={`#${id}-bottom`} startOffset="50%" textAnchor="middle">{bottomText}</textPath>
      </text>

      {/* Cuore: illustrazione Midjourney oppure pallone vettoriale con iniziali */}
      <g clipPath={`url(#${id}-core)`}>
        {hasCrest ? (
          <image href={ART.crest} x="96" y="96" width="208" height="208" preserveAspectRatio="xMidYMid slice" />
        ) : (
          <>
            <ellipse cx="200" cy="200" rx="66" ry="104" transform="rotate(45 200 200)" fill={`url(#${id}-ball)`} stroke="#efe5d2" strokeWidth="8" />
            <path d="M 110 290 L 290 110" stroke="#efe5d2" strokeWidth="12" />
            <path d="M 150 150 L 250 250" stroke="#efe5d2" strokeWidth="5" />
          </>
        )}
        <circle cx="200" cy="200" r="100" fill={`url(#${id}-shade)`} />
      </g>

      {!hasCrest && (
        <>
          <text x="156" y="196" textAnchor="middle" fill="#fbf4e4" stroke="#0f1834" strokeWidth="14" strokeLinejoin="round" style={letter}>
            {initials[0]}
          </text>
          <text x="246" y="286" textAnchor="middle" fill="#fbf4e4" stroke="#0f1834" strokeWidth="14" strokeLinejoin="round" style={letter}>
            {initials[1]}
          </text>
        </>
      )}

      {/* Riflesso superiore */}
      <path d="M 70 150 A 140 140 0 0 1 330 150" fill="none" stroke="#fff" strokeOpacity="0.18" strokeWidth="14" strokeLinecap="round" />
    </svg>
  );
}
