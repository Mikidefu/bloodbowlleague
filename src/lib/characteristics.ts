// Caratteristiche di un giocatore (p. 37): MA e ST sono numeri, AG, PA e AV sono tiri ("3+").
// I valori ammessi sono solo quelli che il regolamento può produrre:
//   MA 1-9 e ST 1-8   (massimi di Characteristic Improvement, p. 98; minimo 1 per Lasting Injury, p. 37)
//   AG e PA da 1+ a 6+ (PA può mancare: "-")
//   AV da 3+ a 11+
// Tutto ciò che arriva dal database o dalle richieste passa da parseCharacteristic (rifiuta quello
// che non rispetta i limiti) o da coerceCharacteristic (lo riporta dentro i limiti): così i tipi
// qui sotto restano veri in tutta l'applicazione.

export const STAT_KEYS = ['ma', 'st', 'ag', 'pa', 'av'] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export type MovementValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type StrengthValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type AgilityValue = '1+' | '2+' | '3+' | '4+' | '5+' | '6+';
export type PassingValue = AgilityValue | '-';   // "-" = il giocatore non ha PA
export type ArmourValue = '3+' | '4+' | '5+' | '6+' | '7+' | '8+' | '9+' | '10+' | '11+';

export type Characteristics = {
  ma: MovementValue;
  st: StrengthValue;
  ag: AgilityValue;
  pa: PassingValue;
  av: ArmourValue;
};

// Valore di una singola caratteristica, legato alla sua colonna: Characteristic<'ag'> = AgilityValue
export type Characteristic<K extends StatKey = StatKey> = Characteristics[K];

export const MOVEMENT_VALUES: readonly MovementValue[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
export const STRENGTH_VALUES: readonly StrengthValue[] = [1, 2, 3, 4, 5, 6, 7, 8];
export const AGILITY_VALUES: readonly AgilityValue[] = ['1+', '2+', '3+', '4+', '5+', '6+'];
export const PASSING_VALUES: readonly PassingValue[] = [...AGILITY_VALUES, '-'];
export const ARMOUR_VALUES: readonly ArmourValue[] = ['3+', '4+', '5+', '6+', '7+', '8+', '9+', '10+', '11+'];

export const CHARACTERISTIC_VALUES: { [K in StatKey]: readonly Characteristics[K][] } = {
  ma: MOVEMENT_VALUES,
  st: STRENGTH_VALUES,
  ag: AGILITY_VALUES,
  pa: PASSING_VALUES,
  av: ARMOUR_VALUES,
};

// Profilo di partenza di un giocatore inserito a mano
export const DEFAULT_CHARACTERISTICS: Characteristics = { ma: 6, st: 3, ag: '3+', pa: '4+', av: '8+' };

// Caratteristiche scritte come numero (le altre sono tiri)
const NUMERIC_STATS: readonly StatKey[] = ['ma', 'st'];
const isNumericStat = (stat: StatKey) => NUMERIC_STATS.includes(stat);

export const isStatKey = (value: unknown): value is StatKey => STAT_KEYS.includes(value as StatKey);

export function isCharacteristic<K extends StatKey>(stat: K, value: unknown): value is Characteristics[K] {
  return (CHARACTERISTIC_VALUES[stat] as readonly unknown[]).includes(value);
}

export const statLabel = (stat: StatKey) => stat.toUpperCase();

// Elenco dei valori ammessi, per i messaggi d'errore: "1+, 2+, 3+, ..."
export const allowedValues = (stat: StatKey) => CHARACTERISTIC_VALUES[stat].join(', ');

const toNumber = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  const text = String(value ?? '').trim();
  return text === '' ? NaN : Number(text);
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Valore valido, oppure null se non rispetta il regolamento.
// Accetta le forme in cui il valore può arrivare: numeri, "6", "6+", "-" (solo PA).
export function parseCharacteristic<K extends StatKey>(stat: K, value: unknown): Characteristics[K] | null {
  if (isNumericStat(stat)) {
    const number = toNumber(value);
    return isCharacteristic(stat, number) ? (number as Characteristics[K]) : null;
  }

  const text = String(value ?? '').trim();
  // PA mancante: "-", vuoto, oppure 0 come lo scrivevano i vecchi inserimenti a mano
  if (stat === 'pa' && ['', '-', '0', '0+'].includes(text)) return '-' as Characteristics[K];
  const target = /^\d{1,2}\+?$/.test(text) ? `${parseInt(text, 10)}+` : text;
  return isCharacteristic(stat, target) ? (target as Characteristics[K]) : null;
}

// Come parseCharacteristic, ma restituisce sempre un valore: serve a leggere righe vecchie o
// scritte a mano nel database. Quello che esce dai limiti viene riportato dentro, quello
// illeggibile torna al profilo di partenza.
export function coerceCharacteristic<K extends StatKey>(stat: K, value: unknown): Characteristics[K] {
  const parsed = parseCharacteristic(stat, value);
  if (parsed !== null) return parsed;

  if (isNumericStat(stat)) {
    const number = toNumber(value);
    if (Number.isFinite(number)) {
      const values = CHARACTERISTIC_VALUES[stat] as readonly number[];
      return clamp(Math.round(number), values[0], values[values.length - 1]) as Characteristics[K];
    }
  } else {
    const number = parseInt(String(value ?? ''), 10);
    if (Number.isFinite(number)) {
      const targets = (stat === 'av' ? ARMOUR_VALUES : AGILITY_VALUES) as readonly string[];
      const bounds = targets.map(t => parseInt(t, 10));
      return `${clamp(number, bounds[0], bounds[bounds.length - 1])}+` as Characteristics[K];
    }
  }

  return DEFAULT_CHARACTERISTICS[stat];
}

// Le cinque caratteristiche di una riga del database, sempre valide
export function toCharacteristics(row: Partial<Record<StatKey, unknown>>): Characteristics {
  return {
    ma: coerceCharacteristic('ma', row.ma),
    st: coerceCharacteristic('st', row.st),
    ag: coerceCharacteristic('ag', row.ag),
    pa: coerceCharacteristic('pa', row.pa),
    av: coerceCharacteristic('av', row.av),
  };
}

// Posizione del valore nell'elenco di quelli ammessi (i tiri migliorano scendendo, tranne AV)
const indexOf = <K extends StatKey>(stat: K, value: Characteristics[K]) =>
  (CHARACTERISTIC_VALUES[stat] as readonly Characteristics[K][]).indexOf(value);

const at = <K extends StatKey>(stat: K, index: number): Characteristics[K] | null => {
  const values = CHARACTERISTIC_VALUES[stat] as readonly Characteristics[K][];
  return index >= 0 && index < values.length ? values[index] : null;
};

// Characteristic Improvement (p. 98): MA e ST salgono, AG e PA scendono di un punto sul tiro,
// AV sale. Restituisce null se la caratteristica è già al massimo.
// Un PA che manca ("-") migliorato diventa 6+.
export function improveCharacteristic<K extends StatKey>(stat: K, current: Characteristics[K]): Characteristics[K] | null {
  if (stat === 'pa' && current === '-') return '6+' as Characteristics[K];
  const index = indexOf(stat, current);
  if (index < 0) return null;
  // ma, st e av migliorano salendo nell'elenco; ag e pa (tiri da superare) migliorano scendendo
  return at(stat, isNumericStat(stat) || stat === 'av' ? index + 1 : index - 1);
}

// Lasting Injury (p. 37): la caratteristica peggiora di un punto.
// Restituisce null se è già al minimo (o se il PA manca): in quel caso la riduzione non si applica.
export function reduceCharacteristic<K extends StatKey>(stat: K, current: Characteristics[K]): Characteristics[K] | null {
  if (stat === 'pa' && current === '-') return null;
  const index = indexOf(stat, current);
  if (index < 0) return null;
  return at(stat, isNumericStat(stat) || stat === 'av' ? index - 1 : index + 1);
}

// Operazione inversa, per annullare una riduzione quando si corregge un referto.
// Se il valore ripristinato uscirebbe dai limiti resta com'è.
export function restoreCharacteristic<K extends StatKey>(stat: K, current: Characteristics[K]): Characteristics[K] {
  return improveCharacteristic(stat, current) ?? current;
}
