'use client';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import {
  CASUALTY_RESULTS, CONCEDE_QUIT_MAX_ROLL, CONCEDE_QUIT_MIN_ADVANCEMENTS, GETTING_EVEN_TARGET, LASTING_INJURIES,
  MATCH_OUTCOMES, casualtyInfo, dedicatedFansChange, type CasualtyResult, type InjuryStat, type MatchOutcome,
} from '@/lib/leagueRules';
import { isLeagueMatch } from '@/lib/matchTypes';
import type { MatchDetails, MatchTeam } from '@/lib/types';
import DiceRoll, { diceDone, diceTotal, emptyDice, type DiceValues } from '@/components/match/DiceRoll';
import { WizardStepCard, WizardSteps } from '@/components/match/Wizard';
import wz from '@/components/match/Wizard.module.css';
import { casualtyForRoll, toNumericInput, zeroAsEmpty, type NumericInput, type PlayerStatDraft, type StatField, type TeamResultDraft } from './reportModel';
import styles from './MatchDetails.module.css';

type Props = {
  match: MatchDetails;
  playerStats: PlayerStatDraft[];
  onStatChange: (playerId: string, field: StatField, value: NumericInput) => void;
  updatePlayer: (playerId: string, patch: Partial<PlayerStatDraft>) => void;
  outcome: MatchOutcome;
  setOutcome: (o: MatchOutcome) => void;
  concededTeam: string;
  setConcededTeam: (id: string) => void;
  penaltyWinner: string;
  setPenaltyWinner: (id: string) => void;
  teamResults: Record<string, TeamResultDraft>;
  updateTeamResult: (teamId: string, patch: Partial<TeamResultDraft>) => void;
  scores: { home: NumericInput; away: NumericInput; setHome: (v: NumericInput) => void; setAway: (v: NumericInput) => void };
  projected: { h: number; a: number; result: (teamId: string) => 'win' | 'draw' | 'loss' };
  winningsPreview: (teamId: string) => number;
  onSave: () => Promise<boolean>;
  saving: boolean;
  onExit: () => void;
};

const STEPS = ['outcome', 'stats', 'injuries', 'mvp', 'fans', 'confirm'] as const;
const STAT_FIELDS: StatField[] = ['td', 'cas', 'int', 'comp', 'ttm', 'landing'];
const gp = (n: number) => n.toLocaleString();
const dice1 = (s: string): DiceValues => (s ? [Number(s)] : emptyDice());

/** Referto guidato (pp. 67-68, 80-83, 95-96, 101-103): esito, statistiche, infortuni, MVP, incassi e fan. */
export default function ReportWizard(props: Props) {
  const { match, playerStats, outcome, concededTeam, teamResults } = props;
  const { language, t } = useLanguage();
  const L = (it: string, en: string) => (language === 'it' ? it : en);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const go = (n: number) => { setError(null); setStep(n); document.getElementById('match-flow')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  const teams = [match.home_team_id, match.away_team_id].map(id => match.teams.find(tm => tm.id === id)).filter(Boolean) as MatchTeam[];
  const [home, away] = teams;
  const played = outcome === 'played' || outcome === 'conceded' || outcome === 'conceded_no_penalty';
  const needsConceder = outcome !== 'played' && outcome !== 'forfeit_both';
  const knockout = !isLeagueMatch(match.match_type);
  const colorOf = (id: string) => (id === match.home_team_id ? match.home_color : match.away_color);
  const roster = (teamId: string) => playerStats.filter(p => p.team_id === teamId && !p.unavailable);
  const teamBox = (team: MatchTeam, children: React.ReactNode) => (
      <div key={team.id} className={wz.team} style={{ '--team-color': colorOf(team.id) ?? undefined } as React.CSSProperties}>
        <h4 className={wz.teamName}>{team.name}</h4>
        {children}
      </div>
  );
  const facts = (rows: [string, React.ReactNode][]) => (
      <dl className={wz.facts}>{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
  );

  // MVP ammessi per squadra (pp. 96, 101-102)
  const mvpMax = (teamId: string) => {
    const conceder = needsConceder ? concededTeam : '';
    const opponentConceded = !!conceder && conceder !== teamId && (outcome === 'conceded' || outcome === 'forfeit_commitments');
    if (outcome === 'forfeit_both' || (conceder === teamId && outcome !== 'conceded_no_penalty')) return 0;
    return opponentConceded ? 2 : 1;
  };
  const mvpsOf = (teamId: string) => roster(teamId).filter(p => Number(p.mvp) > 0);

  const stepTitles = [L('Esito', 'Outcome'), L('Statistiche', 'Stats'), L('Infortuni', 'Injuries'), 'MVP', L('Incassi e fan', 'Winnings and fans'), L('Conferma', 'Confirm')];
  let card: React.ReactNode = null;

  switch (STEPS[step]) {
    case 'outcome': {
      const blocker = needsConceder && !concededTeam ? L('Indica chi ha concesso', 'Say who conceded') : null;
      card = (
          <WizardStepCard
              title={L('Com\'è andata?', 'How did it go?')}
              page="pp. 101-102"
              explain={[
                L('Quasi sempre la partita è stata giocata fino in fondo: scegli "Giocata" e vai avanti.', 'Almost always the match was played to the end: pick "Played" and move on.'),
                L('Se un allenatore ha concesso durante la partita, perde: l\'avversario vince almeno 2-0, chi concede perde i suoi SPP e i giocatori con 3 o più avanzamenti rischiano di andarsene. "Concede Without Penalty" vale solo quando chi concede non può più schierare giocatori.',
                  'If a coach conceded during the match, they lose: the opponent wins at least 2-0, the conceding team loses its SPP and players with 3 or more advancements may leave. "Concede Without Penalty" only applies when the conceding team can no longer field players.'),
                L('Una partita non giocata entro il limite è una sconfitta per tutte e due. Se invece un allenatore rinuncia per impegni personali, l\'avversario vince e tira un D6 per l\'incasso.',
                  'A match not played by the deadline is a loss for both. If a coach withdraws for personal commitments, the opponent wins and rolls a D6 for the winnings.'),
              ]}
              onBack={props.onExit}
              onNext={() => go(1)}
              blocker={blocker}
          >
            <label className={wz.field}>{t.rules.outcome}
              <select value={outcome} onChange={e => props.setOutcome(e.target.value as MatchOutcome)}>
                {MATCH_OUTCOMES.map(o => <option key={o} value={o}>{t.rules.outcomes[o]}</option>)}
              </select>
            </label>
            {needsConceder && (
                <label className={wz.field}>{t.rules.concededBy}
                  <select value={concededTeam} onChange={e => props.setConcededTeam(e.target.value)}>
                    <option value="">—</option>
                    {teams.map(tm => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
                  </select>
                </label>
            )}
          </WizardStepCard>
      );
      break;
    }

    case 'stats': {
      const tie = props.projected.h === props.projected.a;
      const needPenalty = knockout && played && tie && !props.penaltyWinner;
      card = (
          <WizardStepCard
              title={played ? L('Touchdown e statistiche', 'Touchdowns and stats') : L('Nessuna statistica', 'No stats')}
              page="pp. 95-96"
              explain={played ? [
                L('Scrivi per ogni giocatore cosa ha fatto: il sito calcola gli SPP. TD vale 3, CAS 2 (solo le Casualty causate con un Block), INT 2, CMP 1 per un passaggio completato, TTM 1 per un Throw Team-mate riuscito, ATT 1 per chi atterra bene dopo un lancio.',
                  'Record what each player did: the app works out the SPP. TD is worth 3, CAS 2 (only Casualties caused by a Block), INT 2, CMP 1 for a completed pass, TTM 1 for a successful Throw Team-mate, LAND 1 for a safe landing after being thrown.'),
                L('Il punteggio si somma dai TD dei giocatori. Se ha segnato uno Star Player o un Mercenario, che non sono nel roster, correggi il totale a mano.',
                  'The score adds up the players\' TDs. If a Star Player or a Mercenary scored, since they are not on the roster, fix the total by hand.'),
              ] : [
                L('La partita non è stata giocata: niente touchdown, statistiche né infortuni. Si registrano solo gli MVP, al passo dopo.', 'The match was not played: no touchdowns, stats or injuries. Only the MVPs are recorded, in the next step.'),
              ]}
              onBack={() => go(0)}
              onNext={() => go(played ? 2 : 3)}
              blocker={needPenalty ? L('Playoff in parità: indica chi ha vinto ai rigori', 'Play-off tied: say who won the penalty shoot-out') : null}
          >
            {played && teams.map(team => (
                <div key={team.id} className={wz.team} style={{ '--team-color': colorOf(team.id) ?? undefined } as React.CSSProperties}>
                  <h4 className={wz.teamName}>{team.name}</h4>
                  <div className="table-container">
                    <table className={`data-table ${styles.statsTable}`}>
                      <thead>
                        <tr>
                          <th className="num">N°</th>
                          <th>{t.match.thPlayer}</th>
                          {STAT_FIELDS.map(f => <th key={f} className="num">{f === 'comp' ? 'CMP' : f === 'ttm' ? t.rules.ttm : f === 'landing' ? t.rules.landing : f.toUpperCase()}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {roster(team.id).map(p => (
                            <tr key={p.player_id}>
                              <td className="num">{p.jersey_number ?? '-'}</td>
                              <td>{p.name}</td>
                              {STAT_FIELDS.map(f => (
                                  <td key={f} className={`num ${styles.statCell}`}>
                                    <input type="number" min="0" inputMode="numeric" value={zeroAsEmpty(p[f])} placeholder="0" className={styles.statsInput}
                                           aria-label={`${p.name} ${f}`} onChange={e => props.onStatChange(p.player_id, f, toNumericInput(e.target.value))} />
                                  </td>
                              ))}
                            </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <label className={wz.field}>{L('Touchdown della squadra (totale)', 'Team touchdowns (total)')}
                    <input type="number" min="0" inputMode="numeric" className={styles.statsInput}
                           value={zeroAsEmpty(team.id === home.id ? props.scores.home : props.scores.away)} placeholder="0"
                           onChange={e => (team.id === home.id ? props.scores.setHome : props.scores.setAway)(toNumericInput(e.target.value))} />
                  </label>
                </div>
            ))}
            {knockout && played && tie && (
                <label className={wz.field}>{t.rules.penaltyWinner} <small>{L('Playoff pari dopo i supplementari: si decide ai rigori (p. 83)', 'Play-off level after extra time: decided on penalties (p. 83)')}</small>
                  <select value={props.penaltyWinner} onChange={e => props.setPenaltyWinner(e.target.value)}>
                    <option value="">—</option>
                    {teams.map(tm => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
                  </select>
                </label>
            )}
            <p className={wz.note}>{home.name} <strong>{props.projected.h} – {props.projected.a}</strong> {away.name}</p>
          </WizardStepCard>
      );
      break;
    }

    case 'injuries':
      card = <InjuryStep {...props} teams={teams} onBack={() => go(1)} onNext={() => go(3)} />;
      break;

    case 'mvp':
      card = (
          <WizardStepCard
              title="MVP"
              page="p. 96"
              explain={[
                L('Ogni allenatore sceglie l\'MVP della propria squadra tra chi ha giocato: vale 4 SPP. Il libro lo fa estrarre: si nominano fino a 6 giocatori, si numerano da 1 a 6 e si tira un D6.',
                  'Each coach picks their team\'s MVP among those who played: it is worth 4 SPP. The book has it drawn: nominate up to 6 players, number them 1 to 6 and roll a D6.'),
                L('Se l\'avversario ha concesso ne spettano due; chi concede non ne ha.', 'If the opponent conceded you get two; the conceding team gets none.'),
              ]}
              onBack={() => go(played ? 2 : 1)}
              onNext={() => go(4)}
          >
            <div className={wz.teams}>
              {teams.map(team => teamBox(team, <MvpPicker team={team} players={roster(team.id)} max={mvpMax(team.id)} chosen={mvpsOf(team.id)} onStatChange={props.onStatChange} />))}
            </div>
          </WizardStepCard>
      );
      break;

    case 'fans': {
      const missing: string[] = [];
      card = (
          <WizardStepCard
              title={L('Incassi e Dedicated Fans', 'Winnings and Dedicated Fans')}
              page="pp. 95, 101-102"
              explain={[
                L('Gli incassi li calcola il sito: metà del pubblico (la somma dei due Fan Factor) più i touchdown segnati, più 1 se nessuno ha fatto Stalling, per 10.000.',
                  'The app works out the winnings: half the Fan Attendance (both Fan Factors added) plus the touchdowns scored, plus 1 if nobody was Stalling, times 10,000.'),
                L('Stalling è tenere la palla in End Zone senza segnare per far passare il tempo. Chi vince tira un D6: se è pari o più alto dei suoi Dedicated Fans ne guadagna uno. Chi perde tira un D6: se è più basso ne perde uno. Il pareggio non cambia nulla.',
                  'Stalling is sitting on the ball instead of scoring to run the clock. The winner rolls a D6: equal to or higher than their Dedicated Fans gains one. The loser rolls a D6: lower loses one. A draw changes nothing.'),
              ]}
              onBack={() => go(3)}
              onNext={() => go(5)}
              blocker={(() => {
                for (const team of teams) {
                  const r = teamResults[team.id];
                  const result = props.projected.result(team.id);
                  const isConceder = needsConceder && concededTeam === team.id;
                  const dfDie = outcome === 'conceded' && isConceder ? 3 : result === 'draw' ? 0 : 6;
                  if (dfDie && !r?.df_roll) missing.push(team.name);
                  if (outcome === 'forfeit_commitments' && concededTeam && !isConceder && !r?.commitments_roll) missing.push(team.name);
                  if (outcome === 'conceded' && isConceder) {
                    const veterans = roster(team.id).filter(p => p.advancements >= CONCEDE_QUIT_MIN_ADVANCEMENTS);
                    if (veterans.some(v => !r?.quit_rolls[v.player_id])) missing.push(team.name);
                  }
                }
                return missing.length ? L(`Mancano dei tiri: ${[...new Set(missing)].join(', ')}`, `Rolls missing: ${[...new Set(missing)].join(', ')}`) : null;
              })()}
          >
            <div className={wz.teams}>
              {teams.map(team => {
                const r = teamResults[team.id] ?? { stalling: false, df_roll: '', commitments_roll: '', quit_rolls: {} };
                const result = props.projected.result(team.id);
                const isConceder = needsConceder && concededTeam === team.id;
                const dfDie = outcome === 'conceded' && isConceder ? 3 : result === 'draw' ? 0 : 6;
                const df = team.dedicated_fans;
                const change = !r.df_roll ? null : outcome === 'conceded' && isConceder ? -Math.min(Number(r.df_roll), df - 1) : dedicatedFansChange(result, df, Number(r.df_roll));
                const veterans = outcome === 'conceded' && isConceder ? roster(team.id).filter(p => p.advancements >= CONCEDE_QUIT_MIN_ADVANCEMENTS) : [];
                return teamBox(team, (
                    <>
                      {facts([
                        [L('Risultato', 'Result'), result === 'win' ? L('Vittoria', 'Win') : result === 'loss' ? L('Sconfitta', 'Loss') : L('Pareggio', 'Draw')],
                        [L('Incasso', 'Winnings'), `${gp(props.winningsPreview(team.id))} gp`],
                        ['Dedicated Fans', df],
                      ])}
                      {(outcome === 'played' || outcome === 'conceded_no_penalty') && (
                          <label className={wz.check}>
                            <input type="checkbox" checked={r.stalling} onChange={e => props.updateTeamResult(team.id, { stalling: e.target.checked })} /> {t.rules.stalling}
                          </label>
                      )}
                      {dfDie > 0 && (
                          <DiceRoll label={dfDie === 3 ? L('Dedicated Fans persi (concessione)', 'Dedicated Fans lost (conceded)') : 'Dedicated Fans'} sides={dfDie}
                                    values={dice1(r.df_roll)} onChange={v => props.updateTeamResult(team.id, { df_roll: v[0] ? String(v[0]) : '' })} />
                      )}
                      {change !== null && (
                          <p className={wz.note}>Dedicated Fans: {df} → <strong>{df + change}</strong></p>
                      )}
                      {dfDie === 0 && <p className={wz.note}>{L('Pareggio: i Dedicated Fans restano uguali.', 'Draw: Dedicated Fans stay the same.')}</p>}
                      {outcome === 'forfeit_commitments' && concededTeam && !isConceder && (
                          <DiceRoll label={t.rules.commitmentsRoll} sides={6} values={dice1(r.commitments_roll)}
                                    onChange={v => props.updateTeamResult(team.id, { commitments_roll: v[0] ? String(v[0]) : '' })} />
                      )}
                      {veterans.length > 0 && (
                          <>
                            <p className={wz.warn}>{L(`Hanno concesso: chi ha 3 o più avanzamenti se ne va con 1-${CONCEDE_QUIT_MAX_ROLL} (p. 101).`, `They conceded: players with 3+ advancements leave on 1-${CONCEDE_QUIT_MAX_ROLL} (p. 101).`)}</p>
                            {veterans.map(v => (
                                <DiceRoll key={v.player_id} label={v.name} sides={6} values={dice1(r.quit_rolls[v.player_id] ?? '')}
                                          onChange={val => props.updateTeamResult(team.id, { quit_rolls: { ...r.quit_rolls, [v.player_id]: val[0] ? String(val[0]) : '' } })} />
                            ))}
                          </>
                      )}
                    </>
                ));
              })}
            </div>
          </WizardStepCard>
      );
      break;
    }

    case 'confirm': {
      const injured = playerStats.filter(p => p.injury);
      card = (
          <WizardStepCard
              title={L('Riepilogo e conferma', 'Summary and confirm')}
              explain={[
                L('Controlla il referto. Con la conferma il sito assegna gli SPP, aggiorna Treasury e Dedicated Fans e applica gli infortuni.',
                  'Check the report. Confirming awards the SPP, updates Treasury and Dedicated Fans and applies the injuries.'),
                L('Fino agli Expensive Mistakes potrai ancora correggerlo: il sito ricalcola tutto.', 'Until Expensive Mistakes you can still correct it: the app recalculates everything.'),
              ]}
              onBack={() => go(4)}
              onNext={async () => { setError(null); if (!(await props.onSave())) setError(L('Il salvataggio non è riuscito: controlla il messaggio e correggi.', 'Saving failed: check the message and fix it.')); }}
              nextLabel={L('Conferma il referto', 'Confirm the report')}
              busy={props.saving}
              blocker={error}
          >
            <p className={wz.note}>{home.name} <strong>{props.projected.h} – {props.projected.a}</strong> {away.name} · {t.rules.outcomes[outcome]}</p>
            <div className={wz.teams}>
              {teams.map(team => teamBox(team, facts([
                [L('Incasso', 'Winnings'), `${gp(props.winningsPreview(team.id))} gp`],
                ['MVP', mvpsOf(team.id).map(p => p.name).join(', ') || '—'],
                [L('Infortuni', 'Injuries'), injured.filter(p => p.team_id === team.id).map(p => `${p.name} (${p.injury})`).join(', ') || '—'],
              ])))}
            </div>
          </WizardStepCard>
      );
      break;
    }
  }

  return (
      <div>
        <WizardSteps steps={STEPS.map((key, i) => ({ key, title: stepTitles[i] }))} current={step} onJump={go} />
        {card}
      </div>
  );
}

// ------------------------------------------------------------------
// Infortuni: giocatore, D16 (+ Niggling), Lasting Injury, Getting Even
// ------------------------------------------------------------------
function InjuryStep({ playerStats, updatePlayer, teams, onBack, onNext }: Props & { teams: MatchTeam[]; onBack: () => void; onNext: () => void }) {
  const { language } = useLanguage();
  const L = (it: string, en: string) => (language === 'it' ? it : en);
  const [playerId, setPlayerId] = useState('');
  const [d16, setD16] = useState<DiceValues>(emptyDice());
  const [override, setOverride] = useState<CasualtyResult | ''>('');
  const [lasting, setLasting] = useState<DiceValues>(emptyDice());
  const [lastingStat, setLastingStat] = useState<InjuryStat | ''>('');
  const [getEven, setGetEven] = useState<DiceValues>(emptyDice());
  const [keyword, setKeyword] = useState('');

  const player = playerStats.find(p => p.player_id === playerId);
  const modifier = player?.niggling ?? 0;
  const rolled = diceDone(d16, 16) ? casualtyForRoll(diceTotal(d16, modifier)) : null;
  const result = override || rolled;
  const lastingRoll = diceDone(lasting, 6) ? LASTING_INJURIES.find(l => l.d6.includes(lasting[0]!)) : null;
  const stat = lastingStat || lastingRoll?.stat || '';
  const missNext = !!result && !!casualtyInfo(result)?.missNextGame;
  const evenDone = diceDone(getEven, 6);
  const gotHatred = evenDone && getEven[0]! >= GETTING_EVEN_TARGET;
  const ready = !!player && !!result && (result !== 'LI' || !!stat) && (!missNext || evenDone) && (!gotHatred || keyword.trim().length > 0);

  const reset = () => { setPlayerId(''); setD16(emptyDice()); setOverride(''); setLasting(emptyDice()); setLastingStat(''); setGetEven(emptyDice()); setKeyword(''); };
  const add = () => {
    if (!player || !result) return;
    updatePlayer(player.player_id, { injury: result, injuryStat: result === 'LI' ? stat as InjuryStat : '', hatred: gotHatred ? keyword.trim() : '' });
    reset();
  };

  const injured = playerStats.filter(p => p.injury);
  const nameOf = (key: string) => CASUALTY_RESULTS.find(c => c.key === key)?.name ?? key;

  return (
      <WizardStepCard
          title={L('Infortuni', 'Injuries')}
          page="pp. 66-68"
          explain={[
            L('Registra qui ogni giocatore che ha subito una Casualty, di tutte e due le squadre: è diverso dalla colonna CAS di prima, che contava chi l\'ha causata. KO e Stunned non si registrano.',
              'Record here every player who suffered a Casualty, from both teams: this is not the CAS column from before, which counted who caused it. KOs and Stunned are not recorded.'),
            L('Tira il D16 sulla Casualty Table: il sito aggiunge da solo +1 per ogni Niggling Injury che il giocatore ha già. Con un Lasting Injury tiri anche un D6 per la caratteristica. Dopo un SH, SI o LI c\'è il Getting Even: con 4+ sul D6 il giocatore ottiene Hatred verso una keyword di chi l\'ha infortunato.',
              'Roll the D16 on the Casualty Table: the app adds +1 for each Niggling Injury the player already has. On a Lasting Injury you also roll a D6 for the characteristic. After SH, SI or LI comes Getting Even: on a 4+ on the D6 the player gains Hatred towards a keyword of whoever injured them.'),
            L('Se hai usato l\'Apothecary, la Regeneration o un giocatore Stunty ha preso Badly Hurt dalla sua tabella, scegli a mano il risultato finale.',
              'If you used the Apothecary or Regeneration, or a Stunty player got Badly Hurt from their own table, pick the final result by hand.'),
          ]}
          onBack={onBack}
          onNext={onNext}
          blocker={playerId ? L('Aggiungi o annulla l\'infortunio in corso', 'Add or cancel the injury in progress') : null}
      >
        {injured.length > 0 ? (
            <ul className={wz.list}>
              {injured.map(p => (
                  <li key={p.player_id} className={wz.listRow}>
                    <span><strong>{p.name}</strong> ({teams.find(tm => tm.id === p.team_id)?.name}) · {nameOf(p.injury)}{p.injuryStat ? ` · -1 ${p.injuryStat.toUpperCase()}` : ''}{p.hatred ? ` · Hatred (${p.hatred})` : ''}</span>
                    <button type="button" className="btn" onClick={() => updatePlayer(p.player_id, { injury: '', injuryStat: '', hatred: '' })}><Trash2 size={16} /> {L('Togli', 'Remove')}</button>
                  </li>
              ))}
            </ul>
        ) : (
            <p className={wz.note}>{L('Nessun infortunio registrato. Se non ce ne sono stati, continua.', 'No injuries recorded. If there were none, continue.')}</p>
        )}

        <label className={wz.field}>{L('Aggiungi un infortunio: chi l\'ha subito?', 'Add an injury: who suffered it?')}
          <select value={playerId} onChange={e => { reset(); setPlayerId(e.target.value); }}>
            <option value="">—</option>
            {teams.map(team => (
                <optgroup key={team.id} label={team.name}>
                  {playerStats.filter(p => p.team_id === team.id && !p.unavailable && !p.injury).map(p => (
                      <option key={p.player_id} value={p.player_id}>{p.jersey_number ? `#${p.jersey_number} ` : ''}{p.name}</option>
                  ))}
                </optgroup>
            ))}
          </select>
        </label>

        {player && (
            <>
              <DiceRoll label="Casualty Table" sides={16} modifier={modifier} values={d16} onChange={v => { setD16(v); setOverride(''); }}
                        hint={modifier ? L(`+${modifier} per le Niggling Injury già subite`, `+${modifier} for Niggling Injuries already suffered`) : undefined} />
              <label className={wz.field}>{L('Risultato', 'Result')}
                <select value={result ?? ''} onChange={e => setOverride(e.target.value as CasualtyResult)}>
                  <option value="">—</option>
                  {CASUALTY_RESULTS.map(c => <option key={c.key} value={c.key}>{c.name} ({c.d16})</option>)}
                </select>
              </label>
              {result === 'LI' && (
                  <>
                    <DiceRoll label="Lasting Injury" sides={6} values={lasting} onChange={v => { setLasting(v); setLastingStat(''); }} />
                    <label className={wz.field}>{L('Caratteristica ridotta', 'Reduced characteristic')}
                      <select value={stat} onChange={e => setLastingStat(e.target.value as InjuryStat)}>
                        <option value="">—</option>
                        {LASTING_INJURIES.map(l => <option key={l.stat} value={l.stat}>{l.d6.join('-')}: {l.name} (-1 {l.stat.toUpperCase()})</option>)}
                      </select>
                    </label>
                  </>
              )}
              {missNext && (
                  <>
                    <DiceRoll label="Getting Even (4+)" sides={6} values={getEven} onChange={setGetEven} />
                    {evenDone && !gotHatred && <p className={wz.note}>{L('Niente Hatred questa volta.', 'No Hatred this time.')}</p>}
                    {gotHatred && (
                        <label className={wz.field}>{L('Keyword di chi l\'ha infortunato (non Big Guy, Blitzer, Blocker, Catcher, Lineman, Runner, Special, Thrower)', 'Keyword of whoever injured them (not Big Guy, Blitzer, Blocker, Catcher, Lineman, Runner, Special, Thrower)')}
                          <input type="text" value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="es. Orc, Elf, Undead" />
                        </label>
                    )}
                  </>
              )}
              <div className={wz.actions}>
                <button type="button" className="btn btn-primary" disabled={!ready} onClick={add}>{L('Aggiungi l\'infortunio', 'Add the injury')}</button>
                <button type="button" className="btn" onClick={reset}>{L('Annulla', 'Cancel')}</button>
              </div>
            </>
        )}
      </WizardStepCard>
  );
}

// ------------------------------------------------------------------
// MVP: scelta diretta, oppure 6 nominati e un D6 (p. 96)
// ------------------------------------------------------------------
function MvpPicker({ players, max, chosen, onStatChange }: {
  team: MatchTeam; players: PlayerStatDraft[]; max: number; chosen: PlayerStatDraft[]; onStatChange: Props['onStatChange'];
}) {
  const { language } = useLanguage();
  const L = (it: string, en: string) => (language === 'it' ? it : en);
  const [nominated, setNominated] = useState<string[]>([]);
  const [die, setDie] = useState<DiceValues>(emptyDice());

  if (max === 0) return <p className={wz.note}>{L('Nessun MVP per questa squadra.', 'No MVP for this team.')}</p>;

  const give = (playerId: string) => {
    const current = chosen.map(p => p.player_id);
    const next = current.includes(playerId) ? current : [...current, playerId].slice(-max);
    for (const p of players) onStatChange(p.player_id, 'mvp', next.includes(p.player_id) ? 1 : 0);
  };
  const clear = (playerId: string) => onStatChange(playerId, 'mvp', 0);
  const drawn = diceDone(die, 6) ? nominated[die[0]! - 1] : undefined;

  return (
      <>
        <p className={wz.note}>MVP ({chosen.length}/{max}): <strong>{chosen.map(p => p.name).join(', ') || '—'}</strong></p>
        {chosen.map(p => <button key={p.player_id} type="button" className="btn" onClick={() => clear(p.player_id)}><Trash2 size={14} /> {p.name}</button>)}
        {chosen.length < max && (
            <>
              <label className={wz.field}>{L('Sceglilo direttamente', 'Pick them directly')}
                <select value="" onChange={e => e.target.value && give(e.target.value)}>
                  <option value="">—</option>
                  {players.filter(p => !chosen.includes(p)).map(p => <option key={p.player_id} value={p.player_id}>{p.name}</option>)}
                </select>
              </label>
              <details>
                <summary>{L('Oppure estrailo come dice il libro', 'Or draw it the book\'s way')}</summary>
                <p className={wz.note}>{L('Spunta fino a 6 giocatori: il primo spuntato è l\'1, il secondo il 2 e così via. Poi tira il D6.', 'Tick up to 6 players: the first ticked is 1, the second 2 and so on. Then roll the D6.')}</p>
                {players.filter(p => !chosen.includes(p)).map(p => {
                  const index = nominated.indexOf(p.player_id);
                  return (
                      <label key={p.player_id} className={wz.check}>
                        <input type="checkbox" checked={index >= 0} disabled={index < 0 && nominated.length >= 6}
                               onChange={e => { setDie(emptyDice()); setNominated(e.target.checked ? [...nominated, p.player_id] : nominated.filter(id => id !== p.player_id)); }} />
                        {index >= 0 ? `${index + 1}. ` : ''}{p.name}
                      </label>
                  );
                })}
                {nominated.length > 0 && <DiceRoll label="MVP" sides={6} values={die} onChange={setDie} />}
                {diceDone(die, 6) && !drawn && <p className={wz.warn}>{L('Nessun giocatore con quel numero: premi Ritira.', 'No player with that number: press Re-roll.')}</p>}
                {drawn && (
                    <button type="button" className="btn btn-primary" onClick={() => { give(drawn); setNominated([]); setDie(emptyDice()); }}>
                      MVP: {players.find(p => p.player_id === drawn)?.name}
                    </button>
                )}
              </details>
            </>
        )}
      </>
  );
}
