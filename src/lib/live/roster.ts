// La rosa di una squadra come la mostra la companion durante la partita: chi gioca oggi, con il
// profilo di partita (i Prayers to Nuffle possono cambiare MA e AV e aggiungere skill, p. 142).
// Funzione pura: unisce i giocatori della partita (chi c'è e chi no) con la scheda completa della squadra.

import type { Characteristics } from '@/lib/characteristics';
import { onDraftList } from '@/lib/players';
import { profileWithPrayers, type PrayerEffect } from '@/lib/prayers';
import type { MatchPlayer, Player, Skill } from '@/lib/types';

export type RosterEntry = Characteristics & {
  id: string;
  jersey_number: number | null;
  name: string;
  role: string;
  advancements: number;
  journeyman: boolean;
  niggling_injuries: number;
  unavailable: MatchPlayer['unavailable'];        // non gioca questa partita
  base: Pick<Characteristics, 'ma' | 'av'>;       // profilo di rosa, prima dei Prayers
  effects: PrayerEffect[];                        // Prayers che lo toccano oggi
  skills: Skill[];
  full: Player | null;                            // scheda completa (SPP, valore, infortuni): manca se la squadra non si è caricata
};

type Row = Pick<MatchPlayer, 'id' | 'jersey_number' | 'name' | 'role' | 'advancements' | 'journeyman' | 'niggling_injuries' | 'ma' | 'st' | 'ag' | 'pa' | 'av' | 'unavailable'>;

// Senza i dati della partita si ricade sulla Team Draft List, con MNG e Temporarily Retiring letti dalle bandiere
const fromTeam = (p: Player): Row => ({ ...p, unavailable: p.mng ? 'mng' : p.temp_retired ? 'retired' : null });

export function rosterEntries(teamPlayers: Player[] | null, matchPlayers: MatchPlayer[] | null, effects: Map<string, PrayerEffect[]>): RosterEntry[] {
  const rows: Row[] = matchPlayers ?? (teamPlayers ?? []).filter(onDraftList).map(fromTeam);

  return rows
      .map(row => {
        const full = teamPlayers?.find(p => p.id === row.id) ?? null;
        const mine = effects.get(row.id) ?? [];
        const profile = profileWithPrayers(row.ma, row.av, mine);
        return {
          id: row.id, jersey_number: row.jersey_number, name: row.name, role: row.role,
          advancements: row.advancements, journeyman: row.journeyman, niggling_injuries: row.niggling_injuries,
          unavailable: row.unavailable,
          ma: profile.ma, st: row.st, ag: row.ag, pa: row.pa, av: profile.av,
          base: { ma: row.ma, av: row.av },
          effects: mine,
          skills: full?.skills ?? [],
          full,
        };
      })
      // Prima chi gioca, poi per numero di maglia (chi non ce l'ha in fondo)
      .sort((a, b) => Number(!!a.unavailable) - Number(!!b.unavailable) || (a.jersey_number ?? 999) - (b.jersey_number ?? 999));
}

// "MIGHTY BLOW (+1)" -> "Mighty blow (+1)": come nella pagina squadra
export const skillLabel = (name: string) => name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
