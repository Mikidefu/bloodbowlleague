'use client';
// Il kick-off sul telefono (p. 48). Chi calcia tira i dadi al tavolo e li scrive qui: il sito non tira niente,
// nemmeno i dadi che il risultato fa tirare dopo (i D6 dei due allenatori, il D3, il nuovo Meteo).
// A drive iniziato resta in vista la scheda del risultato: cosa è uscito, cosa cambia nella partita e per chi.

import { useState } from 'react';
import { ChevronDown, Dices } from 'lucide-react';
import { kickoffExtraDice, kickoffForTeam, kickoffHeadline, kickoffRolls, type ManualKickoffDice } from '@/lib/live/kickoff';
import type { KickoffResult, LiveState } from '@/lib/live/types';
import { getMatchTable, rowForTotal } from '@/lib/matchTables';
import companion from '../Companion.module.css';
import styles from './Kickoff.module.css';

type Lang = 'it' | 'en';
const KICKOFF_PAGE = getMatchTable('kickoff')!.page;

type EntryProps = {
  state: LiveState;
  teamName: (id: string | null) => string;
  language: Lang;
  onRecord: (dice: ManualKickoffDice) => Promise<unknown>;
};

export function KickoffEntry({ state, teamName, language, onRecord }: EntryProps) {
  const L = (it: string, en: string) => (language === 'it' ? it : en);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const kicking = state.kicking_team_id!;
  const receiving = kicking === state.home_team_id ? state.away_team_id! : state.home_team_id!;
  const n = (key: string) => Number(values[key]) || 0;
  const total = n('a') && n('b') ? n('a') + n('b') : 0;
  const row = total ? rowForTotal(getMatchTable('kickoff')!, total) : null;
  const extra = total ? kickoffExtraDice(total) : null;
  const ready = !!total
      && (!extra?.opposed || (n('kick') > 0 && n('recv') > 0))
      && (!extra?.d3 || n('d3') > 0)
      && (!extra?.weather || (n('w1') > 0 && n('w2') > 0));

  const record = async () => {
    const dice: ManualKickoffDice = { dice: [n('a'), n('b')] };
    if (extra?.opposed) dice.rolls = { [kicking]: n('kick'), [receiving]: n('recv') };
    if (extra?.d3) dice.d3 = n('d3');
    if (extra?.weather) dice.weather = [n('w1'), n('w2')];
    setBusy(true);
    await onRecord(dice);
    setBusy(false);
  };

  const die = (key: string, label: string, max = 6) => (
      <input className={companion.die} inputMode="numeric" maxLength={1} placeholder="?" aria-label={label} value={values[key] ?? ''}
        onChange={e => { const v = e.target.value.replace(/[^1-9]/g, ''); setValues(all => ({ ...all, [key]: v && Number(v) <= max ? v : '' })); }} />
  );
  const opposedRow = (key: 'kick' | 'recv', teamId: string) => {
    const modifier = extra!.opposed!.modifier(state.setup!.teams[teamId]);
    return (
        <label className={styles.extraRow}>
          <span>
            <b>{teamName(teamId)}</b>
            <small>D6{extra!.opposed!.label ? ` + ${modifier} ${extra!.opposed!.label}` : ''}{n(key) > 0 && extra!.opposed!.label ? ` = ${n(key) + modifier}` : ''}</small>
          </span>
          {die(key, `D6 ${teamName(teamId)}`)}
        </label>
    );
  };

  return (
      <section className={`panel-blood ${companion.kick}`}>
        <h2 className={companion.kickTitle}>{L(`Tocca a te: kick-off del drive ${state.drive + 1}`, `Your turn: drive ${state.drive + 1} kick-off`)}</h2>
        <p className={companion.help}>{L(`Dopo la deviazione del calcio, con la palla in aria (p. ${KICKOFF_PAGE}): tira 2D6 al tavolo e scrivi qui i due dadi.`, `After the kick deviates, with the ball in the air (p. ${KICKOFF_PAGE}): roll 2D6 at the table and enter both dice here.`)}</p>
        <div className={companion.diceRow}>
          {die('a', 'D6 1')}{die('b', 'D6 2')}
          {total > 0 && <span className={styles.total} aria-live="polite">= {total}</span>}
        </div>

        {row && (
            <div className={styles.preview}>
              <strong>{row.name}</strong>
              <p>{row.text[language]}</p>
            </div>
        )}

        {extra?.opposed && (
            <div className={styles.extra}>
              <span className={styles.extraTitle}>{L('Ogni allenatore tira un D6', 'Each coach rolls a D6')}</span>
              {opposedRow('kick', kicking)}
              {opposedRow('recv', receiving)}
              {extra.opposed.mascotRerollsOne && [kicking, receiving].some(id => state.setup?.teams[id]?.mascot) && (
                  <p className={companion.help}>{L('Team Mascot: un 1 naturale si ritira al tavolo, scrivi il dado finale.', 'Team Mascot: a natural 1 is re-rolled at the table, enter the final die.')}</p>
              )}
            </div>
        )}
        {extra?.d3 && (
            <div className={styles.extra}>
              <label className={styles.extraRow}>
                <span><b>D3</b><small>{total === 12 ? L('giocatori Stunned', 'players Stunned') : L('D3 + 3 giocatori', 'D3 + 3 players')}</small></span>
                {die('d3', 'D3', 3)}
              </label>
            </div>
        )}
        {extra?.weather && (
            <div className={styles.extra}>
              <span className={styles.extraTitle}>{L('Nuovo Meteo: 2D6', 'New Weather: 2D6')}</span>
              <div className={companion.diceRow}>{die('w1', L('Meteo D6 1', 'Weather D6 1'))}{die('w2', L('Meteo D6 2', 'Weather D6 2'))}</div>
            </div>
        )}

        <button type="button" className={`btn btn-gold ${companion.big}`} onClick={record} disabled={!ready || busy}>
          <Dices size={24} /> {L('Registra il kick-off', 'Record the kick-off')}
        </button>
        {total > 0 && !ready && <p className={companion.help}>{L('Mancano dei dadi: il sito non ne tira nessuno.', 'Some dice are missing: the site rolls none of them.')}</p>}
      </section>
  );
}

type CardProps = {
  kickoff: KickoffResult;
  myTeam: string;
  teamName: (id: string | null) => string;
  language: Lang;
  open: boolean;   // quando cambia la scheda si apre o si chiude; nel mezzo la apre e chiude chi la tocca
};

export function KickoffCard({ kickoff, myTeam, teamName, language, open }: CardProps) {
  const L = (it: string, en: string) => (language === 'it' ? it : en);
  const row = rowForTotal(getMatchTable('kickoff')!, kickoff.total);
  const forMe = kickoffForTeam(kickoff, myTeam, language);
  const rolls = kickoffRolls(kickoff, id => teamName(id), language);
  // Il nome è già il titolo della scheda: della frase resta solo l'effetto ("un Team Re-roll per questo drive a...")
  const headline = kickoffHeadline(kickoff, id => teamName(id), language);
  const effect = headline === kickoff.name ? '' : headline.startsWith(`${kickoff.name}: `) ? headline.slice(kickoff.name.length + 2) : headline;
  const tag = forMe && { good: L('A tuo favore', 'In your favour'), bad: L('Contro di te', 'Against you'), act: L('Tocca a te', 'Your move'), info: L('Per te', 'For you') }[forMe.tone];

  return (
      <details className={`panel-slate ${styles.card}`} open={open}>
        <summary>
          <span className={styles.micro}>Kick-off · Drive {kickoff.drive}</span>
          <span className={styles.head}>
            <span className={styles.dice} aria-label={`${kickoff.dice.join(' + ')} = ${kickoff.total}`}>
              {kickoff.dice.map((d, i) => <span key={i} className={styles.face} aria-hidden="true">{d}</span>)}
              <span className={styles.sum} aria-hidden="true">= {kickoff.total}</span>
            </span>
            <ChevronDown size={22} className={styles.chevron} aria-hidden="true" />
          </span>
          <strong className={styles.name}>{kickoff.name}</strong>
          {effect && <span className={styles.headline}>{effect.charAt(0).toUpperCase() + effect.slice(1)}</span>}
        </summary>

        <div className={styles.cardBody}>
          {forMe && (
              <p className={`${styles.forMe} ${styles[forMe.tone]}`}>
                <span className={`tag ${forMe.tone === 'bad' ? 'tag-red' : forMe.tone === 'good' ? '' : 'tag-navy'}`}>{tag}</span>
                {forMe.text}
              </p>
          )}
          {rolls.length > 0 && (
              <div>
                <span className={styles.micro}>{L('I tiri', 'The rolls')}</span>
                <ul className={styles.rolls}>{rolls.map((line, i) => <li key={i}>{line}</li>)}</ul>
              </div>
          )}
          {row && (
              <div>
                <span className={styles.micro}>{L(`La regola (p. ${KICKOFF_PAGE})`, `The rule (p. ${KICKOFF_PAGE})`)}</span>
                <p className={styles.rule}>{row.text[language]}</p>
              </div>
          )}
        </div>
      </details>
  );
}
