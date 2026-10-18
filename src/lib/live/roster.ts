// La rosa di una squadra come la mostra la companion durante la partita: chi gioca oggi, con il
// profilo di partita (i Prayers to Nuffle possono cambiare MA e AV e aggiungere skill, p. 142).
// Funzione pura: unisce i giocatori della partita (chi c'è e chi no) con la scheda completa della squadra.
// Gli Star Player ingaggiati nel pre-partita non sono giocatori della squadra: si prendono dagli incentivi.

import type { Characteristics } from '@/lib/characteristics';
import type { InducementChoice } from '@/lib/leagueRules';
import { onDraftList } from '@/lib/players';
import { profileWithPrayers, type PrayerEffect } from '@/lib/prayers';
import { getStarHire, type StarPlayer } from '@/lib/starPlayers';
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
  star: StarPlayer | null;                        // Star Player ingaggiato per questa partita (skill e regola speciale dal catalogo)
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
          star: null,
        };
      })
      // Prima chi gioca, poi per numero di maglia (chi non ce l'ha in fondo)
      .sort((a, b) => Number(!!a.unavailable) - Number(!!b.unavailable) || (a.jersey_number ?? 999) - (b.jersey_number ?? 999));
}

// Gli Star Player scelti negli incentivi della squadra: una coppia (es. Grak & Crumbleberry) sono due giocatori (p. 148).
// Le scelte registrate prima del catalogo hanno solo il nome, senza profilo: restano fuori.
export function starEntries(teamId: string, inducements: InducementChoice[]): RosterEntry[] {
  return inducements
      .filter(c => c.key === 'star_player')
      .flatMap(c => getStarHire(c.star)?.members ?? [])
      .map(s => ({
        id: `star-${teamId}-${s.key}`, jersey_number: null, name: s.name, role: 'Star Player',
        advancements: 0, journeyman: false, niggling_injuries: 0, unavailable: null,
        ma: s.ma, st: s.st, ag: s.ag, pa: s.pa, av: s.av,
        base: { ma: s.ma, av: s.av },
        effects: [],
        skills: [],
        full: null,
        star: s,
      }));
}

// Gli incentivi salvati nel pre-partita (JSON in match_team_reports.inducements)
export function parseInducements(raw: string | null | undefined): InducementChoice[] {
  try {
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// "MIGHTY BLOW (+1)" -> "Mighty blow (+1)": come nella pagina squadra
export const skillLabel = (name: string) => name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
