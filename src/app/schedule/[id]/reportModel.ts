// Stato del referto condiviso tra la pagina della partita (modulo completo) e il percorso guidato.

import { CASUALTY_RESULTS, type CasualtyResult, type InjuryStat } from '@/lib/leagueRules';

// Valore di un campo numerico mentre l'utente scrive: '' = campo svuotato
export type NumericInput = number | '';
export type StatField = 'td' | 'cas' | 'int' | 'comp' | 'ttm' | 'landing' | 'mvp';

export type PlayerStatDraft = {
  player_id: string;
  jersey_number: number | null;
  name: string;
  team_id: string;
  status: string;
  unavailable: 'mng' | 'retired' | null;
  advancements: number;
  niggling: number;
  injury: CasualtyResult | '';
  injuryStat: InjuryStat | '';
  hatred: string;
} & Record<StatField, NumericInput>;

export type TeamResultDraft = { stalling: boolean; df_roll: string; commitments_roll: string; quit_rolls: Record<string, string> };

export const toNumericInput = (value: string): NumericInput => (value === '' ? '' : Math.max(0, parseInt(value, 10) || 0));
// Lo zero si mostra come campo vuoto con placeholder "0", così si può scrivere subito sopra
export const zeroAsEmpty = (value: NumericInput) => (value === 0 ? '' : value);

// D16 (più i modificatori) sulla Casualty Table (p. 67): oltre 16 resta Dead
export function casualtyForRoll(total: number): CasualtyResult {
  const clamped = Math.min(16, Math.max(1, total));
  const hit = CASUALTY_RESULTS.find(c => {
    const [min, max] = c.d16.split('-').map(Number);
    return clamped >= min && clamped <= (max || min);
  });
  return hit?.key ?? 'BH';
}
