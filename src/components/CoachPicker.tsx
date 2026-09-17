'use client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { Coach } from '@/lib/types';
import styles from './CoachPicker.module.css';

// Valore del selettore: un allenatore esistente oppure il nome di uno nuovo
export type CoachChoice = { coachId: string; newCoachName: string; isNew: boolean };

export const emptyCoachChoice = (coachId = ''): CoachChoice => ({ coachId, newCoachName: '', isNew: false });

// Campi da inviare alle API (coach_id oppure new_coach_name)
export function coachChoicePayload(choice: CoachChoice): { coach_id?: string; new_coach_name?: string } {
  return choice.isNew ? { new_coach_name: choice.newCoachName.trim() } : { coach_id: choice.coachId };
}

export function isCoachChoiceComplete(choice: CoachChoice) {
  return choice.isNew ? choice.newCoachName.trim().length > 0 : choice.coachId !== '';
}

const NEW_OPTION = '__new__';

type Props = {
  coaches: Coach[];
  value: CoachChoice;
  onChange: (value: CoachChoice) => void;
  required?: boolean;
  allowNone?: boolean;       // consente "nessun allenatore"
  selectClassName?: string;
  inputClassName?: string;
  idPrefix?: string;
};

export default function CoachPicker({ coaches, value, onChange, required, allowNone, selectClassName, inputClassName, idPrefix = 'coach' }: Props) {
  const { t } = useLanguage();

  return (
      <div className={styles.picker}>
        <select
            id={`${idPrefix}-select`}
            aria-label={t.coachPicker.label}
            className={selectClassName}
            required={required && !value.isNew}
            value={value.isNew ? NEW_OPTION : value.coachId}
            onChange={e => {
              const selected = e.target.value;
              onChange(selected === NEW_OPTION
                  ? { coachId: '', newCoachName: value.newCoachName, isNew: true }
                  : { coachId: selected, newCoachName: '', isNew: false });
            }}
        >
          <option value="">{allowNone ? t.coachPicker.none : t.coachPicker.choose}</option>
          {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          <option value={NEW_OPTION}>{t.coachPicker.newCoach}</option>
        </select>

        {value.isNew && (
            <input
                id={`${idPrefix}-new-name`}
                type="text"
                className={inputClassName}
                required={required}
                maxLength={60}
                autoFocus
                placeholder={t.coachPicker.newCoachName}
                aria-label={t.coachPicker.newCoachName}
                value={value.newCoachName}
                onChange={e => onChange({ ...value, newCoachName: e.target.value })}
            />
        )}
      </div>
  );
}
