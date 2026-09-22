'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, Undo2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { ADVANCEMENT_TIERS, MAX_ADVANCEMENTS } from '@/lib/advancement';
import { CASUALTY_RESULTS, MISTAKE_THRESHOLD, expensiveMistake, mistakeExtraRoll, treasuryAfterMistake } from '@/lib/leagueRules';
import { mustAdvance, onDraftList } from '@/lib/players';
import { hasRule, getRoster } from '@/lib/rosters';
import { isTrue, type MatchDetails, type MatchTeam, type Player, type TeamWithPlayers } from '@/lib/types';
import DiceRoll, { diceDone, diceTotal, emptyDice, type DiceValues } from '@/components/match/DiceRoll';
import { WizardStepCard, WizardSteps } from '@/components/match/Wizard';
import wz from '@/components/match/Wizard.module.css';
import { CaptainPicker } from '../../teams/[id]/PostgamePanel';
import { reportOf } from './pregameModel';

const STEPS = ['recap', 'advance', 'hiring', 'mistakes', 'done'] as const;
const gp = (n: number) => n.toLocaleString();

/** Sequenza post-partita guidata (pp. 95-100) per le due squadre, dopo il referto:
 *  riepilogo, avanzamenti, ingaggi (Journeymen, capitano), Expensive Mistakes. */
export default function PostgameWizard({ match, onChanged, onCorrectReport }: { match: MatchDetails; onChanged: () => void; onCorrectReport: () => void }) {
  const { language, t } = useLanguage();
  const L = (it: string, en: string) => (language === 'it' ? it : en);
  const teams = [match.home_team_id, match.away_team_id].map(id => match.teams.find(tm => tm.id === id)).filter(Boolean) as MatchTeam[];
  const allDone = teams.every(tm => reportOf(match, tm.id)?.mistake_result);
  const anyDone = teams.some(tm => reportOf(match, tm.id)?.mistake_result);
  // Il passo resta ricordato: tornando dalla pagina della squadra (avanzamenti, ingaggi) si riparte da lì
  const stepKey = `bbl-postgame-step-${match.id}`;
  const [step, setStep] = useState(() => {
    if (allDone) return 4;
    let saved = 0;
    try { saved = Number(localStorage.getItem(stepKey)) || 0; } catch { /* niente */ }
    return Math.min(3, Math.max(anyDone ? 3 : 0, saved));
  });
  const [squads, setSquads] = useState<Record<string, TeamWithPlayers>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // I dati delle squadre (SPP, Treasury, giocatori) arrivano dalla loro pagina
  const loadTeams = useCallback(async () => {
    const entries = await Promise.all([match.home_team_id, match.away_team_id].map(async id => {
      const res = await fetch(`/api/teams/${id}`);
      return [id, await res.json()] as const;
    }));
    setSquads(Object.fromEntries(entries));
  }, [match.home_team_id, match.away_team_id]);

  useEffect(() => { loadTeams(); }, [loadTeams]);

  const go = (n: number) => {
    try { localStorage.setItem(stepKey, String(n)); } catch { /* niente */ }
    setError(null); setStep(n); document.getElementById('match-flow')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const refresh = async () => { await loadTeams(); onChanged(); };
  const post = async (url: string, body: unknown, method = 'POST') => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Error'); return false; }
      await refresh();
      return true;
    } finally {
      setBusy(false);
    }
  };

  const colorOf = (id: string) => (id === match.home_team_id ? match.home_color : match.away_color);
  const teamBox = (team: MatchTeam, children: React.ReactNode) => (
      <div key={team.id} className={wz.team} style={{ '--team-color': colorOf(team.id) ?? undefined } as React.CSSProperties}>
        <h4 className={wz.teamName}>{team.name}</h4>
        {children}
      </div>
  );
  const facts = (rows: [string, React.ReactNode][]) => (
      <dl className={wz.facts}>{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
  );
  const back = encodeURIComponent(`/schedule/${match.id}`);
  const playersOf = (teamId: string): Player[] => squads[teamId]?.players ?? [];
  const loading = teams.some(tm => !squads[tm.id]);

  const stepTitles = [L('Riepilogo', 'Recap'), L('Avanzamenti', 'Advancements'), L('Ingaggi', 'Hiring'), 'Expensive Mistakes', L('Fatto', 'Done')];
  let card: React.ReactNode = null;

  switch (STEPS[step]) {
    case 'recap':
      card = (
          <WizardStepCard
              title={L('Il post-partita', 'The post-game')}
              page="p. 95"
              explain={[
                L('Il referto è salvato: il sito ha già aggiunto gli incassi alla Treasury, aggiornato i Dedicated Fans, assegnato gli SPP e applicato gli infortuni.',
                  'The report is saved: the app has already added the winnings to the Treasury, updated Dedicated Fans, awarded the SPP and applied the injuries.'),
                L('Restano tre passi, nell\'ordine del libro: avanzamenti dei giocatori, ingaggi e Journeymen, Expensive Mistakes. Dopo gli Expensive Mistakes il post-partita è chiuso.',
                  'Three steps remain, in the book\'s order: player advancements, hiring and Journeymen, Expensive Mistakes. After Expensive Mistakes the post-game is closed.'),
              ]}
              onNext={() => go(1)}
          >
            <div className={wz.teams}>
              {teams.map(team => {
                const report = reportOf(match, team.id);
                const matchPlayers = [...match.homePlayers, ...match.awayPlayers];
                const injuries = match.injuries.filter(i => matchPlayers.find(p => p.id === i.player_id)?.team_id === team.id);
                const nameOf = (pid: string) => matchPlayers.find(p => p.id === pid)?.name ?? pid;
                return teamBox(team, facts([
                  [L('Incasso', 'Winnings'), `+${gp(report?.winnings ?? 0)} gp`],
                  ['Dedicated Fans', `${(report?.df_change ?? 0) > 0 ? '+' : ''}${report?.df_change ?? 0}`],
                  [L('Infortuni', 'Injuries'), injuries.map(i => `${nameOf(i.player_id)} (${CASUALTY_RESULTS.find(c => c.key === i.result)?.name ?? i.result})`).join(', ') || '—'],
                ]));
              })}
            </div>
            {!anyDone && (
                <div className={wz.actions}>
                  <button type="button" className="btn" onClick={onCorrectReport}>{L('Correggi il referto', 'Correct the report')}</button>
                </div>
            )}
          </WizardStepCard>
      );
      break;

    case 'advance': {
      const due = teams.flatMap(tm => playersOf(tm.id).filter(p => mustAdvance(p)));
      card = (
          <WizardStepCard
              title={L('Avanzamenti', 'Advancements')}
              page="pp. 96-98"
              explain={[
                L('I giocatori possono spendere gli SPP per una skill o per migliorare una caratteristica. Si possono anche risparmiare, tranne in un caso: chi ha abbastanza SPP per un Characteristic Improvement deve prendere un avanzamento (va bene anche una skill).',
                  'Players may spend SPP on a skill or a characteristic improvement. They may also save them, except in one case: anyone with enough SPP for a Characteristic Improvement must take an advancement (a skill is fine too).'),
                L('Premi "Avanzamento" accanto al giocatore: si apre la sua scheda nella pagina della squadra, con i dadi tirati dal sito. Poi torna qui con "Torna alla partita" e premi Aggiorna.',
                  'Press "Advancement" next to the player: their sheet opens on the team page, with the dice rolled by the app. Then come back with "Back to the match" and press Refresh.'),
              ]}
              onBack={() => go(0)}
              onNext={() => go(2)}
              blocker={loading ? L('Caricamento…', 'Loading…') : due.length ? L(`Devono ancora avanzare: ${due.map(p => p.name).join(', ')}`, `Still must advance: ${due.map(p => p.name).join(', ')}`) : null}
          >
            <div className={wz.actions}>
              <button type="button" className="btn" onClick={refresh}><RefreshCw size={16} /> {L('Aggiorna', 'Refresh')}</button>
            </div>
            <div className={wz.teams}>
              {teams.map(team => {
                const ready = playersOf(team.id).filter(p => onDraftList(p) && !isTrue(p.journeyman) && p.advancements < MAX_ADVANCEMENTS
                    && p.spp >= ADVANCEMENT_TIERS[Math.min(p.advancements, MAX_ADVANCEMENTS - 1)].randomPrimary);
                return teamBox(team, ready.length ? (
                    <ul className={wz.list}>
                      {ready.map(p => (
                          <li key={p.id} className={wz.listRow}>
                            <span><strong>{p.name}</strong> · {p.spp} SPP {mustAdvance(p) && <span className="tag tag-red">{t.rules.mustAdvance}</span>}</span>
                            <Link href={`/teams/${team.id}?advance=${p.id}&back=${back}`} className="btn btn-primary">{L('Avanzamento', 'Advancement')}</Link>
                          </li>
                      ))}
                    </ul>
                ) : <p className={wz.note}>{L('Nessuno ha abbastanza SPP per un avanzamento.', 'Nobody has enough SPP for an advancement.')}</p>);
              })}
            </div>
          </WizardStepCard>
      );
      break;
    }

    case 'hiring':
      card = (
          <WizardStepCard
              title={L('Ingaggi e Journeymen', 'Hiring and Journeymen')}
              page="pp. 99, 155"
              explain={[
                L('Ora si sistema la rosa: prima si tolgono i morti (lo fa il sito), poi si ingaggia, si licenzia e si compra lo staff dalla Treasury. Queste cose si fanno nella pagina della squadra.',
                  'Now the roster: first the dead are removed (the app does it), then hiring, firing and staff are paid from the Treasury. Those are done on the team page.'),
                L('I Journeymen di questa partita si ingaggiano qui: costano il loro valore, perdono Loner e tengono gli SPP. Chi non viene ingaggiato se ne va alla fine del post-partita. Se il Team Captain è morto, qui ne nomini un altro.',
                  'This match\'s Journeymen are hired here: they cost their value, lose Loner and keep their SPP. Anyone not hired leaves at the end of the post-game. If the Team Captain died, you appoint a new one here.'),
              ]}
              onBack={() => go(1)}
              onNext={() => go(3)}
              blocker={error}
              busy={busy}
          >
            <div className={wz.teams}>
              {teams.map(team => {
                const squad = squads[team.id];
                const journeymen = playersOf(team.id).filter(p => isTrue(p.journeyman) && p.journeyman_match_id === match.id && !isTrue(p.left_team));
                const roster = getRoster(squad?.roster ?? null);
                const captainVacant = !!squad && hasRule(roster, 'Team Captain') && squad.postgame_phase !== 'closed'
                    && !squad.players.some(p => isTrue(p.is_captain) && onDraftList(p)) && squad.players.some(p => isTrue(p.is_captain) && isTrue(p.dead));
                return teamBox(team, (
                    <>
                      {facts([['Treasury', `${gp(squad?.treasury ?? 0)} gp`]])}
                      {journeymen.length ? (
                          <ul className={wz.list}>
                            {journeymen.map(j => (
                                <JourneymanRow key={j.id} player={j} canPay={(squad?.treasury ?? 0) >= j.value} busy={busy}
                                               onHire={name => post(`/api/players/${j.id}/hire`, { name })} />
                            ))}
                          </ul>
                      ) : <p className={wz.note}>{L('Nessun Journeyman da ingaggiare.', 'No Journeymen to hire.')}</p>}
                      {captainVacant && squad && <CaptainPicker team={squad} onChange={refresh} />}
                      <Link href={`/teams/${team.id}?back=${back}`} className="btn">{L('Ingaggi, staff e licenziamenti', 'Hiring, staff and firing')}</Link>
                    </>
                ));
              })}
            </div>
          </WizardStepCard>
      );
      break;

    case 'mistakes':
      card = (
          <WizardStepCard
              title="Expensive Mistakes"
              page="p. 100"
              explain={[
                L('Ultimo passo: la tassa sui ricchi. Una squadra con 100.000 gp o più in Treasury tira un D6: più oro ha, più rischia di perderne. Sotto i 100.000 non si tira.',
                  'Last step: the tax on hoarders. A team with 100,000 gp or more in the Treasury rolls a D6: the more gold, the bigger the risk. Below 100,000 there is no roll.'),
                L('Minor Incident toglie D3 x 10.000; Major Incident dimezza la Treasury; Catastrophe lascia solo 2D6 x 10.000. Quando confermi, il post-partita di quella squadra è chiuso e i Journeymen non ingaggiati se ne vanno.',
                  'Minor Incident takes D3 x 10,000; Major Incident halves the Treasury; Catastrophe leaves only 2D6 x 10,000. Once you confirm, that team\'s post-game is closed and unhired Journeymen leave.'),
              ]}
              onBack={() => go(2)}
              onNext={() => go(4)}
              blocker={error ?? (allDone ? null : L('Conferma gli Expensive Mistakes di tutte e due le squadre', 'Confirm Expensive Mistakes for both teams'))}
              busy={busy}
          >
            <div className={wz.teams}>
              {teams.map(team => teamBox(team, (
                  <MistakesBox match={match} team={team} treasury={squads[team.id]?.treasury ?? 0} busy={busy}
                               onConfirm={(roll, extra) => post(`/api/schedule/${match.id}/mistakes`, { team_id: team.id, roll, extra })}
                               onUndo={() => post(`/api/schedule/${match.id}/mistakes?team=${team.id}`, {}, 'DELETE')} />
              )))}
            </div>
          </WizardStepCard>
      );
      break;

    case 'done':
      card = (
          <WizardStepCard
              title={L('Post-partita concluso', 'Post-game complete')}
              explain={[
                L('La partita è chiusa. Le due squadre possono giocare la prossima: ingaggi, staff e avanzamenti riapriranno con il post-partita della partita successiva.',
                  'The match is closed. Both teams can play their next one: hiring, staff and advancements open again with the next match\'s post-game.'),
                L('Se hai sbagliato gli Expensive Mistakes puoi annullarli qui sotto: il post-partita di quella squadra si riapre.', 'If Expensive Mistakes went wrong you can undo them below: that team\'s post-game reopens.'),
              ]}
          >
            <div className={wz.teams}>
              {teams.map(team => {
                const report = reportOf(match, team.id);
                return teamBox(team, (
                    <>
                      {facts([
                        ['Expensive Mistakes', report?.mistake_result ? t.rules.mistakeResult[report.mistake_result as keyof typeof t.rules.mistakeResult] : '—'],
                        ['Treasury', `${gp(squads[team.id]?.treasury ?? 0)} gp`],
                      ])}
                      {report?.mistake_result && (
                          <button type="button" className="btn" disabled={busy} onClick={async () => { if (await post(`/api/schedule/${match.id}/mistakes?team=${team.id}`, {}, 'DELETE')) go(3); }}>
                            <Undo2 size={16} /> {L('Annulla Expensive Mistakes', 'Undo Expensive Mistakes')}
                          </button>
                      )}
                      <Link href={`/teams/${team.id}`} className="btn">{L('Pagina della squadra', 'Team page')}</Link>
                    </>
                ));
              })}
            </div>
            {error && <p className={wz.warn}>{error}</p>}
            <div className={wz.actions}>
              <Link href="/schedule" className="btn btn-primary">{L('Torna al calendario', 'Back to the fixtures')}</Link>
            </div>
          </WizardStepCard>
      );
      break;
  }

  return (
      <div>
        <WizardSteps steps={STEPS.map((key, i) => ({ key, title: stepTitles[i] }))} current={step} onJump={allDone ? undefined : go} />
        {card}
      </div>
  );
}

function JourneymanRow({ player, canPay, busy, onHire }: { player: Player; canPay: boolean; busy: boolean; onHire: (name: string) => void }) {
  const { language } = useLanguage();
  const L = (it: string, en: string) => (language === 'it' ? it : en);
  const [name, setName] = useState(player.name);
  return (
      <li className={wz.listRow}>
        <span><strong>{player.role}</strong> · {player.spp} SPP · {gp(player.value)} gp</span>
        <input type="text" value={name} onChange={e => setName(e.target.value)} aria-label={L('Nome', 'Name')} />
        <button type="button" className="btn btn-navy" disabled={busy || !canPay || !name.trim()} onClick={() => onHire(name.trim())}>
          {canPay ? L('Ingaggia', 'Hire') : L('Treasury insufficiente', 'Not enough Treasury')}
        </button>
      </li>
  );
}

function MistakesBox({ match, team, treasury, busy, onConfirm, onUndo }: {
  match: MatchDetails; team: MatchTeam; treasury: number; busy: boolean;
  onConfirm: (roll: number | null, extra: number | null) => void; onUndo: () => void;
}) {
  const { language, t } = useLanguage();
  const L = (it: string, en: string) => (language === 'it' ? it : en);
  const [d6, setD6] = useState<DiceValues>(emptyDice());
  const [extra, setExtra] = useState<DiceValues>(emptyDice());
  const report = reportOf(match, team.id);

  if (report?.mistake_result) {
    return (
        <>
          <p className={wz.note}>{t.rules.mistakeResult[report.mistake_result as keyof typeof t.rules.mistakeResult]} · Treasury {gp(treasury)} gp</p>
          <button type="button" className="btn" disabled={busy} onClick={onUndo}><Undo2 size={16} /> {L('Annulla', 'Undo')}</button>
        </>
    );
  }
  if (treasury < MISTAKE_THRESHOLD) {
    return (
        <>
          <p className={wz.note}>Treasury {gp(treasury)} gp: {L('sotto i 100.000, nessun tiro.', 'below 100,000, no roll.')}</p>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onConfirm(null, null)}>{L('Conferma', 'Confirm')}</button>
        </>
    );
  }

  const result = diceDone(d6, 6) ? expensiveMistake(treasury, d6[0]!) : null;
  const extraKind = mistakeExtraRoll(result);
  const extraSides = extraKind === 'd3' ? 3 : 6;
  const extraCount = extraKind === '2d6' ? 2 : 1;
  const extraVals = extra.length >= extraCount ? extra.slice(0, extraCount) : emptyDice(extraCount);
  const extraOk = !extraKind || diceDone(extraVals, extraSides, extraCount);
  const after = result && extraOk ? treasuryAfterMistake(treasury, result, extraKind ? diceTotal(extraVals) : 0) : null;
  return (
      <>
        <p className={wz.note}>Treasury: <strong>{gp(treasury)} gp</strong></p>
        <DiceRoll label="Expensive Mistakes" sides={6} values={d6} onChange={v => { setD6(v); setExtra(emptyDice(2)); }} />
        {result && (
            <div className={`${wz.outcome} ${result === 'averted' ? wz.outcomeGood : wz.outcomeBad}`}>
              <span className={wz.outcomeName}>{t.rules.mistakeResult[result]}</span>
              <p>{result === 'averted' ? L('Niente di grave: la Treasury resta com\'è.', 'Nothing serious: the Treasury stays as it is.')
                  : result === 'minor' ? L('Si perdono D3 x 10.000 gp.', 'Lose D3 x 10,000 gp.')
                  : result === 'major' ? L('Si perde metà della Treasury.', 'Lose half the Treasury.')
                  : L('Resta solo 2D6 x 10.000 gp.', 'Only 2D6 x 10,000 gp remain.')}</p>
            </div>
        )}
        {extraKind && (
            <DiceRoll label={extraKind === 'd3' ? 'Minor Incident (D3)' : 'Catastrophe (2D6)'} sides={extraSides} count={extraCount}
                      values={extraVals} onChange={setExtra} />
        )}
        {after !== null && <p className={wz.note}>Treasury: {gp(treasury)} → <strong>{gp(after)} gp</strong></p>}
        <button type="button" className="btn btn-primary" disabled={busy || !result || !extraOk}
                onClick={() => onConfirm(d6[0]!, extraKind ? diceTotal(extraVals) : null)}>
          {L('Conferma Expensive Mistakes', 'Confirm Expensive Mistakes')}
        </button>
      </>
  );
}
