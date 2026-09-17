import { useId } from 'react';

type EmblemProps = {
  size?: number;
  topText?: string;
  bottomText?: string;
  initials?: [string, string];
  className?: string;
};

// Punte dell'anello: poligono a stella calcolato una volta sola
const SPIKES = 16;
const spikePoints = Array.from({ length: SPIKES * 2 }, (_, i) => {
  const angle = (Math.PI * i) / SPIKES - Math.PI / 2;
  const radius = i % 2 ? 150 : 196;
  return `${(200 + radius * Math.cos(angle)).toFixed(1)},${(200 + radius * Math.sin(angle)).toFixed(1)}`;
}).join(' ');

// Stemma della lega: anello chiodato, fascia con scritte e pallone con iniziali (asset originale)
export default function Emblem({
  size = 160,
  topText = 'BLOOD BOWL',
  bottomText = 'LEAGUE',
  initials = ['B', 'L'],
  className,
}: EmblemProps) {
  const id = useId().replace(/:/g, '');
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
      </defs>

      <polygon points={spikePoints} fill="#25386f" stroke="#1a2852" strokeWidth="4" strokeLinejoin="round" />
      <circle cx="200" cy="200" r="150" fill="#efe5d2" stroke="#1a2852" strokeWidth="5" />
      <circle cx="200" cy="200" r="104" fill="#25386f" />

      <text fill="#25386f" fontFamily="var(--font-display)" fontWeight={800} fontSize="38" letterSpacing="4">
        <textPath href={`#${id}-top`} startOffset="50%" textAnchor="middle">{`★ ${topText} ★`}</textPath>
      </text>
      <text fill="#c8252c" fontFamily="var(--font-display)" fontWeight={800} fontSize="38" letterSpacing="6" dominantBaseline="hanging">
        <textPath href={`#${id}-bottom`} startOffset="50%" textAnchor="middle">{bottomText}</textPath>
      </text>

      <g clipPath={`url(#${id}-core)`}>
        <ellipse cx="200" cy="200" rx="66" ry="104" transform="rotate(45 200 200)" fill="#c8252c" stroke="#efe5d2" strokeWidth="8" />
        <path d="M 110 290 L 290 110" stroke="#efe5d2" strokeWidth="12" />
        <path d="M 150 150 L 250 250" stroke="#efe5d2" strokeWidth="5" />
      </g>

      <text x="156" y="196" textAnchor="middle" fill="#efe5d2" stroke="#1a2852" strokeWidth="14" strokeLinejoin="round" style={letter}>
        {initials[0]}
      </text>
      <text x="246" y="286" textAnchor="middle" fill="#efe5d2" stroke="#1a2852" strokeWidth="14" strokeLinejoin="round" style={letter}>
        {initials[1]}
      </text>
    </svg>
  );
}
