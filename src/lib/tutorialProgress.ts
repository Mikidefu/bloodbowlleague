'use client';
import { useCallback, useSyncExternalStore } from 'react';

// Avanzamento del tutorial: vive nel browser di chi legge, non sul server.
// pills: id "percorso/pillola" già letti · quiz: percorsi con il quiz superato.
// Come per la lingua (vedi i18n/LanguageContext), si usa useSyncExternalStore:
// niente setState dentro un effect e nessun disallineamento con l'idratazione.

const STORAGE_KEY = 'bbl-tutorial';
const CHANGE_EVENT = 'bbl-tutorial-change';

export type Progress = { pills: string[]; quiz: string[] };

const EMPTY: Progress = { pills: [], quiz: [] };

// Copia in memoria: è anche lo snapshot stabile richiesto da useSyncExternalStore
let cache: Progress = EMPTY;
let cacheRaw: string | null = null;

function parse(raw: string | null): Progress {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as Partial<Progress>;
    return { pills: parsed.pills ?? [], quiz: parsed.quiz ?? [] };
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): Progress {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return cache;   // navigazione privata: resta quello che abbiamo in memoria
  }
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    cache = parse(raw);
  }
  return cache;
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);   // altre schede
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

function save(next: Progress) {
  cache = next;
  cacheRaw = JSON.stringify(next);
  try {
    localStorage.setItem(STORAGE_KEY, cacheRaw);
  } catch {
    // storage pieno o bloccato: l'avanzamento vale solo per questa visita
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useTutorialProgress() {
  const progress = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);

  const markPill = useCallback((trackId: string, pillId: string) => {
    const key = `${trackId}/${pillId}`;
    const current = getSnapshot();
    if (!current.pills.includes(key)) save({ ...current, pills: [...current.pills, key] });
  }, []);

  const markQuiz = useCallback((trackId: string) => {
    const current = getSnapshot();
    if (!current.quiz.includes(trackId)) save({ ...current, quiz: [...current.quiz, trackId] });
  }, []);

  const reset = useCallback(() => save(EMPTY), []);

  const isPillRead = useCallback((trackId: string, pillId: string) => progress.pills.includes(`${trackId}/${pillId}`), [progress]);
  const readCount = useCallback((trackId: string) => progress.pills.filter(p => p.startsWith(`${trackId}/`)).length, [progress]);
  const isQuizDone = useCallback((trackId: string) => progress.quiz.includes(trackId), [progress]);

  return { progress, markPill, markQuiz, reset, isPillRead, readCount, isQuizDone };
}
