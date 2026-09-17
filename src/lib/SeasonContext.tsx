'use client';
import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { SeasonSummary } from '@/lib/types';

// Stagione consultata nell'interfaccia. Di default è quella attiva; la scelta resta salvata nel browser.
type SeasonContextType = {
  seasons: SeasonSummary[];
  activeSeason: SeasonSummary | null;
  selectedSeason: SeasonSummary | null;
  isViewingActive: boolean;          // true se si sta guardando la stagione in corso (modificabile)
  seasonsLoading: boolean;
  setSelectedSeasonId: (id: string | null) => void;
  refreshSeasons: () => Promise<void>;
  seasonQuery: string;               // "?season=<id>" da aggiungere alle chiamate API ("" finché non è pronto)
};

const SeasonContext = createContext<SeasonContextType | undefined>(undefined);

const STORAGE_KEY = 'bbl-season';
const CHANGE_EVENT = 'bbl-season-change';
let memorySeasonId: string | null = null;

function readSelectedId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? memorySeasonId;
  } catch {
    return memorySeasonId;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function SeasonProvider({ children }: { children: React.ReactNode }) {
  const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
  const [seasonsLoading, setSeasonsLoading] = useState(true);
  const storedId = useSyncExternalStore(subscribe, readSelectedId, () => null);

  const refreshSeasons = useCallback(async () => {
    try {
      const res = await fetch('/api/seasons');
      const data = await res.json();
      setSeasons(Array.isArray(data) ? data : []);
    } catch {
      setSeasons([]);
    } finally {
      setSeasonsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSeasons();
  }, [refreshSeasons]);

  const setSelectedSeasonId = (id: string | null) => {
    memorySeasonId = id;
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage non disponibile: resta la copia in memoria
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  const activeSeason = seasons.find(s => s.status === 'active') ?? null;
  // Una stagione salvata che non esiste più (o nessuna scelta) ripiega sulla stagione attiva
  const selectedSeason = seasons.find(s => s.id === storedId) ?? activeSeason ?? seasons[0] ?? null;
  const isViewingActive = !!selectedSeason && selectedSeason.status === 'active';
  const seasonQuery = selectedSeason ? `?season=${encodeURIComponent(selectedSeason.id)}` : '';

  return (
      <SeasonContext.Provider value={{
        seasons, activeSeason, selectedSeason, isViewingActive, seasonsLoading,
        setSelectedSeasonId, refreshSeasons, seasonQuery,
      }}>
        {children}
      </SeasonContext.Provider>
  );
}

export function useSeason() {
  const context = useContext(SeasonContext);
  if (!context) throw new Error('useSeason must be used within a SeasonProvider');
  return context;
}
