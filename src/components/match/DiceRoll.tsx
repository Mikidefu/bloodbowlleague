'use client';
import { Dices, RotateCcw } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { rollDie } from '@/lib/leagueRules';
import { rich, Term } from './Wizard';
import styles from './Wizard.module.css';

export type DiceValues = (number | null)[];

type Props = {
  label: string;
  sides: number;               // 3, 6, 8, 16
  count?: number;              // quanti dadi (2 per 2D6)
  values: DiceValues;
  onChange: (values: DiceValues) => void;
  modifier?: number;           // si somma al totale (es. +1 per ogni Niggling Injury)
  hint?: string;
  disabled?: boolean;
};

export const emptyDice = (count = 1): DiceValues => Array.from({ length: count }, () => null);
export const diceDone = (values: DiceValues, sides: number, count = 1) =>
  values.length === count && values.every(v => v !== null && Number.isInteger(v) && v >= 1 && v <= sides);
export const diceTotal = (values: DiceValues, modifier = 0) => values.reduce<number>((sum, v) => sum + (v ?? 0), 0) + modifier;

/** Un tiro di dadi: si scrive quello che è uscito sul tavolo, oppure si tira qui.
 *  "Ritira" svuota il tiro per ripeterlo (re-roll, skill, errore di battitura...). */
export default function DiceRoll({ label, sides, count = 1, values, onChange, modifier = 0, hint, disabled }: Props) {
  const { language } = useLanguage();
  const L = (it: string, en: string) => (language === 'it' ? it : en);
  const current = values.length === count ? values : emptyDice(count);
  const done = diceDone(current, sides, count);
  const name = `${count > 1 ? count : ''}D${sides}`;

  const set = (index: number, raw: string) => {
    const n = raw === '' ? null : Math.trunc(Number(raw));
    onChange(current.map((v, i) => (i === index ? (n === null || Number.isNaN(n) ? null : n) : v)));
  };

  return (
      <div className={styles.dice}>
        <div className={styles.diceHead}>
          <span className={styles.diceLabel}><Term>{label}</Term></span>
          <span className="tag tag-navy">{name}{modifier ? ` ${modifier > 0 ? '+' : ''}${modifier}` : ''}</span>
        </div>
        <div className={styles.diceRow}>
          {current.map((v, i) => (
              <input
                  key={i}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={sides}
                  value={v ?? ''}
                  placeholder="?"
                  disabled={disabled}
                  aria-label={`${label}: ${L('dado', 'die')} ${i + 1} (1-${sides})`}
                  aria-invalid={v !== null && (v < 1 || v > sides)}
                  onChange={e => set(i, e.target.value)}
                  className={styles.dieInput}
              />
          ))}
          {(count > 1 || modifier !== 0) && done && (
              <span className={styles.diceTotal}>= <b>{diceTotal(current, modifier)}</b></span>
          )}
          <span className={styles.diceActions}>
            <button type="button" className="btn btn-slate" disabled={disabled} onClick={() => onChange(current.map(() => rollDie(sides)))}>
              <Dices size={18} /> {L('Tira', 'Roll')}
            </button>
            <button type="button" className="btn" disabled={disabled || current.every(v => v === null)} onClick={() => onChange(emptyDice(count))}>
              <RotateCcw size={16} /> {L('Ritira', 'Re-roll')}
            </button>
          </span>
        </div>
        {current.some(v => v !== null && (v < 1 || v > sides)) && (
            <p className={styles.diceError}>{L(`Ogni dado va da 1 a ${sides}.`, `Each die goes from 1 to ${sides}.`)}</p>
        )}
        {hint && <p className={styles.diceHint}>{rich(hint, language)}</p>}
      </div>
  );
}
