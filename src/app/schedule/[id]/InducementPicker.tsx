'use client';
import Link from 'next/link';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { INDUCEMENTS, mercenaryCost, type InducementChoice } from '@/lib/leagueRules';
import { STAR_HIRES, canHireStar, getStarHire, teamFavoured } from '@/lib/starPlayers';
import type { MatchTeam } from '@/lib/types';
import type { TeamPreview } from './pregameModel';
import styles from './MatchDetails.module.css';

const gp = (n: number) => n.toLocaleString();

// Scelta degli incentivi di una squadra (pp. 142-149): quantità, Mercenari e Star Player dal catalogo
export default function InducementPicker({ team, preview, inducements, onChange }: {
  team: MatchTeam; preview: TeamPreview; inducements: InducementChoice[]; onChange: (next: InducementChoice[]) => void;
}) {
  const { t } = useLanguage();
  const p = preview;
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

  return (
      <>
        <ul className={styles.inducementList}>
          {INDUCEMENTS.filter(def => def.key !== 'mercenary' && def.key !== 'star_player' && def.available(p.ctx)).map(def => {
            const qty = qtyOf(def.key);
            const max = def.max(p.ctx);
            return (
                <li key={def.key} className={styles.inducementRow}>
                  <span>{def.name} <small>(p. {def.page}) · {gp(def.cost(p.ctx) ?? 0)} · 0-{max}</small></span>
                  <span className={styles.stepper}>
                    <button type="button" className={styles.stepBtn} disabled={qty <= 0} onClick={() => setQty(def.key, qty - 1)} aria-label={`${def.name} -1`}><Minus size={14} /></button>
                    <span className={styles.stepValue}>{qty}</span>
                    <button type="button" className={styles.stepBtn} disabled={qty >= max} onClick={() => setQty(def.key, qty + 1)} aria-label={`${def.name} +1`}><Plus size={14} /></button>
                  </span>
                </li>
            );
          })}
        </ul>

        {special.map((c, index) => (
            <div key={index} className={styles.specialRow}>
              {c.key === 'mercenary' ? (
                  <>
                    <strong>{t.rules.mercenary}</strong>
                    <select value={c.position_key ?? ''} onChange={e => setSpecial(index, { position_key: e.target.value })} className={styles.smallSelect} aria-label={t.rules.position}>
                      <option value="">{t.rules.position}</option>
                      {p.roster?.positions.map(pos => <option key={pos.key} value={pos.key}>{pos.name} ({gp(mercenaryCost(pos, !!c.with_skill) ?? 0)})</option>)}
                    </select>
                    <label className={styles.inlineCheck}>
                      <input type="checkbox" checked={!!c.with_skill} onChange={e => setSpecial(index, { with_skill: e.target.checked })} /> {t.rules.mercenarySkill}
                    </label>
                  </>
              ) : (
                  <>
                    <strong>{t.rules.starPlayer}</strong>
                    {/* Solo le star che giocano per la League / il Favoured of della squadra (p. 192) */}
                    <select value={c.star ?? ''} onChange={e => setSpecial(index, { star: e.target.value, qty: 1, name: undefined, cost: undefined })} className={styles.smallSelect} aria-label={t.rules.starPlayer}>
                      <option value="">{c.name && !c.star ? `${c.name} (${gp(c.cost ?? 0)})` : t.stars.choose}</option>
                      {STAR_HIRES.filter(h => canHireStar(h.playsFor, { league: team.team_league, favouredOf: teamFavoured(p.roster, team.team_league, team.favoured_of) })).map(h => (
                          <option key={h.key} value={h.key}>{h.name} · {gp(h.cost)}{h.members.length > 1 ? ` · ${t.stars.pairShort}` : ''}</option>
                      ))}
                    </select>
                    {getStarHire(c.star) && <Link href={`/stars#${getStarHire(c.star)!.members[0].key}`} className={styles.linkBtn} target="_blank">{t.stars.card}</Link>}
                  </>
              )}
              <button type="button" className={styles.iconBtnSmall} onClick={() => setSpecial(index, null)} aria-label={t.rules.remove} title={t.rules.remove}><Trash2 size={16} /></button>
            </div>
        ))}
        <div className={styles.addRow}>
          <button type="button" className="btn" onClick={() => onChange([...inducements, { key: 'mercenary', qty: 1 }])}>+ {t.rules.mercenary}</button>
          <button type="button" className="btn" onClick={() => onChange([...inducements, { key: 'star_player', qty: 1 }])}>+ {t.rules.starPlayer}</button>
        </div>
      </>
  );
}
