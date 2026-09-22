'use client';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { PETTY_CASH_TREASURY_TOP_UP, type InducementChoice } from '@/lib/leagueRules';
import { getMatchTable, rowForTotal } from '@/lib/matchTables';
import { isTrue, type MatchDetails, type MatchTeam } from '@/lib/types';
import DiceRoll, { diceDone, diceTotal, emptyDice, type DiceValues } from '@/components/match/DiceRoll';
import { WizardStepCard, WizardSteps } from '@/components/match/Wizard';
import wz from '@/components/match/Wizard.module.css';
import InducementPicker from './InducementPicker';
import { pregameBudget, reportOf, savedInducements, teamPreview, type TeamPregameDraft } from './pregameModel';

const gp = (n: number) => n.toLocaleString();

type Draft = {
  step: number;
  fans: Record<string, DiceValues>;
  weather: DiceValues;
  positions: Record<string, string>;
  inducements: Record<string, InducementChoice[]>;
  riotous: Record<string, DiceValues>;
  rollOff: Record<string, DiceValues>;
  winnerChoice: 'kick' | 'receive' | '';
};

const STEP_KEYS = ['intro', 'fans', 'weather', 'journeymen', 'inducements', 'kickoff', 'summary'] as const;

// La bozza resta nel browser: ricaricando la pagina non si perdono i tiri già fatti
const storageKey = (matchId: string) => `bbl-pregame-${matchId}`;
function loadDraft(matchId: string): Draft | null {
  try {
    const raw = localStorage.getItem(storageKey(matchId));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

function initialDraft(match: MatchDetails, teamIds: string[]): Draft {
  const players = [...match.homePlayers, ...match.awayPlayers];
  return {
    step: 0,
    fans: Object.fromEntries(teamIds.map(id => [id, reportOf(match, id)?.fair_weather ? [reportOf(match, id)!.fair_weather!] : emptyDice()])),
    weather: emptyDice(2),
    positions: Object.fromEntries(teamIds.map(id => [id, players.find(p => p.team_id === id && isTrue(p.journeyman))?.position_key ?? ''])),
    inducements: Object.fromEntries(teamIds.map(id => [id, savedInducements(match, id)])),
    riotous: Object.fromEntries(teamIds.map(id => [id, emptyDice(2)])),
    rollOff: Object.fromEntries(teamIds.map(id => [id, emptyDice()])),
    winnerChoice: '',
  };
}

/** Sequenza pre-partita guidata (pp. 44-46, 94, 142-148): un passo alla volta, dadi veri o digitali. */
export default function PregameWizard({ match, onSaved }: { match: MatchDetails; onSaved: () => void }) {
  const { language } = useLanguage();
  const L = (it: string, en: string) => (language === 'it' ? it : en);
  const teams = [match.home_team_id, match.away_team_id].map(id => match.teams.find(tm => tm.id === id)).filter(Boolean) as MatchTeam[];
  const teamIds = teams.map(tm => tm.id);

  const [draft, setDraft] = useState<Draft>(() => loadDraft(match.id) ?? initialDraft(match, teamIds));
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    try { localStorage.setItem(storageKey(match.id), JSON.stringify(draft)); } catch { /* storage non disponibile */ }
  }, [draft, match.id]);

  if (teams.length < 2) return null;
  const [home, away] = teams;
  const patch = (p: Partial<Draft>) => setDraft(d => ({ ...d, ...p }));
  const go = (step: number) => { setServerError(null); patch({ step }); if (typeof window !== 'undefined') document.getElementById('match-flow')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  // Anteprima con i dati del percorso
  const teamDraft = (id: string): TeamPregameDraft => ({
    fair_weather: diceDone(draft.fans[id] ?? [], 3) ? draft.fans[id][0] : null,
    journeyman_position: draft.positions[id] ?? '',
    inducements: draft.inducements[id] ?? [],
    riotous_roll: diceDone(draft.riotous[id] ?? [], 3, 2) ? diceTotal(draft.riotous[id], 1) : null,
  });
  const pHome = teamPreview(match, home, teamDraft(home.id));
  const pAway = teamPreview(match, away, teamDraft(away.id));
  const preview = (id: string) => (id === home.id ? pHome : pAway);
  const budget = pregameBudget(home, away, pHome, pAway);

  const weatherTable = getMatchTable('weather')!;
  const weatherRow = diceDone(draft.weather, 6, 2) ? rowForTotal(weatherTable, diceTotal(draft.weather)) : null;

  const rollOffDone = teamIds.every(id => diceDone(draft.rollOff[id] ?? [], 6));
  const [rHome, rAway] = teamIds.map(id => (draft.rollOff[id]?.[0] ?? 0));
  const rollOffTie = rollOffDone && rHome === rAway;
  const rollOffWinner = rollOffDone && !rollOffTie ? (rHome > rAway ? home : away) : null;
  const kickingTeam = rollOffWinner && draft.winnerChoice
      ? (draft.winnerChoice === 'kick' ? rollOffWinner : rollOffWinner.id === home.id ? away : home)
      : null;

  const stepTitles = [
    L('Prima di iniziare', 'Before you start'), L('Tifosi', 'Fans'), L('Meteo', 'Weather'), 'Journeymen',
    L('Incentivi', 'Inducements'), L('Chi calcia', 'Kick-off'), L('Conferma', 'Confirm'),
  ];

  const save = async () => {
    setSaving(true);
    setServerError(null);
    try {
      const body = {
        weather_roll: diceTotal(draft.weather),
        kicking_team_id: kickingTeam?.id ?? null,
        teams: Object.fromEntries(teams.map(team => {
          const d = teamDraft(team.id);
          return [team.id, { fair_weather: d.fair_weather, journeyman_position: d.journeyman_position || null, inducements: d.inducements, riotous_roll: d.riotous_roll }];
        })),
      };
      const res = await fetch(`/api/schedule/${match.id}/pregame`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setServerError(data.error || L('Salvataggio non riuscito', 'Could not save')); return; }
      try { localStorage.removeItem(storageKey(match.id)); } catch { /* niente */ }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const teamBox = (team: MatchTeam, children: React.ReactNode) => (
      <div key={team.id} className={wz.team} style={{ '--team-color': team.id === home.id ? match.home_color ?? undefined : match.away_color ?? undefined } as React.CSSProperties}>
        <h4 className={wz.teamName}>{team.name}</h4>
        {children}
      </div>
  );

  const facts = (rows: [string, React.ReactNode][]) => (
      <dl className={wz.facts}>
        {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
  );

  const d3Hint = L('Senza D3: tira un D6 e dividi, 1-2 = 1, 3-4 = 2, 5-6 = 3.', 'No D3? Roll a D6 and halve it: 1-2 = 1, 3-4 = 2, 5-6 = 3.');

  let card: React.ReactNode = null;
  switch (STEP_KEYS[draft.step]) {
    case 'intro':
      card = (
          <WizardStepCard
              title={L('Prima di iniziare', 'Before you start')}
              page="pp. 44, 94"
              explain={[
                L('La sequenza pre-partita prepara le due squadre prima del calcio d\'inizio. Il sito ti guida un passo alla volta: tifosi, meteo, Journeymen, incentivi e chi calcia.',
                  'The pre-game sequence gets both teams ready before kick-off. The app walks you through it one step at a time: fans, weather, Journeymen, inducements and who kicks.'),
                L('Per ogni tiro puoi usare i dadi veri e scrivere quello che è uscito, oppure premere Tira. Se devi ripetere un tiro premi Ritira. Niente viene salvato finché non confermi l\'ultimo passo.',
                  'For every roll you can use real dice and type what came up, or press Roll. If a roll has to be repeated, press Re-roll. Nothing is saved until you confirm the last step.'),
              ]}
              onNext={() => go(1)}
              nextLabel={L('Iniziamo', 'Let\'s start')}
          >
            <div className={wz.teams}>
              {teams.map(team => {
                const p = preview(team.id);
                return teamBox(team, (
                    <>
                      {facts([
                        [L('Giocatori disponibili', 'Available players'), p.available],
                        ['Dedicated Fans', team.dedicated_fans],
                        ['Treasury', `${gp(p.treasury)} gp`],
                        ['CTV', `${gp(team.ctv)} gp`],
                      ])}
                      {p.unavailable.length > 0 && (
                          <p className={wz.note}>{L('Non giocano', 'Not playing')}: {p.unavailable.map(pl => `${pl.name} (${pl.unavailable === 'mng' ? 'MNG' : 'TR'})`).join(', ')}</p>
                      )}
                    </>
                ));
              })}
            </div>
          </WizardStepCard>
      );
      break;

    case 'fans':
      card = (
          <WizardStepCard
              title={L('I tifosi', 'The fans')}
              page="p. 45"
              explain={[
                L('Ogni allenatore tira un D3 per i Fair-weather Fans, i tifosi occasionali, e lo somma ai Dedicated Fans della squadra: il totale è il Fan Factor di questa partita.',
                  'Each coach rolls a D3 for Fair-weather Fans, the casual supporters, and adds it to the team\'s Dedicated Fans: the total is this match\'s Fan Factor.'),
                L('Il Fan Factor conta dopo la partita per gli incassi e, durante, per alcuni eventi di Kick-off come la Pitch Invasion.',
                  'Fan Factor matters after the match for the winnings and, during it, for some Kick-off events such as Pitch Invasion.'),
              ]}
              onBack={() => go(0)}
              onNext={() => go(2)}
              blocker={teams.every(tm => diceDone(draft.fans[tm.id] ?? [], 3)) ? null : L('Serve il D3 di tutte e due le squadre', 'Both teams need their D3')}
          >
            <div className={wz.teams}>
              {teams.map(team => teamBox(team, (
                  <>
                    <DiceRoll label="Fair-weather Fans" sides={3} values={draft.fans[team.id] ?? emptyDice()} hint={d3Hint}
                              onChange={v => patch({ fans: { ...draft.fans, [team.id]: v } })} />
                    {facts([['Dedicated Fans', team.dedicated_fans], ['Fan Factor', preview(team.id).ff ?? '—']])}
                  </>
              )))}
            </div>
          </WizardStepCard>
      );
      break;

    case 'weather':
      card = (
          <WizardStepCard
              title={L('Il meteo', 'The weather')}
              page="p. 46"
              explain={[
                L('Ogni allenatore tira un D6 e si sommano i due risultati: la tabella del Meteo dice che tempo farà. Vale per tutta la partita, a meno che un evento di Kick-off non lo cambi.',
                  'Each coach rolls a D6 and the two results are added: the Weather table says what it will be like. It lasts the whole match, unless a Kick-off event changes it.'),
              ]}
              onBack={() => go(1)}
              onNext={() => go(3)}
              blocker={weatherRow ? null : L('Servono i due D6', 'Both D6 are needed')}
          >
            <DiceRoll label={L('Un D6 per allenatore', 'One D6 per coach')} sides={6} count={2} values={draft.weather} onChange={v => patch({ weather: v })} />
            {weatherRow && (
                <div className={`${wz.outcome} ${weatherRow.tone === 'bad' ? wz.outcomeBad : ''}`}>
                  <span className={wz.outcomeName}>{weatherRow.name}</span>
                  <p>{weatherRow.text[language]}</p>
                </div>
            )}
          </WizardStepCard>
      );
      break;

    case 'journeymen': {
      const missingPosition = teams.some(tm => {
        const p = preview(tm.id);
        return p.baseJourneymen > 0 && (!p.jPosition || p.options.length === 0);
      });
      card = (
          <WizardStepCard
              title="Journeymen"
              page="p. 94"
              explain={[
                L('Ogni squadra deve poter schierare 11 giocatori. Se tra i disponibili ne ha meno, prende gratis dei Journeymen fino ad arrivare a 11: sono Lineman della posizione 0-16 del roster, con in più Loner (4+).',
                  'Each team must be able to field 11 players. If fewer are available, it takes free Journeymen up to 11: Linemen from the roster\'s 0-16 position, with Loner (4+) on top.'),
                L('I Journeymen contano nel CTV, quindi pesano sugli incentivi. Dopo la partita potrai decidere se ingaggiarli.',
                  'Journeymen count towards CTV, so they affect inducements. After the match you can decide whether to hire them.'),
              ]}
              onBack={() => go(2)}
              onNext={() => go(4)}
              blocker={missingPosition ? L('Scegli la posizione dei Journeymen', 'Choose the Journeymen position') : null}
          >
            <div className={wz.teams}>
              {teams.map(team => {
                const p = preview(team.id);
                return teamBox(team, (
                    <>
                      {facts([[L('Disponibili', 'Available'), p.available], ['Journeymen', p.baseJourneymen]])}
                      {p.baseJourneymen === 0 && <p className={wz.note}>{L('Ha almeno 11 giocatori: niente Journeymen.', 'At least 11 players: no Journeymen.')}</p>}
                      {p.baseJourneymen > 0 && p.options.length === 0 && (
                          <p className={wz.warn}>{L('Collega prima la squadra al suo Team Roster: senza non si sa da quale posizione arrivano.', 'Link the team to its Team Roster first: without it the position is unknown.')}</p>
                      )}
                      {p.baseJourneymen > 0 && p.options.length > 1 && (
                          <label className={wz.field}>{L('Da quale posizione Lineman', 'Which Lineman position')}
                            <select value={draft.positions[team.id] ?? ''} onChange={e => patch({ positions: { ...draft.positions, [team.id]: e.target.value } })}>
                              <option value="">—</option>
                              {p.options.map(o => <option key={o.key} value={o.key}>{o.name} ({gp(o.cost)} gp)</option>)}
                            </select>
                          </label>
                      )}
                      {p.baseJourneymen > 0 && p.options.length === 1 && <p className={wz.note}>{p.options[0].name}</p>}
                    </>
                ));
              })}
            </div>
          </WizardStepCard>
      );
      break;
    }

    case 'inducements': {
      const riotousPending = teams.some(tm => (draft.inducements[tm.id] ?? []).some(c => c.key === 'riotous_rookies') && !diceDone(draft.riotous[tm.id] ?? [], 3, 2));
      const invalid = teams.some(tm => preview(tm.id).invalid.length > 0);
      const blocker = budget.problems.includes('equal') ? L('A CTV pari nessuno compra incentivi', 'Equal CTV: no inducements')
          : budget.problems.includes('higher') ? L(`${budget.higher.name} non ha abbastanza Treasury`, `${budget.higher.name} lacks the Treasury`)
          : budget.problems.includes('lower') ? L(`${budget.lower.name} supera la Petty Cash più ${gp(PETTY_CASH_TREASURY_TOP_UP)}`, `${budget.lower.name} goes over Petty Cash plus ${gp(PETTY_CASH_TREASURY_TOP_UP)}`)
          : invalid ? L('Completa le scelte (posizione del Mercenario, Star Player)', 'Complete the choices (Mercenary position, Star Player)')
          : riotousPending ? L('Serve il tiro dei Riotous Rookies', 'The Riotous Rookies roll is needed') : null;
      const prayers = teams.map(tm => [tm, (draft.inducements[tm.id] ?? []).find(c => c.key === 'prayers')?.qty ?? 0] as const).filter(([, n]) => n > 0);
      card = (
          <WizardStepCard
              title={L('Gli incentivi', 'Inducements')}
              page="pp. 94, 142-149"
              explain={[
                L('Si confronta il CTV delle due squadre, Journeymen compresi. La squadra con il CTV più alto spende per prima, solo dalla propria Treasury.',
                  'Compare the two teams\' CTV, Journeymen included. The team with the higher CTV spends first, from its own Treasury only.'),
                L('L\'altra riceve la Petty Cash: la differenza di CTV più quanto ha speso la prima. Può aggiungere al massimo 50.000 dalla sua Treasury. A CTV pari nessuna delle due compra incentivi.',
                  'The other gets Petty Cash: the CTV difference plus whatever the first one spent. It may add at most 50,000 from its own Treasury. With equal CTV neither buys inducements.'),
                L('Gli Star Player si scelgono dal catalogo, e compaiono solo quelli che giocano per la squadra. Se non vuoi incentivi, conferma e basta.',
                  'Star Players come from the catalogue, and only those who play for the team are listed. If you want no inducements, just confirm.'),
              ]}
              onBack={() => go(3)}
              onNext={() => go(5)}
              blocker={blocker}
          >
            {budget.equal ? (
                <p className={wz.note}>{L('CTV pari', 'Equal CTV')}: {gp(pHome.ctv)} gp — {L('nessuna squadra può comprare incentivi.', 'neither team may buy inducements.')}</p>
            ) : (
                <p className={wz.note}>
                  {L('Spende per prima', 'Spends first')}: <strong>{budget.higher.name}</strong> (CTV {gp(budget.pHigher.ctv)}) · Petty Cash {L('per', 'for')} <strong>{budget.lower.name}</strong>: {gp(budget.petty)} gp
                </p>
            )}
            <div className={wz.teams}>
              {teams.map(team => {
                const p = preview(team.id);
                const isHigher = !budget.equal && team.id === budget.higher.id;
                return teamBox(team, (
                    <>
                      {facts([
                        ['CTV', `${gp(p.ctv)} gp`],
                        [isHigher ? 'Treasury' : 'Petty Cash', isHigher ? `${gp(p.treasury)} gp` : `${gp(budget.equal ? 0 : budget.petty)} gp + max ${gp(budget.maxTopUp)}`],
                        [L('Spesa', 'Spent'), `${gp(p.cost)} gp`],
                      ])}
                      {!budget.equal && (
                          <InducementPicker team={team} preview={p} inducements={draft.inducements[team.id] ?? []}
                                            onChange={next => patch({ inducements: { ...draft.inducements, [team.id]: next } })} />
                      )}
                      {(draft.inducements[team.id] ?? []).some(c => c.key === 'riotous_rookies') && (
                          <DiceRoll label="Riotous Rookies (2D3+1)" sides={3} count={2} modifier={1} values={draft.riotous[team.id] ?? emptyDice(2)} hint={d3Hint}
                                    onChange={v => patch({ riotous: { ...draft.riotous, [team.id]: v } })} />
                      )}
                    </>
                ));
              })}
            </div>
            {prayers.length > 0 && (
                <p className={wz.note}>{L('Prayers to Nuffle: tirerai il D16 per ogni preghiera all\'inizio della partita, dalle Tabelle di partita.', 'Prayers to Nuffle: roll the D16 for each prayer at the start of the match, from the Match tables.')}</p>
            )}
          </WizardStepCard>
      );
      break;
    }

    case 'kickoff':
      card = (
          <WizardStepCard
              title={L('Chi calcia', 'Who kicks off')}
              page="pp. 33, 46"
              explain={[
                L('Ultimo passo: un roll-off. Ogni allenatore tira un D6 e chi fa di più decide se calciare o ricevere il primo drive. Con un pareggio si ritira.',
                  'Last step: a roll-off. Each coach rolls a D6 and the higher decides whether to kick or receive the first drive. On a tie, roll again.'),
                L('Nel secondo tempo le parti si invertono: calcia chi aveva ricevuto.', 'In the second half it swaps: whoever received now kicks.'),
              ]}
              onBack={() => go(4)}
              onNext={() => go(6)}
              blocker={!rollOffDone ? L('Servono i due D6', 'Both D6 are needed') : rollOffTie ? L('Pareggio: premete Ritira e tirate di nuovo', 'A tie: press Re-roll and roll again') : !draft.winnerChoice ? L('Chi ha vinto sceglie', 'The winner chooses') : null}
          >
            <div className={wz.teams}>
              {teams.map(team => teamBox(team, (
                  <DiceRoll label="Roll-off" sides={6} values={draft.rollOff[team.id] ?? emptyDice()}
                            onChange={v => patch({ rollOff: { ...draft.rollOff, [team.id]: v }, winnerChoice: '' })} />
              )))}
            </div>
            {rollOffTie && <p className={wz.warn}>{L('Pareggio! Premete Ritira su tutti e due i dadi e tirate di nuovo.', 'A tie! Press Re-roll on both dice and roll again.')}</p>}
            {rollOffWinner && (
                <div className={wz.outcome}>
                  <span className={wz.outcomeName}>{L('Vince', 'Winner')}: {rollOffWinner.name}</span>
                  <div className={wz.actions} role="radiogroup" aria-label={L('Scelta', 'Choice')}>
                    <label className={wz.check}><input type="radio" name="kickoff-choice" checked={draft.winnerChoice === 'kick'} onChange={() => patch({ winnerChoice: 'kick' })} /> {L('Calcia', 'Kicks')}</label>
                    <label className={wz.check}><input type="radio" name="kickoff-choice" checked={draft.winnerChoice === 'receive'} onChange={() => patch({ winnerChoice: 'receive' })} /> {L('Riceve', 'Receives')}</label>
                  </div>
                </div>
            )}
          </WizardStepCard>
      );
      break;

    case 'summary':
      card = (
          <WizardStepCard
              title={L('Riepilogo e conferma', 'Summary and confirm')}
              explain={[
                L('Controlla tutto. Con la conferma il sito salva il pre-partita: aggiunge i Journeymen, scala la Treasury per gli incentivi e registra meteo e squadra che calcia.',
                  'Check everything. Confirming saves the pre-game: the app adds the Journeymen, takes the inducements out of the Treasury and records weather and kicking team.'),
                L('Finché la partita non è giocata potrai rifarlo da capo.', 'Until the match is played you can redo it from scratch.'),
              ]}
              onBack={() => go(5)}
              onNext={save}
              nextLabel={L('Conferma il pre-partita', 'Confirm the pre-game')}
              busy={saving}
              blocker={serverError}
          >
            {facts([
              [L('Meteo', 'Weather'), weatherRow ? `${weatherRow.name} (${diceTotal(draft.weather)})` : '—'],
              [L('Calcia il primo drive', 'Kicks the first drive'), kickingTeam?.name ?? '—'],
            ])}
            <div className={wz.teams}>
              {teams.map(team => {
                const p = preview(team.id);
                return teamBox(team, facts([
                  ['Fan Factor', p.ff ?? '—'],
                  ['Journeymen', p.journeymen],
                  ['CTV', `${gp(p.ctv)} gp`],
                  [L('Incentivi', 'Inducements'), p.cost ? `${gp(p.cost)} gp` : L('nessuno', 'none')],
                ]));
              })}
            </div>
          </WizardStepCard>
      );
      break;
  }

  return (
      <div>
        <WizardSteps steps={STEP_KEYS.map((key, i) => ({ key, title: stepTitles[i] }))} current={draft.step} onJump={go} />
        {card}
      </div>
  );
}
