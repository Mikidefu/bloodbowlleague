'use client';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import {
  MATCH_TABLES, diceLabel, getMatchTable, rowForTotal, rowRange,
  type TableKey,
} from '@/lib/matchTables';
import styles from './MatchTables.module.css';

/** Le tabelle da consultare in partita: striscia scura con i filtri (come la ricerca delle Skills),
 *  poi la tabella scelta su pergamena, impaginata come le tabelle del Rulebook.
 *  I dadi si tirano al tavolo e si scrivono qui: il sito non tira niente, illumina solo il risultato.
 *  Usato nella pagina /tables e dentro il referto della partita. */
export default function MatchTables({ initial = 'weather' }: { initial?: TableKey }) {
  const { language, t } = useLanguage();
  const [active, setActive] = useState<TableKey>(initial);
  const [entered, setEntered] = useState<Partial<Record<TableKey, string[]>>>({});   // dadi scritti, per tabella
  const [modifiers, setModifiers] = useState<Partial<Record<TableKey, number>>>({});

  const table = getMatchTable(active) ?? MATCH_TABLES[0];
  const { count, sides } = table.dice;
  const values = Array.from({ length: count }, (_, i) => entered[table.key]?.[i] ?? '');
  const dice = values.map(Number);
  const complete = dice.every(n => n >= 1 && n <= sides);
  const modifier = table.modifier ? modifiers[table.key] ?? 0 : 0;
  const total = complete ? dice.reduce((a, b) => a + b, 0) + modifier : null;
  const result = total === null ? null : rowForTotal(table, total);
  const nextTable = result?.next ? getMatchTable(result.next) : null;

  // Solo cifre, mai oltre le facce del dado (un D16 passa da "1" prima di diventare "16")
  const setDie = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, String(sides).length);
    if (digits && (Number(digits) < 1 || Number(digits) > sides)) return;
    setEntered(all => ({ ...all, [table.key]: values.map((v, i) => (i === index ? digits : v)) }));
  };

  return (
      <div className={styles.wrap}>
        {/* STRISCIA SCURA: le otto tabelle come filtri */}
        <div className={styles.toolbar}>
          <div className={styles.toolbarMicro} aria-hidden="true">
            <span><i className={styles.microSquares} />{`Match tables // ${diceLabel(table.dice)}`}</span>
            <span className={styles.toolbarCount}>{`${MATCH_TABLES.length} tables // Rulebook 2025`}</span>
          </div>
          <div className={styles.filters} role="tablist" aria-label={t.tables.sectionTitle}>
            {MATCH_TABLES.map(item => {
              const selected = item.key === table.key;
              return (
                  <button
                      key={item.key}
                      type="button"
                      role="tab"
                      id={`tab-${item.key}`}
                      aria-selected={selected}
                      aria-controls="match-table-panel"
                      className={`btn ${selected ? 'btn-primary' : 'btn-slate'} ${styles.filterBtn}`}
                      onClick={() => setActive(item.key)}
                  >
                    {item.title[language]} <small className={styles.filterDice}>{diceLabel(item.dice)}</small>
                  </button>
              );
            })}
          </div>
        </div>

        {/* PERGAMENA: la tabella scelta */}
        <section id="match-table-panel" role="tabpanel" aria-labelledby={`tab-${table.key}`} className={`card ${styles.panel}`}>
          <header className={styles.head}>
            <h3 className={styles.title}>{table.title[language]}</h3>
            <div className={styles.meta}>
              <span className="tag tag-navy">{diceLabel(table.dice)}</span>
              <span className="tag">{t.tables.page.replace('{page}', String(table.page))}</span>
            </div>
          </header>
          <p className={styles.who}>{table.who[language]}</p>

          {/* TIRO: placca d'ottone con i dadi del tavolo da scrivere e il risultato */}
          <div className={`plate ${styles.rollPlate}`}>
            <div className={styles.controls}>
              {table.modifier && (
                  <label className={styles.modifier}>
                    <span className={styles.modifierLabel}>{t.tables.modifier}</span>
                    <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={9}
                        value={modifiers[table.key] ?? 0}
                        onChange={e => setModifiers(m => ({ ...m, [table.key]: Math.max(0, Math.min(9, Number(e.target.value) || 0)) }))}
                        aria-describedby="modifier-hint"
                    />
                    <small id="modifier-hint" className={styles.modifierHint}>{table.modifier[language]}</small>
                  </label>
              )}
              <div className={styles.dice} role="group" aria-label={`${t.tables.enterDice} ${diceLabel(table.dice)}`}>
                <span className={styles.diceLabel}>{t.tables.enterDice}</span>
                {values.map((value, i) => (
                    <input key={`${table.key}-${i}`} className={styles.dieInput} inputMode="numeric" maxLength={String(sides).length} placeholder="?"
                      aria-label={`D${sides}${count > 1 ? ` ${i + 1}` : ''}`} value={value} onChange={e => setDie(i, e.target.value)} />
                ))}
                {complete && modifier > 0 && <span className={styles.sum}>+{modifier}</span>}
                {complete && (count > 1 || modifier > 0) && <span className={styles.sum}>= <b>{total}</b></span>}
              </div>
            </div>

            <div className={styles.result} aria-live="polite">
              {result ? (
                  <div className={styles.outcome}>
                    <span className={`${styles.outcomeName} ${styles[result.tone]}`}>{result.name}</span>
                    <p className={styles.outcomeText}>{result.text[language]}</p>
                    {nextTable && (
                        <button type="button" className={`btn btn-slate ${styles.nextBtn}`} onClick={() => setActive(nextTable.key)}>
                          {t.tables.rollOn.replace('{table}', nextTable.title[language])} <ArrowRight size={18} />
                        </button>
                    )}
                  </div>
              ) : (
                  <p className={styles.empty}>{t.tables.noRoll}</p>
              )}
            </div>
          </div>

          {/* TABELLA: come quelle del Rulebook, testata rossa e righe alternate */}
          <div className={`table-container ${styles.tableWrap}`}>
            <table className={`data-table ${styles.table}`}>
              <thead>
                <tr>
                  <th scope="col" className="num">{diceLabel(table.dice)}</th>
                  <th scope="col">{t.tables.result}</th>
                </tr>
              </thead>
              <tbody>
                {table.rows.map(row => (
                    <tr key={row.min} className={row === result ? styles.hit : undefined} aria-current={row === result ? 'true' : undefined}>
                      <td className={`num ${styles.range}`}>{rowRange(row)}</td>
                      <td>
                        <span className={`${styles.rowName} ${styles[row.tone]}`}>{row.name}</span>
                        <span className={styles.rowText}>{row.text[language]}</span>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>

          {table.note && <p className={styles.note}>{table.note[language]}</p>}
        </section>
      </div>
  );
}
