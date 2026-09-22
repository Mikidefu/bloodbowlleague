'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './InfoTip.module.css';

type Props = {
  text: ReactNode;
  label?: string;        // per gli screen reader: "Cosa significa <label>"
  children?: ReactNode;  // se c'è, è il testo stesso a mostrare il suggerimento; altrimenti un "?"
};

const WIDTH = 300;
const GAP = 8;

/** Suggerimento al passaggio del mouse (o al tocco / focus da tastiera).
 *  Il fumetto va nel body: così non lo tagliano tabelle scorrevoli o angoli smussati. */
export default function InfoTip({ text, label, children }: Props) {
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; below: boolean } | null>(null);

  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(WIDTH, window.innerWidth - 2 * GAP);
    const left = Math.min(Math.max(GAP, r.left + r.width / 2 - width / 2), window.innerWidth - width - GAP);
    const below = r.top < 140;
    setPos({ left, top: below ? r.bottom + GAP : r.top - GAP, below });
  };
  const hide = () => setPos(null);

  // Chiusura con Esc e allo scorrimento (il fumetto è fisso e resterebbe indietro)
  useEffect(() => {
    if (!pos) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', hide, true);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('scroll', hide, true); };
  }, [pos]);

  const common = {
    ref,
    tabIndex: 0,
    'aria-describedby': pos ? id : undefined,
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
    onClick: (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); if (pos) hide(); else show(); },
  };

  return (
      <>
        {children ? (
            <span {...common} className={styles.term}>{children}</span>
        ) : (
            <span {...common} role="button" aria-label={label ? `? ${label}` : '?'} className={styles.dot}>?</span>
        )}
        {pos && typeof document !== 'undefined' && createPortal(
            <span id={id} role="tooltip" className={`${styles.bubble} ${pos.below ? styles.below : ''}`}
                  style={{ left: pos.left, top: pos.top, width: Math.min(WIDTH, window.innerWidth - 2 * GAP) }}>
              {label && <strong className={styles.bubbleTitle}>{label}</strong>}
              {text}
            </span>,
            document.body,
        )}
      </>
  );
}
