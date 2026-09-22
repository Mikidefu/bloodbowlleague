'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Dices } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { MISTAKE_THRESHOLD, expensiveMistake, mistakeExtraRoll, rollDie } from '@/lib/leagueRules';
import { mustAdvance, onDraftList } from '@/lib/players';
import { getPosition, getRoster, hasRule } from '@/lib/rosters';
import { isTrue, type PendingPostgame, type TeamWithPlayers } from '@/lib/types';
import styles from './TeamDetails.module.css';

type Props = { team: TeamWithPlayers; isAdmin: boolean; onChange: () => void };

// Sequenza post-partita ancora aperta per la squadra (p. 95): incassi e fan sono già applicati dal referto;
// qui restano Journeymen (step 5) ed Expensive Mistakes (step 6). Avanzamenti e ingaggi si fanno nel roster:
// il pannello ricorda quelli obbligatori (p. 96) e, se il capitano è morto, la nomina del nuovo (p. 155).
export default function PostgamePanel({ team, isAdmin, onChange }: Props) {
  const { t } = useLanguage();
  const pending = team.pending_postgame ?? [];
  const mustAdvanceNow = team.players.filter(p => mustAdvance(p));
  const roster = getRoster(team.roster);
  const captainVacant = hasRule(roster, 'Team Captain')
      && team.postgame_phase !== 'closed'
      && !team.players.some(p => isTrue(p.is_captain) && onDraftList(p))
      && team.players.some(p => isTrue(p.is_captain) && isTrue(p.dead));
  if (!pending.length && !captainVacant) return null;

  return (
      <section className={`card ${styles.postgame}`} aria-label={t.rules.postgameTitle}>
        <h3 className="subhead">{t.rules.postgameTitle}</h3>
        <p className={styles.postgameSteps}>{t.rules.postgameSteps}</p>
        {mustAdvanceNow.length > 0 && (
            <div className={styles.pendingBlock}>
              <strong>{t.rules.mustAdvanceList}</strong>
              <ul className={styles.mustAdvanceList}>
                {mustAdvanceNow.map(p => <li key={p.id}>{p.name} · {p.spp} SPP</li>)}
              </ul>
            </div>
        )}
        {captainVacant && isAdmin && <CaptainPicker team={team} onChange={onChange} />}
        {pending.map(p => (
            <PendingMatch key={p.match_id} team={team} pending={p} isAdmin={isAdmin} onChange={onChange} />
        ))}
      </section>
  );
}

// Nuovo Team Captain (p. 155): chiunque sia sulla Team Draft List tranne i Big Guy e i Journeymen
export function CaptainPicker({ team, onChange }: { team: TeamWithPlayers; onChange: () => void }) {
  const { t } = useLanguage();
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false);
  const roster = getRoster(team.roster);
  const candidates = team.players.filter(p => onDraftList(p) && !isTrue(p.journeyman)
      && !getPosition(roster, p.position_key)?.keywords.includes('Big Guy'));

  const appoint = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/teams/${team.id}/captain`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ player_id: choice }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) alert(data.error || 'Error');
      else onChange();
    } finally {
      setBusy(false);
    }
  };

  return (
      <div className={styles.pendingBlock}>
        <strong>{t.rules.newCaptain}</strong>
        <p className={styles.postgameSteps}>{t.rules.newCaptainHint}</p>
        <div className={styles.captainRow}>
          <select value={choice} onChange={e => setChoice(e.target.value)} aria-label={t.rules.newCaptain}>
            <option value="">—</option>
            {candidates.map(p => <option key={p.id} value={p.id}>{p.jersey_number ? `#${p.jersey_number} ` : ''}{p.name} · {p.role}</option>)}
          </select>
          <button type="button" className="btn btn-primary" disabled={busy || !choice} onClick={appoint}>{t.rules.appoint}</button>
        </div>
      </div>
  );
}

function PendingMatch({ team, pending, isAdmin, onChange }: { team: TeamWithPlayers; pending: PendingPostgame; isAdmin: boolean; onChange: () => void }) {
  const { t } = useLanguage();
  const [roll, setRoll] = useState('');
  const [extra, setExtra] = useState('');
  const [busy, setBusy] = useState(false);

  const journeymen = team.players.filter(p => isTrue(p.journeyman) && p.journeyman_match_id === pending.match_id && !isTrue(p.left_team));
  const treasury = team.treasury || 0;
  const needsRoll = treasury >= MISTAKE_THRESHOLD;
  const d6 = Number(roll);
  const preview = needsRoll && d6 >= 1 && d6 <= 6 ? expensiveMistake(treasury, d6) : null;
  const extraKind = mistakeExtraRoll(preview);

  const post = async (url: string, body: unknown) => {
    setBusy(true);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) alert(data.error || 'Error');
      else onChange();
    } finally {
      setBusy(false);
    }
  };

  const fmt = (n: number) => `${n > 0 ? '+' : ''}${n.toLocaleString()}`;

  return (
      <div className={styles.pendingMatch}>
        <div className={styles.pendingHead}>
          <Link href={`/schedule/${pending.match_id}`} className={styles.matchLink}>
            {t.rules.postgameVs.replace('{opponent}', pending.opponent_name).replace('{round}', String(pending.round))}
          </Link>
          <span>{t.rules.winnings}: <strong>{fmt(pending.winnings)} gp</strong></span>
          <span>{t.rules.dfChange}: <strong>{fmt(pending.df_change)}</strong></span>
        </div>

        {journeymen.length > 0 && (
            <div className={styles.pendingBlock}>
              <strong>{t.rules.journeyman} ({journeymen.length})</strong>
              <ul className={styles.pendingList}>
                {journeymen.map(j => (
                    <li key={j.id}>
                      <span>{j.name} · {j.role} · {j.spp} SPP</span>
                      {isAdmin && (
                          <button type="button" className="btn btn-navy" disabled={busy || treasury < j.value}
                                  onClick={() => post(`/api/players/${j.id}/hire`, { name: prompt(t.rules.playerName, j.name) ?? j.name })}>
                            {t.rules.hireJourneyman.replace('{cost}', j.value.toLocaleString())}
                          </button>
                      )}
                    </li>
                ))}
              </ul>
              <p className={styles.postgameSteps}>{t.rules.journeymenNote}</p>
            </div>
        )}

        {isAdmin && (
            <div className={styles.pendingBlock}>
              <strong>{t.rules.mistakesTitle}</strong> · {t.rules.treasury}: {treasury.toLocaleString()} gp
              {!needsRoll ? (
                  <div className={styles.diceRow}>
                    <span>{t.rules.mistakesNoRoll}</span>
                    <button type="button" className="btn btn-primary" disabled={busy} onClick={() => post(`/api/schedule/${pending.match_id}/mistakes`, { team_id: team.id })}>
                      {t.rules.mistakesRoll}
                    </button>
                  </div>
              ) : (
                  <div className={styles.diceRow}>
                    <label>{t.rules.d6}
                      <input type="number" min="1" max="6" value={roll} onChange={e => setRoll(e.target.value)} className={styles.diceInput} />
                    </label>
                    <button type="button" className={styles.iconBtn} title={t.rules.roll} aria-label={`${t.rules.roll} D6`} onClick={() => setRoll(String(rollDie(6)))}><Dices size={20} /></button>
                    {preview && <span className="tag tag-navy">{t.rules.mistakeResult[preview]}</span>}
                    {extraKind && (
                        <>
                          <label>{extraKind === 'd3' ? t.rules.d3 : t.rules.twoD6}
                            <input type="number" min={extraKind === 'd3' ? 1 : 2} max={extraKind === 'd3' ? 3 : 12} value={extra} onChange={e => setExtra(e.target.value)} className={styles.diceInput} />
                          </label>
                          <button type="button" className={styles.iconBtn} title={t.rules.roll} aria-label={t.rules.roll}
                                  onClick={() => setExtra(String(extraKind === 'd3' ? rollDie(3) : rollDie(6) + rollDie(6)))}><Dices size={20} /></button>
                        </>
                    )}
                    <button type="button" className="btn btn-primary" disabled={busy || !preview || (!!extraKind && !extra)}
                            onClick={() => post(`/api/schedule/${pending.match_id}/mistakes`, { team_id: team.id, roll: d6, extra: Number(extra) || undefined })}>
                      {t.rules.mistakesRoll}
                    </button>
                  </div>
              )}
            </div>
        )}
      </div>
  );
}
