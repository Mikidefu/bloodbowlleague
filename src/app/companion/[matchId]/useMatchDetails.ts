'use client';
// Nomi, colori, giocatori e Prayers della partita. A bordo campo la rete va e viene: se la lettura
// fallisce si riprova (sempre più di rado) e subito quando torna la rete, invece di restare senza nomi
// per tutta la partita. Una risposta d'errore non diventa mai "la partita".

import { useEffect, useState } from 'react';
import type { MatchDetails } from '@/lib/types';

const FIRST_RETRY_MS = 2000;
const MAX_RETRY_MS = 30000;

const isMatch = (value: unknown): value is MatchDetails => {
  const m = value as Partial<MatchDetails> | null;
  return !!m && Array.isArray(m.homePlayers) && Array.isArray(m.awayPlayers) && Array.isArray(m.reports);
};

export function useMatchDetails(matchId: string) {
  const [match, setMatch] = useState<MatchDetails | null>(null);

  useEffect(() => {
    let stopped = false;
    let done = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      clearTimeout(timer);
      try {
        const res = await fetch(`/api/schedule/${matchId}`, { cache: 'no-store' });
        const json: unknown = res.ok ? await res.json() : null;
        if (stopped) return;
        if (isMatch(json)) { done = true; setMatch(json); return; }
        if (res.status === 404) { done = true; return; }   // partita cancellata: riprovare non serve
      } catch { /* rete assente: si riprova sotto */ }
      if (!stopped) timer = setTimeout(load, Math.min(MAX_RETRY_MS, FIRST_RETRY_MS * 2 ** attempt++));
    };
    const onOnline = () => { if (!done) { attempt = 0; void load(); } };

    void load();
    window.addEventListener('online', onOnline);
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener('online', onOnline);
    };
  }, [matchId]);

  return match;
}
