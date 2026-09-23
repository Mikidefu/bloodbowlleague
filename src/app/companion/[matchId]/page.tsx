'use client';
// Il tabellone di una squadra sul telefono: turno, reroll, kick-off (se calcia), statistiche, avvisi.
// Tasti grandi da premere con una mano sola a bordo campo; ogni tocco va in coda e resiste ai buchi di rete.

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, BellOff, Dices, LogOut, Sun, Undo2, WifiOff, X } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { clearSession, queueKey, readSession, type CompanionSession } from '@/lib/live/companionSession';
import { describeEvent } from '@/lib/live/describe';
import { kickoffHeadline } from '@/lib/live/kickoff';
import { noticesFor, type Notice } from '@/lib/live/notify';
import { EXTRA_TIME_HALF, TURNS_PER_HALF, type LiveEvent, type StatEvent } from '@/lib/live/types';
import { useLiveMatch } from '@/lib/live/useLiveMatch';
import { getMatchTable, rowForTotal } from '@/lib/matchTables';
import type { MatchDetails } from '@/lib/types';
import LangSwitch from '../LangSwitch';
import { usePush } from '../usePush';
import { useWakeLock } from '../useWakeLock';
import styles from '../Companion.module.css';

const STATS: { type: StatEvent; short: string; it: string; en: string }[] = [
  { type: 'touchdown', short: 'TD', it: 'Touchdown', en: 'Touchdown' },
  { type: 'casualty', short: 'CAS', it: 'Casualty', en: 'Casualty' },
  { type: 'completion', short: 'CMP', it: 'Passaggio', en: 'Completion' },
  { type: 'interception', short: 'INT', it: 'Intercetto', en: 'Interception' },
  { type: 'ttm', short: 'TTM', it: 'Lancio compagno', en: 'Throw Team-mate' },
  { type: 'landing', short: 'ATT', it: 'Atterraggio', en: 'Landing' },
];
const WAKE_KEY = 'bbl-companion-wake';
const TAP_COOLDOWN_MS = 700;   // contro il doppio tocco involontario

export default function CompanionMatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<CompanionSession | null>(null);

  useEffect(() => {
    const saved = readSession();
    if (!saved || saved.match_id !== matchId) { router.replace('/companion'); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la sessione sta in localStorage: si legge solo nel browser
    setSession(saved);
  }, [matchId, router]);

  if (!session) return <div className={styles.app}><p className={styles.help}>…</p></div>;
  return <Board session={session} />;
}

function Board({ session }: { session: CompanionSession }) {
  const router = useRouter();
  const { language } = useLanguage();
  const L = (it: string, en: string) => (language === 'it' ? it : en);
  const [match, setMatch] = useState<MatchDetails | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [picking, setPicking] = useState<StatEvent | null>(null);
  const [manual, setManual] = useState(false);
  const [dice, setDice] = useState(['', '']);
  const [cooling, setCooling] = useState(false);
  // Il Board si monta solo nel browser (dopo aver letto la sessione), quindi localStorage qui c'è
  const [wake, setWake] = useState(() => { try { return localStorage.getItem(WAKE_KEY) === '1'; } catch { return false; } });
  const wakeLock = useWakeLock(wake);
  const push = usePush({ matchId: session.match_id, token: session.token, language });
  const ctxRef = useRef<Parameters<typeof noticesFor>[2] | null>(null);
  const myTeam = session.team_id;

  useEffect(() => {
    fetch(`/api/schedule/${session.match_id}`).then(r => r.json()).then(setMatch).catch(() => { /* il tabellone funziona anche senza nomi */ });
  }, [session.match_id]);

  const leave = useCallback((reason: 'unpaired' | 'ended' | null) => {
    clearSession();
    router.replace(reason ? `/companion?msg=${reason}` : '/companion');
  }, [router]);

  const onNewEvents = useCallback((events: LiveEvent[]) => {
    if (!ctxRef.current) return;
    const fresh = noticesFor(events, myTeam, ctxRef.current);
    if (!fresh.length) return;
    setNotices(list => [...list, ...fresh].slice(-3));
    // Vibrazione solo dopo un tocco sulla pagina (il browser la blocca prima); su iPhone non esiste e si salta
    const touched = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive ?? true;
    if (touched && fresh.some(n => n.tone !== 'neutral')) navigator.vibrate?.([200, 100, 200]);
    for (const n of fresh) setTimeout(() => setNotices(list => list.filter(x => x.id !== n.id)), 8000);
  }, [myTeam]);

  const live = useLiveMatch({
    matchId: session.match_id, token: session.token, queueKey: queueKey(session.match_id),
    onNewEvents, onUnauthorized: () => leave('unpaired'),
  });
  const { state } = live;

  // Scollegato dall'admin (o squadra presa da un altro telefono): il server non ci riconosce più
  useEffect(() => {
    if (live.live?.status === 'live' && live.me === null) leave('unpaired');
  }, [live.live?.status, live.me, leave]);

  const teamName = useCallback((id: string | null) =>
    !match ? '—' : id === match.home_team_id ? match.home_name : id === match.away_team_id ? match.away_name : '—', [match]);
  const players = useMemo(() => (match ? [...match.homePlayers, ...match.awayPlayers] : []), [match]);
  const playerName = useCallback((id: string) => players.find(p => p.id === id)?.name ?? null, [players]);
  const ctx = useMemo(() => ({ language, teamName, playerName, events: live.events }), [language, teamName, playerName, live.events]);
  useEffect(() => { ctxRef.current = ctx; }, [ctx]);

  // Un tocco alla volta: il bottone si ferma un attimo, così un doppio tocco non vale due turni.
  // Il blocco sta in un ref: lo stato di React arriverebbe tardi se i due tocchi sono ravvicinati.
  const coolingRef = useRef(false);
  const tap = (fn: () => void) => () => {
    if (coolingRef.current) return;
    coolingRef.current = true;
    setCooling(true);
    fn();
    setTimeout(() => { coolingRef.current = false; setCooling(false); }, TAP_COOLDOWN_MS);
  };
  const toggleWake = () => {
    const next = !wake;
    setWake(next);
    try { localStorage.setItem(WAKE_KEY, next ? '1' : '0'); } catch { /* resta per questa sessione */ }
  };

  if (live.load === 'loading') return <div className={styles.app}><p className={styles.help}>{L('Collegamento...', 'Connecting...')}</p></div>;
  if (live.load === 'not_started' || !live.live) {
    return (
        <div className={styles.app}>
          <p className={styles.notice}>{L('La partita dal vivo è stata azzerata dall’admin.', 'The live match was reset by the admin.')}</p>
          <button type="button" className={`btn btn-primary ${styles.wide}`} onClick={() => leave(null)}>{L('Torna all’ingresso', 'Back to the start')}</button>
        </div>
    );
  }

  const ended = live.live.status === 'ended';
  const me = state.teams[myTeam];
  const oppId = myTeam === state.home_team_id ? state.away_team_id : state.home_team_id;
  const opp = oppId ? state.teams[oppId] : undefined;
  const color = match ? (myTeam === match.home_team_id ? match.home_color : match.away_color) : null;
  const inDrive = state.status === 'in_drive';
  const iKick = state.status === 'awaiting_kickoff' && state.kicking_team_id === myTeam;
  const weatherRoll = state.weather_roll ?? match?.weather_roll ?? null;
  const weather = weatherRoll ? rowForTotal(getMatchTable('weather')!, weatherRoll) : null;
  const halfLabel = state.half === EXTRA_TIME_HALF ? L('Supplementari', 'Extra time') : L(`${state.half}° tempo`, `Half ${state.half}`);
  const recent = [...live.events].reverse().slice(0, 8);
  const canUndo = (e: LiveEvent) => e.team_id === myTeam && e.source !== 'server' && !['undo', 'half_started'].includes(e.type) && !state.voided.includes(e.id);
  const myPlayers = players.filter(p => p.team_id === myTeam && !p.unavailable);

  const rollKickoff = async () => {
    const values = manual && dice.every(d => /^[1-6]$/.test(d)) ? { dice: [Number(dice[0]), Number(dice[1])] as [number, number] } : undefined;
    const status = await live.kickoff(values);
    if (status === 'duplicate') setNotices(list => [...list, { id: `dup-${Date.now()}`, text: L('Il kick-off era già stato tirato: vale quello.', 'The kick-off had already been rolled: that one stands.'), tone: 'neutral' as const }].slice(-3));
    setManual(false);
    setDice(['', '']);
  };
  const record = (type: StatEvent, playerId: string | null) => {
    live.send(type, myTeam, playerId ? { player_id: playerId } : {});
    setPicking(null);
  };
  const startHalf = () => {
    const turns = [me?.turn ?? 0, opp?.turn ?? 0];
    const over = turns.every(t => t >= TURNS_PER_HALF);
    const ask = over
      ? L('Iniziare il secondo tempo? I Team Re-roll tornano pieni.', 'Start the second half? Team Re-rolls are replenished.')
      : L(`I turni non sono finiti (${turns[0]} e ${turns[1]} su ${TURNS_PER_HALF}). Iniziare comunque il secondo tempo?`, `The turns are not over (${turns[0]} and ${turns[1]} of ${TURNS_PER_HALF}). Start the second half anyway?`);
    if (confirm(ask)) live.send('half_started', null, { half: 2 });
  };

  return (
      <div className={styles.app} style={{ '--team-color': color ?? undefined } as React.CSSProperties}>
        <header className={styles.scorebar}>
          <div className={styles.scoreRow}>
            <span className={`${styles.scoreTeam} ${myTeam === state.home_team_id ? styles.scoreMine : ''}`}>{teamName(state.home_team_id)}</span>
            <strong className={styles.scoreNum}>{state.teams[state.home_team_id ?? '']?.score ?? 0} – {state.teams[state.away_team_id ?? '']?.score ?? 0}</strong>
            <span className={`${styles.scoreTeam} ${myTeam === state.away_team_id ? styles.scoreMine : ''}`}>{teamName(state.away_team_id)}</span>
          </div>
          <div className={styles.metaRow}>
            <span>{halfLabel}</span>
            <span>Drive {state.drive || '—'}</span>
            {weather && <span>{weather.name}</span>}
            <span className={styles.sync}>
              {live.offline ? <><WifiOff size={14} /> {L('offline', 'offline')}</> : live.pending ? L(`invio ${live.pending}`, `sending ${live.pending}`) : '●'}
            </span>
          </div>
        </header>

        <div className={styles.toasts} aria-live="polite">
          {notices.map(n => (
              <button key={n.id} type="button" className={`${styles.toast} ${n.tone === 'good' ? styles.toastGood : n.tone === 'bad' ? styles.toastBad : ''}`}
                onClick={() => setNotices(list => list.filter(x => x.id !== n.id))}>
                {n.text}
              </button>
          ))}
          {live.errors.length > 0 && (
              <button type="button" className={`${styles.toast} ${styles.toastBad}`} onClick={live.dismissErrors}>{live.errors[live.errors.length - 1]}</button>
          )}
        </div>

        {ended && (
            <section className={styles.panel}>
              <h1 className={styles.title}>{L('Partita chiusa', 'Match closed')}</h1>
              <p className={styles.help}>{L('L’admin ha chiuso la partita dal vivo: i numeri passano al referto.', 'The admin closed the live match: the numbers go to the match report.')}</p>
              <button type="button" className={`btn ${styles.wide}`} onClick={() => leave('ended')}>{L('Esci', 'Leave')}</button>
            </section>
        )}

        {!ended && iKick && (
            <section className={`${styles.panel} ${styles.kick}`}>
              <h2 className={styles.title}>{L(`Tocca a te: kick-off del drive ${state.drive + 1}`, `Your turn: drive ${state.drive + 1} kick-off`)}</h2>
              <p className={styles.help}>{L('Dopo la deviazione del calcio, con la palla in aria (p. 48).', 'After the kick deviates, with the ball in the air (p. 48).')}</p>
              {manual && (
                  <div className={styles.diceRow}>
                    {[0, 1].map(i => (
                        <input key={i} className={styles.die} inputMode="numeric" maxLength={1} placeholder="?" aria-label={`D6 ${i + 1}`} value={dice[i]}
                          onChange={e => { const v = e.target.value.replace(/[^1-6]/g, ''); setDice(d => d.map((x, j) => (j === i ? v : x))); }} />
                    ))}
                  </div>
              )}
              <button type="button" className={`btn btn-primary ${styles.big}`} onClick={rollKickoff} disabled={manual && !dice.every(d => /^[1-6]$/.test(d))}>
                <Dices size={24} /> {manual ? L('Registra i dadi', 'Record the dice') : L('Tira il kick-off', 'Roll the kick-off')}
              </button>
              <button type="button" className={`btn ${styles.wide}`} onClick={() => setManual(m => !m)}>
                {manual ? L('Tira il sito', 'Let the site roll') : L('Ho tirato i dadi al tavolo', 'I rolled the dice at the table')}
              </button>
            </section>
        )}
        {!ended && state.status === 'awaiting_kickoff' && !iKick && (
            <p className={styles.notice}>{L(`In attesa del kick-off di ${teamName(state.kicking_team_id)}.`, `Waiting for ${teamName(state.kicking_team_id)}'s kick-off.`)}</p>
        )}
        {state.last_kickoff && inDrive && (
            <p className={styles.kickLine}><Dices size={16} aria-hidden="true" /> {state.last_kickoff.name}: {kickoffHeadline(state.last_kickoff, teamName, language)}</p>
        )}

        {me && !ended && (
            <>
              <section className={styles.panel}>
                <div className={styles.counter}>
                  <span className={styles.counterLabel}>{L('Il tuo turno', 'Your turn')}</span>
                  <strong className={styles.counterNum}>{me.turn || '—'}<small>/{TURNS_PER_HALF}</small></strong>
                  {opp && <span className={styles.counterSide}>{L('avversario', 'opponent')} {opp.turn || '—'}</span>}
                </div>
                <button type="button" className={`btn btn-primary ${styles.big}`} disabled={!inDrive || me.turn >= TURNS_PER_HALF || cooling}
                  onClick={tap(() => live.send('turn_started', myTeam))}>
                  {me.turn >= TURNS_PER_HALF ? L('Tempo finito', 'Half over') : L(`Inizia il turno ${me.turn + 1}`, `Start turn ${me.turn + 1}`)}
                </button>
                {state.status === 'awaiting_kickoff' && <p className={styles.help}>{L('Il turno si avanza dopo il kick-off.', 'Turns start after the kick-off.')}</p>}
              </section>

              <section className={styles.panel}>
                <div className={styles.counter}>
                  <span className={styles.counterLabel}>Team Re-roll</span>
                  <strong className={styles.counterNum}>{me.rerolls}</strong>
                </div>
                <button type="button" className={`btn ${styles.big}`} disabled={me.rerolls < 1 || cooling} onClick={tap(() => live.send('reroll_used', myTeam, { kind: 'team' }))}>
                  {L('Usa un Team Re-roll', 'Use a Team Re-roll')}
                </button>
                {me.drive_rerolls > 0 && (
                    <div className={styles.bonus}>
                      <span>{L('Brilliant Coaching: reroll solo per questo drive', 'Brilliant Coaching: re-roll for this drive only')}</span>
                      <button type="button" className="btn btn-primary" disabled={cooling} onClick={tap(() => live.send('reroll_used', myTeam, { kind: 'drive' }))}>{L('Usa', 'Use')}</button>
                    </div>
                )}
                {me.mascot && (
                    <div className={styles.bonus}>
                      <span>{L('Team Mascot: tira il D6 e tocca il risultato (4+ ok)', 'Team Mascot: roll the D6 and tap the result (4+ ok)')}</span>
                      <div className={styles.dieButtons}>
                        {[1, 2, 3, 4, 5, 6].map(n => (
                            <button key={n} type="button" className="btn" disabled={cooling} onClick={tap(() => live.send('reroll_used', myTeam, { kind: 'mascot', roll: n }))}>{n}</button>
                        ))}
                      </div>
                    </div>
                )}
                {me.bribes > 0 && (
                    <div className={styles.bonus}>
                      <span>Bribe: <strong>{me.bribes}</strong></span>
                      <button type="button" className="btn" disabled={cooling} onClick={tap(() => live.send('bribe_used', myTeam))}>{L('Usa', 'Use')}</button>
                    </div>
                )}
                {me.cheering_fans && <p className={styles.help}>{L('Cheering Fans: un assist offensivo in più al primo Block del prossimo turno.', 'Cheering Fans: an extra Offensive Assist on the first Block of your next turn.')}</p>}
              </section>

              <section className={styles.panel}>
                <h2 className={styles.title}>{L('Segna', 'Record')}</h2>
                <div className={styles.statGrid}>
                  {STATS.map(s => (
                      <button key={s.type} type="button" className="btn" disabled={s.type === 'touchdown' && !inDrive} onClick={() => setPicking(s.type)}>
                        <span className={styles.statShort}>{s.short}</span>
                        <span className={styles.statLong}>{s[language]}</span>
                      </button>
                  ))}
                </div>
              </section>
            </>
        )}

        {recent.length > 0 && (
            <section className={styles.panel}>
              <h2 className={styles.title}>{L('Ultime azioni', 'Latest actions')}</h2>
              <ul className={styles.recent}>
                {recent.map(e => (
                    <li key={e.id} className={state.voided.includes(e.id) ? styles.voided : undefined}>
                      <span>{describeEvent(e, ctx)}</span>
                      {!ended && canUndo(e) && (
                          <button type="button" className={`btn ${styles.iconBtn}`} aria-label={L('Annulla', 'Undo')}
                            onClick={() => { if (confirm(L(`Annullare "${describeEvent(e, ctx)}"?`, `Undo "${describeEvent(e, ctx)}"?`))) live.send('undo', myTeam, { event_id: e.id }); }}>
                            <Undo2 size={18} />
                          </button>
                      )}
                    </li>
                ))}
              </ul>
            </section>
        )}

        {!ended && push.state !== 'unavailable' && push.state !== 'checking' && (
            <section className={styles.panel}>
              <h2 className={styles.title}><Bell size={20} aria-hidden="true" /> {L('Avvisi con l’app chiusa', 'Alerts with the app closed')}</h2>
              {push.state === 'on' && <p className={styles.help}>{L('Attivi: kick-off, reroll vinti e novità della partita arrivano anche con il telefono in tasca.', 'On: kick-offs, re-rolls won and match news arrive even with the phone in your pocket.')}</p>}
              {(push.state === 'off' || push.state === 'busy') && <p className={styles.help}>{L('Ricevi il kick-off e il reroll vinto anche con lo schermo spento o l’app chiusa.', 'Get the kick-off and the re-roll you won even with the screen off or the app closed.')}</p>}
              {push.state === 'needs-install' && <p className={styles.help}>{L('Su iPhone gli avvisi arrivano solo con la companion sulla schermata Home: in Safari tocca Condividi, poi “Aggiungi alla schermata Home”, e aprila da lì.', 'On iPhone alerts only work with the companion on the Home Screen: in Safari tap Share, then “Add to Home Screen”, and open it from there.')}</p>}
              {push.state === 'unsupported' && <p className={styles.help}>{L('Questo browser non supporta le notifiche push.', 'This browser does not support push notifications.')}</p>}
              {push.state === 'denied' && <p className={styles.help}>{L('Le notifiche per questo sito sono bloccate: riattivale nelle impostazioni del browser o del telefono.', 'Notifications for this site are blocked: turn them back on in the browser or phone settings.')}</p>}
              {push.state === 'error' && <p className={styles.error}>{L('Non sono riuscito ad attivarle. Riprova tra poco.', 'I could not turn them on. Try again shortly.')}</p>}
              {push.state === 'on' ? (
                  <button type="button" className={`btn ${styles.wide}`} onClick={push.disable}><BellOff size={18} /> {L('Disattiva gli avvisi', 'Turn alerts off')}</button>
              ) : (push.state === 'off' || push.state === 'busy' || push.state === 'error') && (
                  <button type="button" className={`btn btn-primary ${styles.wide}`} disabled={push.state === 'busy'} onClick={push.enable}><Bell size={18} /> {L('Attiva gli avvisi', 'Turn alerts on')}</button>
              )}
            </section>
        )}

        <footer className={styles.footer}>
          {!ended && state.half === 1 && <button type="button" className="btn" onClick={startHalf}>{L('Inizia il secondo tempo', 'Start the second half')}</button>}
          {wakeLock.supported && (
              <button type="button" className="btn" aria-pressed={wake} onClick={toggleWake}>
                <Sun size={18} /> {wake && wakeLock.active ? L('Schermo sempre acceso', 'Screen stays on') : L('Tieni lo schermo acceso', 'Keep the screen on')}
              </button>
          )}
          {!ended && (
              <button type="button" className="btn" onClick={async () => {
                if (!confirm(L('Lasciare la squadra? Potrai ricollegarti col codice.', 'Leave the team? You can reconnect with the code.'))) return;
                await live.leave();
                leave(null);
              }}><LogOut size={18} /> {L('Lascia la squadra', 'Leave the team')}</button>
          )}
          <LangSwitch />
        </footer>

        {picking && (
            <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={L('Chi è stato?', 'Who was it?')}>
              <div className={styles.sheetHead}>
                <strong>{STATS.find(s => s.type === picking)?.[language]}: {L('chi è stato?', 'who was it?')}</strong>
                <button type="button" className={`btn ${styles.iconBtn}`} aria-label={L('Chiudi', 'Close')} onClick={() => setPicking(null)}><X size={20} /></button>
              </div>
              <div className={styles.playerGrid}>
                {myPlayers.map(p => (
                    <button key={p.id} type="button" className="btn" onClick={() => record(picking, p.id)}>
                      <span className={styles.jersey}>{p.jersey_number ?? '·'}</span>
                      <span className={styles.playerName}>{p.name}</span>
                    </button>
                ))}
              </div>
              <button type="button" className={`btn ${styles.wide}`} onClick={() => record(picking, null)}>{L('Senza giocatore', 'No player')}</button>
            </div>
        )}
      </div>
  );
}
