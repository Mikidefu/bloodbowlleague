'use client';
import { useEffect, useState } from 'react';
import { Dices } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { PETTY_CASH_TREASURY_TOP_UP, rollDie, type InducementChoice } from '@/lib/leagueRules';
import { getMatchTable, rowForTotal } from '@/lib/matchTables';
import { PRAYER_DIE, getPrayer, targetCount, type PrayerResult } from '@/lib/prayers';
import { isTrue, type MatchDetails, type MatchTeam } from '@/lib/types';
import DiceRoll, { diceDone, diceTotal, emptyDice, type DiceValues } from '@/components/match/DiceRoll';
import { Facts, WizardStepCard, WizardSteps, rich, type FactRow } from '@/components/match/Wizard';
import wz from '@/components/match/Wizard.module.css';
import PrayerList, { prayerEffectText } from '@/components/match/PrayerList';
import InducementPicker from './InducementPicker';
import {
  prayerCandidates, prayerRef, pregameBudget, reportOf, savedInducements, savedPrayers, teamPreview,
  type PrayerCandidate, type TeamPregameDraft,
} from './pregameModel';

const gp = (n: number) => n.toLocaleString();

// Un Prayer to Nuffle mentre lo si tira: D16, eventuale D3, giocatori scelti (id o "journeyman:N"), skill
type PrayerDraft = { roll: DiceValues; d3: DiceValues; players: string[]; skill: string };
const emptyPrayer = (): PrayerDraft => ({ roll: emptyDice(), d3: emptyDice(), players: [], skill: '' });

type Draft = {
  step: number;
  fans: Record<string, DiceValues>;
  weather: DiceValues;
  positions: Record<string, string>;
  inducements: Record<string, InducementChoice[]>;
  riotous: Record<string, DiceValues>;
  rollOff: Record<string, DiceValues>;
  winnerChoice: 'kick' | 'receive' | '';
  prayers: Record<string, PrayerDraft[]>;
};

const STEP_KEYS = ['intro', 'fans', 'weather', 'journeymen', 'inducements', 'prayers', 'kickoff', 'summary'] as const;
const PRAYERS_STEP = STEP_KEYS.indexOf('prayers');

// La bozza resta nel browser: ricaricando la pagina non si perdono i tiri già fatti
const storageKey = (matchId: string) => `bbl-pregame-${matchId}`;
function loadDraft(matchId: string): Draft | null {
  try {
    const raw = localStorage.getItem(storageKey(matchId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as Draft;
    // Bozza salvata prima del passo dei Prayers to Nuffle: i passi da lì in poi scalano di uno
    if (!draft.prayers) return { ...draft, prayers: {}, step: draft.step >= PRAYERS_STEP ? draft.step + 1 : draft.step };
    return draft;
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
    // Rifacendo il pre-partita si riparte dalle preghiere già tirate
    prayers: Object.fromEntries(teamIds.map(id => [id, savedPrayers(match, id).map(p => ({
      roll: [p.roll], d3: p.d3 ? [p.d3] : emptyDice(), players: (p.players ?? []).map(ref => prayerRef(match, ref)), skill: p.skill ?? '',
    }))])),
  };
}

// Prayers to Nuffle comprati da una squadra
const prayerQty = (inducements: InducementChoice[] | undefined) =>
  (inducements ?? []).filter(c => c.key === 'prayers').reduce((sum, c) => sum + c.qty, 0);

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
    L('Incentivi', 'Inducements'), L('Preghiere', 'Prayers'), L('Chi calcia', 'Kick-off'), L('Conferma', 'Confirm'),
  ];

  // Prayers to Nuffle (pp. 142-143): tanti quanti ne ha comprati la squadra, scelte comprese
  const prayerDrafts = (teamId: string) =>
    Array.from({ length: prayerQty(draft.inducements[teamId]) }, (_, i) => draft.prayers?.[teamId]?.[i] ?? emptyPrayer());
  const opponentOf = (teamId: string) => (teamId === home.id ? away : home);
  const candidates: Record<string, PrayerCandidate[]> = Object.fromEntries(teams.map(tm => [tm.id, prayerCandidates(match, tm, preview(tm.id))]));
  const prayerRoll = (d: PrayerDraft) => (diceDone(d.roll, PRAYER_DIE) ? d.roll[0]! : null);
  // Il D16 già uscito alla squadra si ritira (p. 142)
  const isDuplicate = (teamId: string, index: number) => {
    const list = prayerDrafts(teamId);
    const roll = prayerRoll(list[index]);
    return roll !== null && list.slice(0, index).some(d => prayerRoll(d) === roll);
  };
  const prayerPool = (teamId: string, d: PrayerDraft) => {
    const def = getPrayer(prayerRoll(d));
    return def?.target ? candidates[def.target.side === 'own' ? teamId : opponentOf(teamId).id] : [];
  };
  // Quanti giocatori servono (null finché manca il D3)
  const prayerNeeds = (teamId: string, d: PrayerDraft) => {
    const def = getPrayer(prayerRoll(d));
    if (!def) return null;
    const n = targetCount(def, diceDone(d.d3, 3) ? d.d3[0] : null);
    return n === null ? null : Math.min(n, prayerPool(teamId, d).length);
  };
  const prayerComplete = (teamId: string, index: number) => {
    const d = prayerDrafts(teamId)[index];
    const def = getPrayer(prayerRoll(d));
    if (!def || isDuplicate(teamId, index)) return false;
    const needed = prayerNeeds(teamId, d);
    if (needed === null) return false;
    const pool = prayerPool(teamId, d).map(c => c.ref);
    const chosen = d.players.filter(ref => pool.includes(ref));
    if (new Set(chosen).size !== needed || chosen.length !== needed) return false;
    if (def.primarySkill) return !!d.skill && !!candidates[teamId].find(c => c.ref === chosen[0])?.skills.includes(d.skill);
    return true;
  };
  const prayerResults = (teamId: string): PrayerResult[] => prayerDrafts(teamId).map(d => {
    const def = getPrayer(prayerRoll(d));
    return {
      roll: prayerRoll(d) ?? 0,
      ...(def?.target ? { players: d.players } : {}),
      ...(def?.target?.count === 'd3' && diceDone(d.d3, 3) ? { d3: d.d3[0]! } : {}),
      ...(def?.primarySkill && d.skill ? { skill: d.skill } : {}),
    };
  });
  const patchPrayer = (teamId: string, index: number, p: Partial<PrayerDraft>) => setDraft(dr => {
    const list = Array.from({ length: prayerQty(dr.inducements[teamId]) }, (_, i) => dr.prayers?.[teamId]?.[i] ?? emptyPrayer());
    list[index] = { ...list[index], ...p };
    return { ...dr, prayers: { ...dr.prayers, [teamId]: list } };
  });
  // Scelta a caso con il dado del sito: un giocatore diverso per ogni posto
  const pickRandom = (pool: PrayerCandidate[], n: number) => {
    const left = [...pool];
    const picked: string[] = [];
    while (picked.length < n && left.length) picked.push(left.splice(rollDie(left.length) - 1, 1)[0].ref);
    return picked;
  };

  const save = async () => {
    setSaving(true);
    setServerError(null);
    try {
      const body = {
        weather_roll: diceTotal(draft.weather),
        kicking_team_id: kickingTeam?.id ?? null,
        teams: Object.fromEntries(teams.map(team => {
          const d = teamDraft(team.id);
          return [team.id, {
            fair_weather: d.fair_weather, journeyman_position: d.journeyman_position || null, inducements: d.inducements, riotous_roll: d.riotous_roll,
            prayers: prayerResults(team.id),
          }];
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

  const facts = (rows: FactRow[]) => <Facts rows={rows} />;

  const d3Hint = L('Senza D3: tira un D6 e dividi, 1-2 = 1, 3-4 = 2, 5-6 = 3.', 'No D3? Roll a D6 and halve it: 1-2 = 1, 3-4 = 2, 5-6 = 3.');

  let card: React.ReactNode = null;
  switch (STEP_KEYS[draft.step]) {
    case 'intro':
      card = (
          <WizardStepCard
              title={L('Prima di iniziare', 'Before you start')}
              page="pp. 44, 94"
              explain={[
                L('La sequenza pre-partita prepara le due squadre prima del calcio d\'inizio. Il sito ti guida un passo alla volta: tifosi, meteo, **Journeymen**, incentivi e chi calcia.',
                  'The pre-game sequence gets both teams ready before kick-off. The app walks you through it one step at a time: fans, weather, **Journeymen**, inducements and who kicks.'),
                L('Per ogni tiro puoi usare i dadi veri e scrivere quello che è uscito, oppure premere **Tira**. Se devi ripetere un tiro premi **Ritira**. Niente viene salvato finché non confermi l\'ultimo passo.',
                  'For every roll you can use real dice and type what came up, or press **Roll**. If a roll has to be repeated, press **Re-roll**. Nothing is saved until you confirm the last step.'),
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
                        [L('Giocatori disponibili', 'Available players'), p.available, p.available < 11 ? 'bad' : undefined],
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
                L('Ogni allenatore tira un **D3** per i **Fair-weather Fans**, i tifosi occasionali, e lo somma ai **Dedicated Fans** della squadra: il totale è il **Fan Factor** di questa partita.',
                  'Each coach rolls a **D3** for **Fair-weather Fans**, the casual supporters, and adds it to the team\'s **Dedicated Fans**: the total is this match\'s **Fan Factor**.'),
                L('Il **Fan Factor** conta dopo la partita per gli **incassi** e, durante, per alcuni eventi di Kick-off come la **Pitch Invasion**.',
                  '**Fan Factor** matters after the match for the **winnings** and, during it, for some Kick-off events such as **Pitch Invasion**.'),
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
                    {facts([['Dedicated Fans', team.dedicated_fans], ['Fan Factor', preview(team.id).ff ?? '—', 'strong']])}
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
                L('Ogni allenatore tira un **D6** e si sommano i due risultati: la tabella del **Meteo** dice che tempo farà. Vale per tutta la partita, a meno che un evento di Kick-off non lo cambi.',
                  'Each coach rolls a **D6** and the two results are added: the **Weather** table says what it will be like. It lasts the whole match, unless a Kick-off event changes it.'),
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
                L('Ogni squadra deve poter schierare **11 giocatori**. Se tra i disponibili ne ha meno, prende gratis dei **Journeymen** fino ad arrivare a 11: sono Lineman della posizione 0-16 del roster, con in più **Loner (4+)**.',
                  'Each team must be able to field **11 players**. If fewer are available, it takes free **Journeymen** up to 11: Linemen from the roster\'s 0-16 position, with **Loner (4+)** on top.'),
                L('I **Journeymen** contano nel **CTV**, quindi pesano sugli incentivi. Dopo la partita potrai decidere se ingaggiarli.',
                  '**Journeymen** count towards **CTV**, so they affect inducements. After the match you can decide whether to hire them.'),
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
                      {facts([[L('Disponibili', 'Available'), p.available, p.available < 11 ? 'bad' : undefined], ['Journeymen', p.baseJourneymen, p.baseJourneymen ? 'strong' : undefined]])}
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
                L('Si confronta il **CTV** delle due squadre, **Journeymen** compresi. La squadra con il CTV più alto spende per prima, solo dalla propria **Treasury**.',
                  'Compare the two teams\' **CTV**, **Journeymen** included. The team with the higher CTV spends first, from its own **Treasury** only.'),
                L('L\'altra riceve la **Petty Cash**: la differenza di **CTV** più quanto ha speso la prima. Può aggiungere al massimo **50.000** dalla sua **Treasury**. A CTV pari nessuna delle due compra incentivi.',
                  'The other gets **Petty Cash**: the **CTV** difference plus whatever the first one spent. It may add at most **50,000** from its own **Treasury**. With equal CTV neither buys inducements.'),
                L('Gli **Star Player** si scelgono dal catalogo, e compaiono solo quelli che giocano per la squadra. Se non vuoi incentivi, conferma e basta.',
                  '**Star Players** come from the catalogue, and only those who play for the team are listed. If you want no inducements, just confirm.'),
              ]}
              onBack={() => go(3)}
              onNext={() => go(5)}
              blocker={blocker}
          >
            {budget.equal ? (
                <p className={wz.note}>{rich(L(`**CTV** pari (${gp(pHome.ctv)} gp): nessuna squadra può comprare incentivi.`, `Equal **CTV** (${gp(pHome.ctv)} gp): neither team may buy inducements.`), language)}</p>
            ) : (
                <p className={wz.note}>
                  {rich(L(
                      `**${budget.higher.name}** ha il CTV più alto: spende per prima, dalla sua **Treasury**. **${budget.lower.name}** riceve **${gp(budget.petty)} gp** di **Petty Cash**.`,
                      `**${budget.higher.name}** has the higher CTV: it spends first, from its **Treasury**. **${budget.lower.name}** gets **${gp(budget.petty)} gp** of **Petty Cash**.`), language)}
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
                        [L('Turno', 'Order'), budget.equal ? '—' : isHigher ? L('Spende per prima', 'Spends first') : 'Petty Cash'],
                      ])}
                      {!budget.equal && (
                          <InducementPicker team={team} preview={p} inducements={draft.inducements[team.id] ?? []}
                                            budget={isHigher ? { total: p.treasury, petty: 0, fromTreasury: p.treasury } : { total: budget.petty + budget.maxTopUp, petty: budget.petty, fromTreasury: budget.maxTopUp }}
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
                <p className={wz.note}>{rich(L('**Prayers to Nuffle**: il **D16** di ogni preghiera si tira nel prossimo passo.', '**Prayers to Nuffle**: the **D16** for each prayer is rolled in the next step.'), language)}</p>
            )}
          </WizardStepCard>
      );
      break;
    }

    case 'prayers': {
      const pending = teams.some(tm => prayerDrafts(tm.id).some((_, i) => !prayerComplete(tm.id, i)));
      card = (
          <WizardStepCard
              title="Prayers to Nuffle"
              page="pp. 142-143"
              explain={[
                L('Per ogni **Prayer to Nuffle** comprato la squadra tira un **D16** sulla tabella. Se esce un risultato che la squadra ha già, si ritira. Puoi tirare qui oppure scrivere il dado tirato al tavolo.',
                  'For every **Prayer to Nuffle** bought the team rolls a **D16** on the table. If the team already has that result, roll again. You can roll here or type the die rolled at the table.'),
                L('Alcune preghiere scelgono dei giocatori, a caso o a scelta: solo chi gioca questa partita, **Journeymen** compresi, mai gli **Star Player**. Gli effetti durano fino a fine partita e il sito li tiene per la squadra: il tabellone li mostra e il referto conta gli **SPP** in più.',
                  'Some prayers pick players, at random or by choice: only those playing this game, **Journeymen** included, never **Star Players**. Effects last until the end of the game and the app keeps them for the team: the board shows them and the report counts the extra **SPP**.'),
              ]}
              onBack={() => go(4)}
              onNext={() => go(6)}
              blocker={pending ? L('Completa i Prayers to Nuffle: dado, doppioni da ritirare e giocatori', 'Complete the Prayers to Nuffle: die, duplicates to re-roll and players') : null}
          >
            <div className={wz.teams}>
              {teams.map(team => teamBox(team, prayerDrafts(team.id).length === 0 ? (
                  <p className={wz.note}>{L('Nessuna preghiera comprata.', 'No prayers bought.')}</p>
              ) : (
                  <>
                    {prayerDrafts(team.id).map((d, i) => {
                      const roll = prayerRoll(d);
                      const def = getPrayer(roll);
                      const row = roll ? rowForTotal(getMatchTable('prayers')!, roll) : null;
                      const duplicate = isDuplicate(team.id, i);
                      const pool = prayerPool(team.id, d);
                      const needed = prayerNeeds(team.id, d);
                      const chosen = d.players.filter(ref => pool.some(c => c.ref === ref));
                      const byRef = (ref: string) => pool.find(c => c.ref === ref) ?? null;
                      const random = def?.target?.pick === 'random';
                      const whose = def?.target?.side === 'opponent' ? opponentOf(team.id).name : team.name;
                      return (
                          <div key={i} className={wz.dice}>
                            <DiceRoll label={`Prayer ${i + 1}`} sides={PRAYER_DIE} values={d.roll}
                                      onChange={v => patchPrayer(team.id, i, { roll: v, d3: emptyDice(), players: [], skill: '' })} />
                            {duplicate && <p className={wz.warn}>{L(`${def?.name}: la squadra l'ha già. Premi Ritira e tira di nuovo (p. 142).`, `${def?.name}: the team already has it. Press Re-roll and roll again (p. 142).`)}</p>}
                            {def && row && !duplicate && (
                                <>
                                  <div className={`${wz.outcome} ${row.tone === 'good' ? wz.outcomeGood : ''}`}>
                                    <span className={wz.outcomeName}>{def.name}</span>
                                    <p>{row.text[language]}</p>
                                  </div>
                                  {def.target?.count === 'd3' && (
                                      <DiceRoll label={L('Quanti avversari', 'How many opponents')} sides={3} values={d.d3} hint={d3Hint}
                                                onChange={v => patchPrayer(team.id, i, { d3: v, players: [] })} />
                                  )}
                                  {def.target && needed !== null && (
                                      <>
                                        {Array.from({ length: needed }, (_, k) => (
                                            <label key={k} className={wz.field}>
                                              {random ? L(`Giocatore a caso di ${whose}`, `Random ${whose} player`) : L(`Giocatore di ${whose} a scelta`, `${whose} player of your choice`)}{needed > 1 ? ` ${k + 1}` : ''}
                                              <select value={chosen[k] ?? ''} onChange={e => {
                                                const next = [...chosen];
                                                next[k] = e.target.value;
                                                patchPrayer(team.id, i, { players: next.filter(Boolean), skill: '' });
                                              }}>
                                                <option value="">—</option>
                                                {pool.filter(c => c.ref === chosen[k] || !chosen.includes(c.ref)).map(c => <option key={c.ref} value={c.ref}>{c.name}</option>)}
                                              </select>
                                            </label>
                                        ))}
                                        {random && (
                                            <div className={wz.actions}>
                                              <button type="button" className="btn btn-slate" onClick={() => patchPrayer(team.id, i, { players: pickRandom(pool, needed), skill: '' })}>
                                                <Dices size={18} /> {L('Scegli a caso', 'Pick at random')}
                                              </button>
                                            </div>
                                        )}
                                        {random && <p className={wz.note}>{L('Al tavolo: tirate un dado per ogni giocatore e sceglietelo dall\'elenco.', 'At the table: roll a die for each player and pick them from the list.')}</p>}
                                        {chosen.map(ref => {
                                          const c = byRef(ref);
                                          const effect = def.primarySkill ? '' : prayerEffectText({ roll: def.roll }, c);
                                          return effect ? <p key={ref} className={wz.note}><b>{c?.name}</b>: {effect}</p> : null;
                                        })}
                                        {def.primarySkill && chosen[0] && (
                                            <label className={wz.field}>{L('Skill Primary a scelta', 'Primary skill of your choice')}
                                              <select value={d.skill} onChange={e => patchPrayer(team.id, i, { skill: e.target.value })}>
                                                <option value="">—</option>
                                                {(byRef(chosen[0])?.skills ?? []).map(sk => <option key={sk} value={sk}>{sk}</option>)}
                                              </select>
                                            </label>
                                        )}
                                      </>
                                  )}
                                </>
                            )}
                          </div>
                      );
                    })}
                  </>
              )))}
            </div>
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
                L('Ultimo passo: un **roll-off**. Ogni allenatore tira un **D6** e chi fa di più decide se calciare o ricevere il primo drive. Con un pareggio si ritira.',
                  'Last step: a **roll-off**. Each coach rolls a **D6** and the higher decides whether to kick or receive the first drive. On a tie, roll again.'),
                L('Nel secondo tempo le parti si invertono: calcia chi aveva ricevuto.', 'In the second half it swaps: whoever received now kicks.'),
              ]}
              onBack={() => go(5)}
              onNext={() => go(7)}
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
                L('Controlla tutto. Con la conferma il sito salva il pre-partita: aggiunge i **Journeymen**, scala la **Treasury** per gli incentivi e registra meteo e squadra che calcia.',
                  'Check everything. Confirming saves the pre-game: the app adds the **Journeymen**, takes the inducements out of the **Treasury** and records weather and kicking team.'),
                L('Finché la partita non è giocata potrai rifarlo da capo.', 'Until the match is played you can redo it from scratch.'),
              ]}
              onBack={() => go(6)}
              onNext={save}
              nextLabel={L('Conferma il pre-partita', 'Confirm the pre-game')}
              busy={saving}
              blocker={serverError}
          >
            {facts([
              [L('Meteo', 'Weather'), weatherRow ? `${weatherRow.name} (${diceTotal(draft.weather)})` : '—', 'strong'],
              [L('Calcia il primo drive', 'Kicks the first drive'), kickingTeam?.name ?? '—', 'strong'],
            ])}
            <div className={wz.teams}>
              {teams.map(team => {
                const p = preview(team.id);
                const fromTreasury = budget.equal ? 0 : team.id === budget.higher.id ? p.cost : Math.max(0, p.cost - budget.petty);
                const everyone = [...candidates[home.id], ...candidates[away.id]];
                return teamBox(team, (
                    <>
                      {facts([
                        ['Fan Factor', p.ff ?? '—', 'strong'],
                        ['Journeymen', p.journeymen],
                        ['CTV', `${gp(p.ctv)} gp`],
                        [L('Incentivi', 'Inducements'), p.cost ? `${gp(p.cost)} gp` : L('nessuno', 'none')],
                        ['Treasury', fromTreasury ? `${gp(p.treasury)} → ${gp(p.treasury - fromTreasury)} gp` : `${gp(p.treasury)} gp`, fromTreasury ? 'bad' : undefined],
                      ])}
                      <PrayerList prayers={prayerResults(team.id)} player={ref => everyone.find(c => c.ref === ref) ?? null} />
                    </>
                ));
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
