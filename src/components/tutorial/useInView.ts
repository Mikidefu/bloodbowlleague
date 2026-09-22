'use client';
import { useEffect, useRef, useState } from 'react';

/** Dice se l'elemento è sullo schermo, e se lo è mai stato.
 *  `seen` serve a far partire l'animazione; `inView` a tenere il loop acceso solo
 *  sulla figura che si sta guardando, invece che su tutte e ventuno insieme. */
export function useInView<T extends Element>(threshold = 0.35) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
      if (entry.isIntersecting) setSeen(true);
    }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return { ref, inView, seen };
}

/** Il loop è movimento continuo: chi ha chiesto meno animazioni non lo deve subire.
 *  Il CSS già ferma le singole animazioni, questo ferma anche il ciclo. */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return reduced;
}
