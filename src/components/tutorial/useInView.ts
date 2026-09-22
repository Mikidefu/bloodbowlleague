'use client';
import { useEffect, useRef, useState } from 'react';

/** Dice se l'elemento è mai entrato sullo schermo: le animazioni dei diagrammi
 *  partono lì, una volta sola, invece che al caricamento della pagina. */
export function useInView<T extends Element>(threshold = 0.35) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setSeen(true);
      io.disconnect();   // visto una volta basta
    }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return { ref, seen };
}
