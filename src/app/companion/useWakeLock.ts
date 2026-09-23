'use client';
// Schermo sempre acceso durante la partita (Screen Wake Lock API: Chrome Android, Safari iOS 16.4+).
// Il sistema lo toglie quando la pagina va in background: si richiede di nuovo al ritorno.

import { useEffect, useState } from 'react';

type Sentinel = { release: () => Promise<void> };
type WakeLockNav = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<Sentinel> } };

export function useWakeLock(enabled: boolean) {
  const [active, setActive] = useState(false);
  const supported = typeof navigator !== 'undefined' && !!(navigator as WakeLockNav).wakeLock;

  useEffect(() => {
    if (!enabled || !supported) return;
    let sentinel: Sentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        sentinel = await (navigator as WakeLockNav).wakeLock!.request('screen');
        if (cancelled) { void sentinel.release(); return; }
        setActive(true);
      } catch {
        setActive(false);   // negato (batteria scarica, risparmio energetico): lo schermo si spegne come sempre
      }
    };
    void acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', acquire);
      void sentinel?.release();
      setActive(false);
    };
  }, [enabled, supported]);

  return { supported, active };
}
