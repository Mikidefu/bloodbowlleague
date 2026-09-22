'use client';
import { useState } from 'react';
import { Dices, Minus, Plus, Save, Trash2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import {
  INDUCEMENTS, LIMITS, PETTY_CASH_TREASURY_TOP_UP, fanFactor, inducementChoiceCost, mercenaryCost, pettyCash, rollDie,
  type InducementChoice,
} from '@/lib/leagueRules';
import Link from 'next/link';
import { getRoster, hasRule, isLineman, journeymanPositions } from '@/lib/rosters';
import { STAR_HIRES, canHireStar, getStarHire, teamFavoured } from '@/lib/starPlayers';
import { isTrue, type MatchDetails, type MatchTeam } from '@/lib/types';
import styles from './MatchDetails.module.css';

type TeamDraft = { fair_weather: string; journeyman_position: string; inducements: InducementChoice[]; riotous_roll: string };

type Props = { match: MatchDetails; canEdit: boolean; onSaved: () => void };

const gp = (n: number) => n.toLocaleString();

// Sequenza pre-partita di League Play (pp. 44-45, 94, 142-148).
// Il server ricalcola e valida tutto; qui c'è l'anteprima di Fan Factor, Journeymen, CTV e Petty Cash.
export default function PregamePanel({ match, canEdit, onSaved }: Props) {
  const { t } = useLanguage();
  const editable = canEdit && !isTrue(match.is_played);
  const reportOf = (teamId: string) => match.reports.find(r => r.team_id === teamId);
  const playersOf = (teamId: string) => [...match.homePlayers, ...match.awayPlayers].filter(p => p.team_id === teamId);

  const initial = (teamId: string): TeamDraft => {
    const report = reportOf(teamId);
    let inducements: InducementChoice[] = [];
    try { inducements = report?.inducements ? JSON.parse(report.inducements) : []; } catch { inducements = []; }
    const jm = playersOf(teamId).find(p => isTrue(p.journeyman));
    return { fair_weather: report?.fair_weather ? String(report.fair_weather) : '', journeyman_position: jm?.position_key ?? '', inducements, riotous_roll: '' };
  };

  const [drafts, setDrafts] = useState<Record<string, TeamDraft>>(() => ({
    [match.home_team_id]: initial(match.home_team_id),
    [match.away_team_id]: initial(match.away_team_id),
  }));
  const [saving, setSaving] = useState(false);

  const teams = [match.home_team_id, match.away_team_id].map(id => match.teams.find(tm => tm.id === id)!).filter(Boolean);
  if (teams.length < 2) return null;

  const update = (teamId: string, patch: Partial<TeamDraft>) => setDrafts(prev => ({ ...prev, [teamId]: { ...prev[teamId], ...patch } }));

  // Anteprima per squadra
  const preview = (team: MatchTeam) => {
    const draft = drafts[team.id];
    const roster = getRoster(team.roster);
    const players = playersOf(team.id);
    const available = players.filter(p => !p.unavailable && !isTrue(p.journeyman) && !isTrue(p.dead)).length;
    const riotous = draft.inducements.some(c => c.key === 'riotous_rookies');
    const journeymen = Math.max(0, LIMITS.minPlayers - available) + (riotous ? Number(draft.riotous_roll) || 0 : 0);
    const options = journeymanPositions(roster);
    const jPosition = options.find(o => o.key === draft.journeyman_position) ?? (options.length === 1 ? options[0] : null);
    const jCtv = (position: typeof jPosition) => (!position ? 0 : hasRule(roster, 'Low Cost Linemen') && isLineman(position) ? 0 : position.cost);
    const existing = players.filter(p => isTrue(p.journeyman));
    const existingCtv = existing.reduce((sum, p) => sum + jCtv(roster?.positions.find(pos => pos.key === p.position_key) ?? null), 0);
    const ctv = team.ctv - existingCtv + journeymen * jCtv(jPosition);
    const ctx = { roster, favouredOf: team.favoured_of, league: team.team_league };
    const cost = draft.inducements.reduce((sum, c) => sum + (inducementChoiceCost(c, ctx) ?? 0), 0);
    const ff = draft.fair_weather ? fanFactor(team.dedicated_fans, Number(draft.fair_weather)) : null;
    return { roster, ctx, journeymen, options, jPosition, ctv, cost, ff, available };
  };

  const [home, away] = teams;
  const pHome = preview(home);
  const pAway = preview(away);
  const equal = pHome.ctv === pAway.ctv;
  const higher = pHome.ctv > pAway.ctv ? home : away;
  const lower = higher.id === home.id ? away : home;
  const pHigher = higher.id === home.id ? pHome : pAway;
  const pLower = higher.id === home.id ? pAway : pHome;
  const petty = equal ? 0 : pettyCash(pHigher.ctv, pLower.ctv, pHigher.cost);
  const topUp = Math.max(0, pLower.cost - petty);

  const budgetLine = (team: MatchTeam) => {
    if (equal) return t.rules.equalCtv;
    if (team.id === higher.id) return `${t.rules.spendsFirst}: ${gp(pHigher.cost)} / ${gp(team.treasury)} gp`;
    return `${t.rules.pettyCash} ${gp(petty)} gp + ${gp(topUp)} ${t.rules.topUp}`;
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        teams: Object.fromEntries(teams.map(team => {
          const d = drafts[team.id];
          return [team.id, {
            fair_weather: Number(d.fair_weather),
            journeyman_position: d.journeyman_position || null,
            inducements: d.inducements,
            riotous_roll: d.riotous_roll ? Number(d.riotous_roll) : null,
          }];
        })),
      };
      const res = await fetch(`/api/schedule/${match.id}/pregame`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) alert(data.error || 'Error');
      else onSaved();
    } finally {
      setSaving(false);
    }
  };

  // Riepilogo in sola lettura
  if (!editable) {
    if (!match.reports.some(r => r.fan_factor !== null)) return null;
    return (
        <section className={`card ${styles.rulesCard}`}>
          <h3 className="subhead">{t.rules.pregameTitle}</h3>
          <div className={styles.rulesGrid}>
            {teams.map(team => {
              const report = reportOf(team.id);
              const d = drafts[team.id];
              return (
                  <div key={team.id} className={styles.rulesTeam}>
                    <strong className={styles.rulesTeamName}>{team.name}</strong>
                    <span>{t.rules.fanFactor}: <strong>{report?.fan_factor ?? '—'}</strong> ({t.rules.dedicatedFans} + D3 {report?.fair_weather ?? '—'})</span>
                    <span>{t.rules.ctv}: <strong>{gp(report?.ctv ?? 0)}</strong></span>
                    <span>{t.rules.pettyCash}: {gp(report?.petty_cash ?? 0)} · {t.rules.treasury}: -{gp(report?.treasury_spent ?? 0)}</span>
                    {!!report?.journeymen && <span>{t.rules.journeymenNeeded}: {report.journeymen}</span>}
                    <span>{t.rules.inducements}: {d.inducements.length ? d.inducements.map(c => `${c.name || INDUCEMENTS.find(i => i.key === c.key)?.name} x${c.qty}`).join(', ') : t.rules.none}</span>
                  </div>
              );
            })}
          </div>
        </section>
    );
  }

  const inducementRows = (team: MatchTeam) => {
    const p = team.id === home.id ? pHome : pAway;
    const draft = drafts[team.id];
    const qtyOf = (key: string) => draft.inducements.find(c => c.key === key)?.qty ?? 0;
    const setQty = (key: string, qty: number) => {
      const rest = draft.inducements.filter(c => c.key !== key);
      update(team.id, { inducements: qty > 0 ? [...rest, { key, qty }] : rest });
    };
    const special = draft.inducements.filter(c => c.key === 'mercenary' || c.key === 'star_player');
    const setSpecial = (index: number, patch: Partial<InducementChoice> | null) => {
      const others = draft.inducements.filter(c => c.key !== 'mercenary' && c.key !== 'star_player');
      const list = special.map((c, i) => (i === index ? (patch ? { ...c, ...patch } : null) : c)).filter(Boolean) as InducementChoice[];
      update(team.id, { inducements: [...others, ...list] });
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
            <button type="button" className="btn" onClick={() => update(team.id, { inducements: [...draft.inducements, { key: 'mercenary', qty: 1 }] })}>+ {t.rules.mercenary}</button>
            <button type="button" className="btn" onClick={() => update(team.id, { inducements: [...draft.inducements, { key: 'star_player', qty: 1 }] })}>+ {t.rules.starPlayer}</button>
          </div>
        </>
    );
  };

  return (
      <section className={`card ${styles.rulesCard}`}>
        <h3 className="subhead">{t.rules.pregameTitle}</h3>
        <div className={styles.rulesGrid}>
          {teams.map(team => {
            const p = team.id === home.id ? pHome : pAway;
            const draft = drafts[team.id];
            return (
                <div key={team.id} className={styles.rulesTeam}>
                  <strong className={styles.rulesTeamName}>{team.name}</strong>
                  <div className={styles.diceRow}>
                    <label>{t.rules.fairWeather}
                      <input type="number" min="1" max="3" value={draft.fair_weather} onChange={e => update(team.id, { fair_weather: e.target.value })} className={styles.diceInput} />
                    </label>
                    <button type="button" className={styles.iconBtnSmall} onClick={() => update(team.id, { fair_weather: String(rollDie(3)) })} title={`${t.rules.roll} D3`} aria-label={`${t.rules.roll} D3`}><Dices size={18} /></button>
                    <span>{t.rules.fanFactor}: <strong>{p.ff ?? '—'}</strong> ({t.rules.dedicatedFans} {team.dedicated_fans})</span>
                  </div>
                  <span>{t.rules.available}: <strong>{p.available}</strong> · {t.rules.journeymenNeeded}: <strong>{p.journeymen}</strong></span>
                  {p.journeymen > 0 && p.options.length > 1 && (
                      <label className={styles.fieldLine}>{t.rules.journeymenFrom}
                        <select value={draft.journeyman_position} onChange={e => update(team.id, { journeyman_position: e.target.value })} className={styles.smallSelect}>
                          <option value="">—</option>
                          {p.options.map(o => <option key={o.key} value={o.key}>{o.name}</option>)}
                        </select>
                      </label>
                  )}
                  {draft.inducements.some(c => c.key === 'riotous_rookies') && (
                      <div className={styles.diceRow}>
                        <label>{t.rules.riotousRoll}
                          <input type="number" min="3" max="7" value={draft.riotous_roll} onChange={e => update(team.id, { riotous_roll: e.target.value })} className={styles.diceInput} />
                        </label>
                        <button type="button" className={styles.iconBtnSmall} onClick={() => update(team.id, { riotous_roll: String(rollDie(3) + rollDie(3) + 1) })} aria-label={t.rules.roll}><Dices size={18} /></button>
                      </div>
                  )}
                  <span>{t.rules.ctv}: <strong>{gp(p.ctv)}</strong> · {t.rules.treasury}: {gp(team.treasury + (reportOf(team.id)?.treasury_spent ?? 0))}</span>
                  <span className={styles.budgetLine}>{budgetLine(team)}</span>
                  {!equal && inducementRows(team)}
                  <span>{t.rules.total}: <strong>{gp(p.cost)} gp</strong></span>
                </div>
            );
          })}
        </div>
        {!equal && topUp > Math.min(PETTY_CASH_TREASURY_TOP_UP, lower.treasury + (reportOf(lower.id)?.treasury_spent ?? 0)) && (
            <p className={styles.rulesError}>{t.rules.pettyCash}: {gp(petty)} gp + max {gp(PETTY_CASH_TREASURY_TOP_UP)} {t.rules.topUp}</p>
        )}
        <div className={styles.rulesActions}>
          {isTrue(match.pregame_done) && <span className="tag tag-navy">{t.rules.pregameSaved}</span>}
          <button type="button" className="btn btn-gold" disabled={saving || teams.some(team => !drafts[team.id].fair_weather)} onClick={save}>
            <Save size={18} /> {t.rules.pregameSave}
          </button>
        </div>
      </section>
  );
}
