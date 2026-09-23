'use client';
// Partita dal vivo lato client, uguale per il web dell'admin e per il companion.
//
// - Polling con cursore: si chiedono solo gli eventi dopo l'ultimo seq; se ne manca uno si ricarica tutto.
// - Le scritture passano da una coda: ogni evento ha il suo UUID, quindi rimandarlo dopo un errore di rete
//   non lo duplica. Col companion la coda sta anche in localStorage e sopravvive a una pagina ricaricata.
// - Lo stato si calcola qui con lo stesso reducer del server, eventi in coda compresi: il tabellone
//   risponde subito al tocco, e appena il server conferma i numeri sono gli stessi.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LiveProblem } from './errors';
import type { ManualKickoffDice } from './kickoff';
import { reduceLive } from './reduce';
import type { LiveEvent, LiveEventType } from './types';

export type LiveInfo = { status: 'live' | 'ended'; paired: Record<string, boolean>; join_code?: string };
export type PendingEvent = { id: string; type: LiveEventType; team_id: string | null; payload: Record<string, unknown> };
export type LiveLoad = 'loading' | 'ready' | 'not_started';

type Options = {
  matchId: string;
  token?: string | null;               // companion: token di squadra; l'admin usa il cookie di sessione
  queueKey?: string | null;            // chiave localStorage della coda (companion)
  pollMs?: number;
  onNewEvents?: (events: LiveEvent[]) => void;   // eventi arrivati da altri dispositivi dopo il primo caricamento
  onUnauthorized?: () => void;                   // token scaduto o telefono scollegato
};

type Snapshot = { live: LiveInfo | null; seq: number; events: LiveEvent[]; me?: string | null };

const MAX_BATCH = 50;
const HIDDEN_POLL_MS = 15000;

// crypto.randomUUID esiste solo in https/localhost: il telefono in rete locale (http://192.168...) usa il fallback
export function newEventId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function readQueue(key: string | null | undefined): PendingEvent[] {
  if (!key) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(key: string | null | undefined, queue: PendingEvent[]) {
  if (!key) return;
  try {
    if (queue.length) localStorage.setItem(key, JSON.stringify(queue));
    else localStorage.removeItem(key);
  } catch { /* storage non disponibile: la coda resta in memoria */ }
}

class HttpError extends Error {
  status: number;
  problem: LiveProblem;
  constructor(status: number, problem: LiveProblem) {
    super(problem.message);
    this.status = status;
    this.problem = problem;
  }
}

export function useLiveMatch({ matchId, token, queueKey, pollMs = 2000, onNewEvents, onUnauthorized }: Options) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [live, setLive] = useState<LiveInfo | null>(null);
  const [load, setLoad] = useState<LiveLoad>('loading');
  const [pending, setPending] = useState<PendingEvent[]>([]);
  const [offline, setOffline] = useState(false);
  const [errors, setErrors] = useState<LiveProblem[]>([]);
  const [me, setMe] = useState<string | null | undefined>(undefined);   // chi legge secondo il server (vedi GET)

  const eventsRef = useRef<LiveEvent[]>([]);
  const pendingRef = useRef<PendingEvent[]>([]);
  const mine = useRef(new Set<string>());
  const busy = useRef<Promise<void> | null>(null);
  const loaded = useRef(false);
  const callbacks = useRef({ onNewEvents, onUnauthorized });
  useEffect(() => { callbacks.current = { onNewEvents, onUnauthorized }; });

  // La coda salvata (companion) si riprende al montaggio
  useEffect(() => {
    const saved = readQueue(queueKey);
    for (const e of saved) mine.current.add(e.id);
    pendingRef.current = saved;
    setPending(saved);
  }, [queueKey]);

  const setQueue = useCallback((queue: PendingEvent[]) => {
    pendingRef.current = queue;
    setPending(queue);
    writeQueue(queueKey, queue);
  }, [queueKey]);

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (init.body) headers.set('content-type', 'application/json');
    if (token) headers.set('authorization', `Bearer ${token}`);
    const res = await fetch(`/api/live/${matchId}${path}`, { ...init, headers, cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new HttpError(res.status, { code: json.code, message: json.error ?? `HTTP ${res.status}`, params: json.params });
    return json;
  }, [matchId, token]);

  // Unisce gli eventi nuovi; false se manca un pezzo (bisogna ricaricare da zero)
  const apply = useCallback((snap: Snapshot, since: number) => {
    if (snap.me !== undefined) setMe(snap.me);
    if (!snap.live) {   // non ancora avviata (o azzerata)
      eventsRef.current = [];
      setEvents([]);
      setLive(null);
      setLoad('not_started');
      return true;
    }
    const base = since === 0 ? [] : eventsRef.current;
    const last = base.length ? base[base.length - 1].seq : 0;
    const incoming = (snap.events ?? []).filter(e => e.seq > last).sort((a, b) => a.seq - b.seq);
    if (since > 0 && incoming.length && incoming[0].seq !== last + 1) return false;
    const fresh = since === 0 ? incoming.filter(e => !eventsRef.current.some(o => o.id === e.id)) : incoming;
    const merged = [...base, ...incoming];
    eventsRef.current = merged;
    setEvents(merged);
    setLive(snap.live);
    setLoad('ready');
    const others = fresh.filter(e => !mine.current.has(e.id) && !mine.current.has(String(e.payload?.cause ?? '')));
    if (loaded.current && others.length) callbacks.current.onNewEvents?.(others);
    loaded.current = true;
    return true;
  }, []);

  const handleError = useCallback((error: unknown) => {
    if (error instanceof HttpError) {
      setOffline(false);
      if (error.status === 401 && callbacks.current.onUnauthorized) { callbacks.current.onUnauthorized(); return; }
      setErrors(list => [...list, error.problem]);
      return;
    }
    setOffline(true);   // rete assente: si riprova al prossimo giro
  }, []);

  const lastSeq = () => (eventsRef.current.length ? eventsRef.current[eventsRef.current.length - 1].seq : 0);

  // Un giro di sincronizzazione: prima si svuota la coda, poi si leggono gli eventi nuovi. Mai due giri insieme.
  const sync = useCallback((): Promise<void> => {
    if (busy.current) return busy.current;
    const run = async () => {
      try {
        const since = lastSeq();
        const batch = pendingRef.current.slice(0, MAX_BATCH);
        let snap: Snapshot & { results?: { id: string; status: string; error?: string; code?: string; params?: Record<string, string | number> }[] };
        if (batch.length) {
          try {
            snap = await request(`/events?since=${since}`, { method: 'POST', body: JSON.stringify({ events: batch }) });
          } catch (error) {
            // Lotto rifiutato per intero per un motivo che non cambierà (partita chiusa, referto salvato...):
            // riprovare all'infinito non serve, si scarta e si dice perché. 401 (scollegato) e 5xx si riprovano.
            if (error instanceof HttpError && error.status >= 400 && error.status < 500 && ![401, 408, 429].includes(error.status)) {
              const dropped = new Set(batch.map(e => e.id));
              setQueue(pendingRef.current.filter(e => !dropped.has(e.id)));
            }
            throw error;
          }
          const done = new Set((snap.results ?? []).map(r => r.id));
          const rejected = (snap.results ?? []).filter(r => r.status === 'rejected');
          if (rejected.length) setErrors(list => [...list, ...rejected.map(r => ({ code: r.code, message: r.error ?? 'Rejected', params: r.params }))]);
          setQueue(pendingRef.current.filter(e => !done.has(e.id)));
        } else {
          snap = await request(`?since=${since}`);
        }
        if (!apply(snap, since)) apply(await request('?since=0'), 0);
        setOffline(false);
      } catch (error) {
        handleError(error);
      } finally {
        busy.current = null;
      }
    };
    busy.current = run();
    return busy.current;
  }, [apply, handleError, request, setQueue]);

  // Il primo caricamento c'è sempre; poi polling veloce con la pagina in vista, lento in background.
  // Al ritorno in primo piano (o quando torna la rete) si sincronizza subito.
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let chain = 0;   // un solo ciclo attivo: svegliarlo ne avvia uno nuovo e fa decadere il vecchio
    const loop = async (id: number) => {
      if (stopped || id !== chain) return;
      await sync();
      if (!stopped && id === chain) timer = setTimeout(() => loop(id), document.visibilityState === 'visible' ? pollMs : HIDDEN_POLL_MS);
    };
    const restart = () => { clearTimeout(timer); void loop(++chain); };
    const wake = () => { if (document.visibilityState === 'visible') restart(); };
    restart();
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', restart);   // torna la rete: la coda parte subito, anche in background
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', restart);
    };
  }, [sync, pollMs]);

  const send = useCallback((type: LiveEventType, teamId: string | null, payload: Record<string, unknown> = {}) => {
    const event: PendingEvent = { id: newEventId(), type, team_id: teamId, payload };
    mine.current.add(event.id);
    setQueue([...pendingRef.current, event]);
    void sync();
    return event.id;
  }, [setQueue, sync]);

  // Azioni che non passano dalla coda (servono subito il server): prima si svuota la coda, poi si ricarica tutto
  const action = useCallback(async (path: string, init: RequestInit) => {
    await sync();
    try {
      const json = await request(path, init);
      if (json && Array.isArray(json.events)) apply(json, 0);
      else await sync();
      return json;
    } catch (error) {
      handleError(error);
      return null;
    }
  }, [apply, handleError, request, sync]);

  const kickoff = useCallback(async (manual?: ManualKickoffDice) => {
    const id = newEventId();
    mine.current.add(id);
    const json = await action('/kickoff?since=0', { method: 'POST', body: JSON.stringify({ id, manual }) });
    return (json?.status as 'ok' | 'duplicate' | undefined) ?? null;
  }, [action]);

  const post = (path: string, body: unknown = {}) => action(path, { method: 'POST', body: JSON.stringify(body) });

  // Tabellone: eventi confermati + quelli in coda, in ordine
  const state = useMemo(() => {
    let seq = events.length ? events[events.length - 1].seq : 0;
    const provisional: LiveEvent[] = pending.map(e => ({ ...e, seq: ++seq, source: token ? 'companion' : 'admin' }));
    return reduceLive([...events, ...provisional]);
  }, [events, pending, token]);

  return {
    live, events, state, load, offline, errors, me,
    pending: pending.length,
    dismissErrors: () => setErrors([]),
    refresh: sync,
    send,
    kickoff,
    start: () => post('/start'),
    end: () => post('/end'),
    unpair: (teamId: string) => post('/unpair', { team_id: teamId }),
    leave: () => post('/leave'),
    reset: () => action('', { method: 'DELETE' }),
  };
}
