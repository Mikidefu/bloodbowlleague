'use client';
import Link from 'next/link';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { INDUCEMENTS, getInducement, inducementChoiceCost, mercenaryCost, type InducementChoice } from '@/lib/leagueRules';
import { STAR_HIRES, canHireStar, getStarHire, teamFavoured } from '@/lib/starPlayers';
import { INDUCEMENT_SHORT, INDUCEMENT_TIPS } from '@/lib/glossary';
import type { MatchTeam } from '@/lib/types';
import InfoTip from '@/components/match/InfoTip';
import { Term } from '@/components/match/Wizard';
import type { TeamPreview } from './pregameModel';
import styles from './InducementPicker.module.css';

const gp = (n: number) => n.toLocaleString();

export type InducementBudget = {
  total: number;          // quanto può spendere in tutto
  petty: number;          // di cui Petty Cash (0 per chi spende dalla Treasury)
  fromTreasury: number;   // massimo che può uscire dalla Treasury
};

// Scelta degli incentivi di una squadra (pp. 142-149): budget in alto, quantità con +/-, Mercenari e Star Player dal catalogo
export default function InducementPicker({ team, preview, inducements, budget, onChange }: {
  team: MatchTeam; preview: TeamPreview; inducements: InducementChoice[]; budget: InducementBudget; onChange: (next: InducementChoice[]) => void;
}) {
  const { t, language } = useLanguage();
  const L = (it: string, en: string) => (language === 'it' ? it : en);
  const p = preview;
  const left = budget.total - p.cost;
  const over = left < 0;
  const treasuryUsed = Math.max(0, p.cost - budget.petty);

  const qtyOf = (key: string) => inducements.find(c => c.key === key)?.qty ?? 0;
  const setQty = (key: string, qty: number) => {
    const rest = inducements.filter(c => c.key !== key);
    onChange(qty > 0 ? [...rest, { key, qty }] : rest);
  };
  const special = inducements.filter(c => c.key === 'mercenary' || c.key === 'star_player');
  const setSpecial = (index: number, patch: Partial<InducementChoice> | null) => {
    const others = inducements.filter(c => c.key !== 'mercenary' && c.key !== 'star_player');
    const list = special.map((c, i) => (i === index ? (patch ? { ...c, ...patch } : null) : c)).filter(Boolean) as InducementChoice[];
    onChange([...others, ...list]);
  };
  const count = (key: string) => special.filter(c => c.key === key).length;
  const tip = (key: string) => INDUCEMENT_TIPS[key]?.[language];
  const short = (key: string) => INDUCEMENT_SHORT[key]?.[language];

  return (
      <div className={styles.picker}>
        {/* BUDGET: quanto c'è, quanto è speso, quanto resta. Rosso se si sfora */}
        <div className={`${styles.budget} ${over ? styles.budgetOver : ''}`} aria-live="polite">
          <div className={styles.budgetRow}>
            <span className={styles.budgetCell}><small>Budget</small><b>{gp(budget.total)}</b></span>
            <span className={styles.budgetCell}><small>{L('Speso', 'Spent')}</small><b className={over ? styles.red : undefined}>{gp(p.cost)}</b></span>
            <span className={styles.budgetCell}><small>{over ? L('Sforato di', 'Over by') : L('Resta', 'Left')}</small><b className={over ? styles.red : styles.green}>{gp(Math.abs(left))}</b></span>
          </div>
          <div className={styles.bar} aria-hidden="true">
            <span style={{ width: `${budget.total ? Math.min(100, (p.cost / budget.total) * 100) : p.cost ? 100 : 0}%` }} />
          </div>
          <p className={styles.budgetNote}>
            {budget.petty > 0 ? (
                <>
                  <Term>Petty Cash</Term> <b>{gp(budget.petty)}</b> + max <b>{gp(budget.fromTreasury)}</b> {L('dalla', 'from the')} <Term>Treasury</Term>
                  {treasuryUsed > 0 && <> · {L('ne stai usando', 'using')} <b className={treasuryUsed > budget.fromTreasury ? styles.red : undefined}>{gp(treasuryUsed)}</b></>}
                </>
            ) : (
                <>{L('Tutto dalla', 'All from the')} <Term>Treasury</Term> · {L('dopo la partita resterà', 'after the match')} <b className={over ? styles.red : undefined}>{gp(Math.max(0, budget.total - p.cost))}</b> gp</>
            )}
          </p>
          {over && <p className={styles.overMsg}>{L('Hai sforato il budget: togli qualche incentivo.', 'Over budget: remove some inducements.')}</p>}
        </div>

        <ul className={styles.list}>
          {INDUCEMENTS.filter(def => def.key !== 'mercenary' && def.key !== 'star_player' && def.available(p.ctx)).map(def => {
            const qty = qtyOf(def.key);
            const max = def.max(p.ctx);
            const cost = def.cost(p.ctx) ?? 0;
            const tooMuch = qty < max && cost > left;   // uno in più sforerebbe
            return (
                <li key={def.key} className={`${styles.row} ${qty > 0 ? styles.rowOn : ''}`}>
                  <div className={styles.rowMain}>
                    <span className={styles.name}>
                      {def.name}
                      {tip(def.key) && <InfoTip text={tip(def.key)} label={def.name} />}
                    </span>
                    <span className={styles.meta}>
                      {short(def.key) && <i>{short(def.key)} · </i>}
                      <b className={tooMuch ? styles.red : undefined}>{gp(cost)}</b> {max > 1 ? L('cad.', 'each') : 'gp'} · max {max} · p. {def.page}
                    </span>
                  </div>
                  <span className={styles.subtotal}>{qty > 0 ? gp(qty * cost) : ''}</span>
                  <span className={styles.stepper}>
                    <button type="button" className={styles.stepBtn} disabled={qty <= 0} onClick={() => setQty(def.key, qty - 1)} aria-label={`${def.name} -1`}><Minus size={16} /></button>
                    <span className={styles.stepValue}>{qty}</span>
                    <button type="button" className={`${styles.stepBtn} ${tooMuch ? styles.stepWarn : ''}`} disabled={qty >= max} onClick={() => setQty(def.key, qty + 1)}
                            aria-label={`${def.name} +1`} title={tooMuch ? L('Uno in più sfora il budget', 'One more goes over budget') : undefined}><Plus size={16} /></button>
                  </span>
                </li>
            );
          })}
        </ul>

        {special.map((c, index) => {
          const cost = inducementChoiceCost(c, p.ctx);
          const def = getInducement(c.key)!;
          return (
              <div key={index} className={`${styles.special} ${styles.rowOn}`}>
                <span className={styles.name}>
                  {c.key === 'mercenary' ? t.rules.mercenary : t.rules.starPlayer}
                  <InfoTip text={tip(c.key)} label={def.name} />
                </span>
                {c.key === 'mercenary' ? (
                    <>
                      <select value={c.position_key ?? ''} onChange={e => setSpecial(index, { position_key: e.target.value })} aria-label={t.rules.position}>
                        <option value="">{t.rules.position}…</option>
                        {p.roster?.positions.map(pos => <option key={pos.key} value={pos.key}>{pos.name} ({gp(mercenaryCost(pos, !!c.with_skill) ?? 0)})</option>)}
                      </select>
                      <label className={styles.check}>
                        <input type="checkbox" checked={!!c.with_skill} onChange={e => setSpecial(index, { with_skill: e.target.checked })} /> {t.rules.mercenarySkill}
                      </label>
                    </>
                ) : (
                    <>
                      {/* Solo le star che giocano per la League / il Favoured of della squadra (p. 192) */}
                      <select value={c.star ?? ''} onChange={e => setSpecial(index, { star: e.target.value, qty: 1, name: undefined, cost: undefined })} aria-label={t.rules.starPlayer}>
                        <option value="">{c.name && !c.star ? `${c.name} (${gp(c.cost ?? 0)})` : t.stars.choose}</option>
                        {STAR_HIRES.filter(h => canHireStar(h.playsFor, { league: team.team_league, favouredOf: teamFavoured(p.roster, team.team_league, team.favoured_of) })).map(h => (
                            <option key={h.key} value={h.key}>{h.name} · {gp(h.cost)}{h.members.length > 1 ? ` · ${t.stars.pairShort}` : ''}</option>
                        ))}
                      </select>
                      {getStarHire(c.star) && <Link href={`/stars#${getStarHire(c.star)!.members[0].key}`} className={styles.link} target="_blank">{t.stars.card}</Link>}
                    </>
                )}
                <span className={`${styles.subtotal} ${cost === null ? styles.pending : ''}`}>{cost === null ? L('da scegliere', 'to choose') : gp(cost)}</span>
                <button type="button" className={styles.remove} onClick={() => setSpecial(index, null)} aria-label={t.rules.remove} title={t.rules.remove}><Trash2 size={16} /></button>
              </div>
          );
        })}

        <div className={styles.add}>
          <button type="button" className="btn" disabled={count('mercenary') >= 3} onClick={() => onChange([...inducements, { key: 'mercenary', qty: 1 }])}>
            <Plus size={16} /> {t.rules.mercenary} <small>({count('mercenary')}/3)</small>
          </button>
          <button type="button" className="btn" disabled={count('star_player') >= 2} onClick={() => onChange([...inducements, { key: 'star_player', qty: 1 }])}>
            <Plus size={16} /> {t.rules.starPlayer} <small>({count('star_player')}/2)</small>
          </button>
        </div>
      </div>
  );
}
