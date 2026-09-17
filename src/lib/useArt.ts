'use client';
import { useSyncExternalStore } from 'react';

// Stato di caricamento condiviso per ogni immagine: 'ok' | 'missing' (assente finché non è verificata)
const status = new Map<string, 'ok' | 'missing'>();
const listeners = new Set<() => void>();

function probe(src: string) {
  if (status.has(src) || typeof window === 'undefined') return;
  const img = new Image();
  img.onload = () => { status.set(src, 'ok'); listeners.forEach(fn => fn()); };
  img.onerror = () => { status.set(src, 'missing'); listeners.forEach(fn => fn()); };
  img.src = src;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// true solo quando l'illustrazione esiste davvero: evita icone rotte e salti di layout
export function useArt(src?: string) {
  return useSyncExternalStore(
    subscribe,
    () => {
      if (!src) return false;
      probe(src);
      return status.get(src) === 'ok';
    },
    () => false,
  );
}
