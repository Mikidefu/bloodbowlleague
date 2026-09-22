'use client';
import { useState } from 'react';
import { ArrowRight, Dices } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import {
  MATCH_TABLES, diceLabel, getMatchTable, rollTable, rowForTotal, rowRange,
  type MatchTable, type TableKey,
} from '@/lib/matchTables';
import styles from './MatchTables.module.css';

type Roll = { dice: number[]; modifier: number };

/** Le tabelle da consultare in partita: una scheda per tabella, il tiro evidenzia la riga uscita.
 *  Usato nella pagina /tables e, più compatto, dentro il referto della partita. */
export default function MatchTables({ initial = 'weather' }: { initial?: TableKey }) {
  const { language, t } = useLanguage();
  const [active, setActive] = useState<TableKey>(initial);
  const [rolls, setRolls] = useState<Partial<Record<TableKey, Roll>>>({});
  const [modifiers, setModifiers] = useState<Partial<Record<TableKey, number>>>({});

  const table = getMatchTable(active) ?? MATCH_TABLES[0];
  const roll = rolls[table.key];
  const total = roll ? roll.dice.reduce((a, b) => a + b, 0) + roll.modifier : null;
  const result = total === null ? null : rowForTotal(table, total);

  const doRoll = (target: MatchTable) => {
    const modifier = target.modifier ? modifiers[target.key] ?? 0 : 0;
    setRolls(r => ({ ...r, [target.key]: { dice: rollTable(target), modifier } }));
    setActive(target.key);
  };

  const nextTable = result?.next ? getMatchTable(result.next) : null;

  return (
      <div className={styles.wrap}>
        <div className={styles.tabs} role="tablist" aria-label={t.tables.sectionTitle}>
          {MATCH_TABLES.map(item => (
              <button
                  key={item.key}
                  type="button"
                  role="tab"
                  id={`tab-${item.key}`}
                  aria-selected={item.key === table.key}
                  aria-controls="match-table-panel"
                  className={`${styles.tab} ${item.key === table.key ? styles.tabActive : ''}`}
                  onClick={() => setActive(item.key)}
              >
                {item.title[language]}
                <span className={styles.tabDice}>{diceLabel(item.dice)}</span>
              </button>
          ))}
        </div>

        <section id="match-table-panel" role="tabpanel" aria-labelledby={`tab-${table.key}`} className={styles.panel}>
          <header className={styles.head}>
            <div className={styles.headText}>
              <h3 className={styles.title}>{table.title[language]}</h3>
              <p className={styles.who}>{table.who[language]}</p>
            </div>
            <div className={styles.meta}>
              <span className={`tag tag-navy ${styles.metaTag}`}>{diceLabel(table.dice)}</span>
              <span className={`tag ${styles.metaTag}`}>{t.tables.page.replace('{page}', String(table.page))}</span>
            </div>
          </header>

          <div className={styles.controls}>
            {table.modifier && (
                <label className={styles.modifier}>
                  <span>{t.tables.modifier}</span>
                  <input
                      type="number"
                      min={0}
                      max={9}
                      value={modifiers[table.key] ?? 0}
                      onChange={e => setModifiers(m => ({ ...m, [table.key]: Math.max(0, Math.min(9, Number(e.target.value) || 0)) }))}
                  />
                  <small>{table.modifier[language]}</small>
                </label>
            )}
            <button type="button" className={`btn btn-gold ${styles.rollBtn}`} onClick={() => doRoll(table)}>
              <Dices size={20} /> {t.tables.roll} {diceLabel(table.dice)}
            </button>
          </div>

          {/* Il risultato si annuncia a chi usa uno screen reader */}
          <div className={styles.result} aria-live="polite">
            {roll && result ? (
                <>
                  <div className={styles.dice} aria-label={`${t.tables.total} ${total}`}>
                    {roll.dice.map((value, i) => <span key={i} className={styles.die}>{value}</span>)}
                    {roll.modifier > 0 && <span className={styles.plus}>+{roll.modifier}</span>}
                    {(roll.dice.length > 1 || roll.modifier > 0) && <span className={styles.total}>= {total}</span>}
                  </div>
                  <div className={`${styles.outcome} ${styles[result.tone]}`}>
                    <strong className={styles.outcomeName}>{result.name}</strong>
                    <p className={styles.outcomeText}>{result.text[language]}</p>
                    {nextTable && (
                        <button type="button" className={`btn btn-slate ${styles.nextBtn}`} onClick={() => doRoll(nextTable)}>
                          {t.tables.rollOn.replace('{table}', nextTable.title[language])} <ArrowRight size={18} />
                        </button>
                    )}
                  </div>
                </>
            ) : (
                <p className={styles.empty}>{t.tables.noRoll}</p>
            )}
          </div>

          <ol className={styles.rows}>
            {table.rows.map(row => (
                <li key={row.min} className={`${styles.row} ${styles[row.tone]} ${row === result ? styles.rowHit : ''}`}>
                  <span className={styles.range}>{rowRange(row)}</span>
                  <div>
                    <span className={styles.rowName}>{row.name}</span>
                    <span className={styles.rowText}>{row.text[language]}</span>
                  </div>
                </li>
            ))}
          </ol>

          {table.note && <p className={styles.note}>{table.note[language]}</p>}
        </section>
      </div>
  );
}
