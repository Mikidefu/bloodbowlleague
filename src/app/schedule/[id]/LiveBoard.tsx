'use client';
// Tabellone della partita dal vivo per l'admin: collegamento dei telefoni, kick-off condiviso,
// turni, reroll e statistiche delle due squadre, cronologia con annullamento.

import { useMemo, useState } from 'react';
import { Dices, Minus, Plus, Radio, RotateCcw, Smartphone, Undo2, WifiOff } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { describeEvent } from '@/lib/live/describe';
import { problemText, type LiveProblem } from '@/lib/live/errors';
import { kickoffHeadline, type ManualKickoffDice } from '@/lib/live/kickoff';
import { EXTRA_TIME_HALF, TURNS_PER_HALF, type LiveEvent, type LiveTeamState, type StatEvent } from '@/lib/live/types';
import { whyNot } from '@/lib/live/rules';
import type { useLiveMatch } from '@/lib/live/useLiveMatch';
import { getMatchTable, rowForTotal } from '@/lib/matchTables';
import type { MatchDetails } from '@/lib/types';
import QrCode from '@/components/live/QrCode';
import wz from '@/components/match/Wizard.module.css';
import styles from './LiveBoard.module.css';

type Live = ReturnType<typeof useLiveMatch>;
const ADMIN = { role: 'admin' } as const;

const STAT_BUTTONS: { type: StatEvent; label: string; title: { it: string; en: string } }[] = [
  { type: 'touchdown', label: 'TD', title: { it: 'Touchdown (chiude il drive)', en: 'Touchdown (ends the drive)' } },
  { type: 'casualty', label: 'CAS', title: { it: 'Casualty', en: 'Casualty' } },
  { type: 'completion', label: 'CMP', title: { it: 'Passaggio riuscito', en: 'Completion' } },
  { type: 'interception', label: 'INT', title: { it: 'Intercetto', en: 'Interception' } },
  { type: 'ttm', label: 'TTM', title: { it: 'Lancio del compagno riuscito', en: 'Successful Throw Team-mate' } },
  { type: 'landing', label: 'ATT', title: { it: 'Atterraggio riuscito', en: 'Successful landing' } },
];
const STAT_SHORT: Record<string, string> = { touchdowns: 'TD', casualties: 'CAS', completions: 'CMP', interceptions: 'INT', ttm: 'TTM', landings: 'ATT' };
const NEEDS_ROLLS = [6, 7, 11, 12];
const NEEDS_D3 = [4, 9, 10, 12];

const statLine = (stats: Partial<Record<string, number>>) =>
  Object.entries(stats).filter(([, n]) => n).map(([k, n]) => `${n} ${STAT_SHORT[k] ?? k}`).join(', ');

export default function LiveBoard({ match, live }: { match: MatchDetails; live: Live }) {
  const { language } = useLanguage();
  const L = (it: string, en: string) => (language === 'it' ? it : en);
  const { state, events } = live;
  const teamIds = [match.home_team_id, match.away_team_id];
  const teamName = (id: string | null) => (id === match.home_team_id ? match.home_name : id === match.away_team_id ? match.away_name : '—');
  const color = (id: string) => (id === match.home_team_id ? match.home_color : match.away_color) ?? undefined;
  const players = useMemo(() => [...match.homePlayers, ...match.awayPlayers], [match]);
  const playerName = (id: string) => players.find(p => p.id === id)?.name ?? null;
  const describe = (e: LiveEvent) => describeEvent(e, { language, teamName, playerName, events });

  if (live.load === 'loading') return <p className={wz.note}>{L('Collegamento alla partita dal vivo...', 'Connecting to the live match...')}</p>;

  if (live.load === 'not_started' || !live.live) {
    return (
        <section className={`card ${wz.card}`}>
          <header className={wz.cardHead}><h3 className={wz.cardTitle}><Radio size={20} aria-hidden="true" /> {L('Partita dal vivo', 'Live match')}</h3></header>
          <div className={wz.explain}>
            <p>{L('Tieni il conto di turni, reroll, touchdown e casualty mentre si gioca. I due allenatori possono collegare il loro telefono e segnare le azioni della propria squadra; il kick-off lo vedete tutti nello stesso momento.',
                'Keep track of turns, re-rolls, touchdowns and casualties while you play. Both coaches can connect their phone and record their own team\'s actions; everyone sees the kick-off at the same moment.')}</p>
            <p>{L('Alla fine i numeri restano una bozza: li confermi tu nel referto.', 'At the end the numbers are only a draft: you confirm them in the match report.')}</p>
          </div>
          <div className={wz.actions}>
            <button type="button" className="btn btn-primary" onClick={() => live.start()}><Radio size={18} /> {L('Avvia la partita dal vivo', 'Start the live match')}</button>
          </div>
          <Problems live={live} L={L} teamName={teamName} />
        </section>
    );
  }

  const ended = live.live.status === 'ended';
  const weatherRoll = state.weather_roll ?? match.weather_roll ?? null;
  const weather = weatherRoll ? rowForTotal(getMatchTable('weather')!, weatherRoll) : null;
  const halfLabel = state.half === EXTRA_TIME_HALF ? L('Supplementari', 'Extra time') : L(`${state.half}° tempo`, `Half ${state.half}`);
  const undoable = (e: LiveEvent) => !['match_started', 'undo'].includes(e.type) && !state.voided.includes(e.id) && !String(e.payload.cause ?? '');

  return (
      <section className={`card ${wz.card} ${styles.board}`}>
        <header className={styles.bar}>
          <span className={ended ? styles.pillEnded : styles.pillLive}>{ended ? L('Chiusa', 'Closed') : 'LIVE'}</span>
          <span className={styles.barItem}>{halfLabel}</span>
          <span className={styles.barItem}>Drive {state.drive || '—'}</span>
          {weather && <span className={styles.barItem}>{weather.name}</span>}
          {ended && <button type="button" className={`btn ${styles.small}`} onClick={() => live.start()}>{L('Riapri', 'Reopen')}</button>}
          <span className={styles.barSync}>
            {live.offline ? <><WifiOff size={16} /> {L('Senza rete: riprovo', 'Offline: retrying')}</> : live.pending ? L(`Invio in corso (${live.pending})`, `Sending (${live.pending})`) : L('Sincronizzato', 'In sync')}
          </span>
        </header>

        <Problems live={live} L={L} teamName={teamName} />

        {!ended && (
            <div className={styles.connect}>
              {live.live.join_code && (
                  <QrCode value={`${window.location.origin}/companion?code=${live.live.join_code}`} size={148}
                    label={L(`QR per collegare i telefoni, codice ${live.live.join_code}`, `QR to connect the phones, code ${live.live.join_code}`)} />
              )}
              <div className={styles.connectText}>
                <span className={styles.connectLabel}><Smartphone size={16} aria-hidden="true" /> {L('Codice per i telefoni', 'Code for the phones')}</span>
                <strong className={styles.code}>{live.live.join_code ?? '······'}</strong>
                <span className={styles.connectHint}>{L('Inquadra il QR col telefono, oppure apri /companion e scrivi il codice. Ogni allenatore sceglie la sua squadra.', 'Scan the QR with the phone, or open /companion and type the code. Each coach picks their own team.')}</span>
              </div>
              <ul className={styles.paired}>
                {teamIds.map(id => (
                    <li key={id}>
                      <span className={live.live!.paired[id] ? styles.dotOn : styles.dotOff} aria-hidden="true" />
                      <span>{teamName(id)}: {live.live!.paired[id] ? L('telefono collegato', 'phone connected') : L('in attesa', 'waiting')}</span>
                      {live.live!.paired[id] && (
                          <button type="button" className={`btn ${styles.small}`} onClick={() => {
                            if (confirm(L(`Scollegare il telefono di ${teamName(id)}? Potrà ricollegarsi col codice.`, `Disconnect ${teamName(id)}'s phone? It can reconnect with the code.`))) live.unpair(id);
                          }}>{L('Scollega', 'Disconnect')}</button>
                      )}
                    </li>
                ))}
              </ul>
            </div>
        )}

        <KickoffPanel match={match} live={live} teamName={teamName} L={L} />
        {!ended && <PhaseLine live={live} teamName={teamName} L={L} />}

        <div className={wz.teams}>
          {teamIds.map(id => state.teams[id] && (
              <TeamColumn key={id} teamId={id} name={teamName(id)} color={color(id)} team={state.teams[id]} live={live} ended={ended}
                players={players.filter(p => p.team_id === id && !p.unavailable)} playerName={playerName} teamName={teamName} L={L} />
          ))}
        </div>

        {!ended && <HalfControls match={match} live={live} teamName={teamName} L={L} />}

        <details className={styles.timeline} open>
          <summary>{L('Cronologia', 'Timeline')} ({events.length})</summary>
          <ol reversed>
            {[...events].reverse().map(e => (
                <li key={e.id} className={state.voided.includes(e.id) ? styles.voided : undefined}>
                  <span className={styles.source}>{e.source === 'companion' ? <Smartphone size={14} aria-label={L('telefono', 'phone')} /> : e.source === 'server' ? <Dices size={14} aria-label="server" /> : 'WEB'}</span>
                  <span className={styles.what}>{describe(e)}</span>
                  {undoable(e) && !ended && (
                      <button type="button" className={`btn ${styles.small}`} title={L('Annulla', 'Undo')}
                        onClick={() => { if (confirm(L(`Annullare "${describe(e)}"?`, `Undo "${describe(e)}"?`))) live.send('undo', null, { event_id: e.id }); }}>
                        <Undo2 size={15} /> {L('Annulla', 'Undo')}
                      </button>
                  )}
                </li>
            ))}
          </ol>
        </details>

        <div className={styles.danger}>
          <button type="button" className={`btn ${styles.small}`} onClick={() => {
            if (confirm(L('Azzerare la partita dal vivo? Si perdono cronologia e collegamenti dei telefoni. Il referto non cambia.', 'Reset the live match? The timeline and phone connections are lost. The match report does not change.'))) live.reset();
          }}><RotateCcw size={15} /> {L('Azzera il live', 'Reset the live match')}</button>
        </div>
      </section>
  );
}

type Tr = (it: string, en: string) => string;

function Problems({ live, L, teamName }: { live: Live; L: Tr; teamName: (id: string | null) => string }) {
  const { language } = useLanguage();
  if (!live.errors.length) return null;
  return (
      <div className={wz.warn} role="alert">
        {live.errors.slice(-3).map((e, i) => <div key={i}>{problemText(e, language, teamName)}</div>)}
        <button type="button" className={`btn ${styles.small}`} onClick={live.dismissErrors}>{L('Ok', 'Ok')}</button>
      </div>
  );
}

function KickoffPanel({ match, live, teamName, L }: { match: MatchDetails; live: Live; teamName: (id: string | null) => string; L: Tr }) {
  const { language } = useLanguage();
  const { state } = live;
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dice, setDice] = useState<Record<string, string>>({});
  const k = state.last_kickoff;

  const d = (key: string) => Number(dice[key]) || 0;
  const total = d('a') && d('b') ? d('a') + d('b') : 0;
  const receiving = state.kicking_team_id === match.home_team_id ? match.away_team_id : match.home_team_id;

  const roll = async (values?: ManualKickoffDice) => {
    setBusy(true);
    const status = await live.kickoff(values);
    setBusy(false);
    if (status === 'duplicate') alert(L('Il kick-off di questo drive era già stato tirato: vale quello.', 'The kick-off for this drive had already been rolled: that one stands.'));
    if (status) { setManual(false); setDice({}); }
  };

  const submitManual = () => {
    const values: ManualKickoffDice = { dice: [d('a'), d('b')] };
    const rolls: Record<string, number> = {};
    if (d('kick')) rolls[state.kicking_team_id!] = d('kick');
    if (d('recv')) rolls[receiving] = d('recv');
    if (Object.keys(rolls).length) values.rolls = rolls;
    if (d('d3')) values.d3 = d('d3');
    if (d('w1') && d('w2')) values.weather = [d('w1'), d('w2')];
    roll(values);
  };

  const die = (key: string, label: string, max = 6) => (
      <input className={wz.dieInput} inputMode="numeric" aria-label={label} placeholder="?" maxLength={1} value={dice[key] ?? ''}
        onChange={e => { const v = e.target.value.replace(/[^1-9]/g, ''); setDice(prev => ({ ...prev, [key]: v && Number(v) <= max ? v : '' })); }} />
  );

  return (
      <div className={styles.kickoff}>
        {state.status === 'awaiting_kickoff' && !state.turns_done && (
            <div className={wz.dice}>
              <div className={wz.diceHead}>
                <span className={wz.diceLabel}>
                  {L(`Kick-off del drive ${state.drive + 1}: calcia ${teamName(state.kicking_team_id)}`, `Drive ${state.drive + 1} kick-off: ${teamName(state.kicking_team_id)} kicks`)}
                </span>
                <span className={wz.diceActions}>
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={() => roll()}><Dices size={18} /> {L('Tira il kick-off', 'Roll the kick-off')}</button>
                  <button type="button" className="btn" disabled={busy} onClick={() => setManual(m => !m)}>{L('Dadi del tavolo', 'Table dice')}</button>
                </span>
              </div>
              <p className={wz.diceHint}>{L('Il kick-off si tira dopo la deviazione del calcio, con la palla ancora in aria (p. 48). Può tirarlo anche il telefono della squadra che calcia.', 'The kick-off is rolled after the kick deviates, with the ball still in the air (p. 48). The kicking team\'s phone can roll it too.')}</p>
              {manual && (
                  <div className={styles.manual}>
                    <div className={wz.diceRow}>{die('a', 'D6 1')}{die('b', 'D6 2')}{total > 0 && <span className={wz.diceTotal}>= {total}</span>}</div>
                    {NEEDS_ROLLS.includes(total) && (
                        <div className={wz.diceRow}>
                          <span>{L('D6 di', 'D6 for')} {teamName(state.kicking_team_id)}</span>{die('kick', 'D6')}
                          <span>{L('D6 di', 'D6 for')} {teamName(receiving)}</span>{die('recv', 'D6')}
                        </div>
                    )}
                    {NEEDS_D3.includes(total) && <div className={wz.diceRow}><span>D3</span>{die('d3', 'D3', 3)}</div>}
                    {total === 8 && <div className={wz.diceRow}><span>{L('Nuovo Meteo 2D6', 'New Weather 2D6')}</span>{die('w1', 'D6')}{die('w2', 'D6')}</div>}
                    <p className={wz.diceHint}>{L('I dadi lasciati vuoti li tira il sito.', 'Dice left empty are rolled by the site.')}</p>
                    <button type="button" className="btn btn-primary" disabled={busy || !total} onClick={submitManual}>{L('Registra il kick-off', 'Record the kick-off')}</button>
                  </div>
              )}
            </div>
        )}
        {k && state.status !== 'awaiting_kickoff' && (
            <div className={wz.outcome}>
              <span className={wz.outcomeName}>{k.name} <small className={styles.kickDice}>({k.dice.join(' + ')} = {k.total})</small></span>
              <p>{kickoffHeadline(k, id => teamName(id), language)}</p>
              {k.outcomes && <p className={styles.kickRolls}>{k.outcomes.map(o => `${teamName(o.team_id)}: ${o.rerolled ? `${o.rerolled} → ` : ''}${o.roll}${o.total !== o.roll ? ` → ${o.total}` : ''}`).join(' · ')}</p>}
              <p className={styles.kickRolls}>{rowForTotal(getMatchTable('kickoff')!, k.total)?.text[language]}</p>
            </div>
        )}
      </div>
  );
}

// Dove si è nella partita: chi gioca adesso, chi dopo, se il tempo è finito
function PhaseLine({ live, teamName, L }: { live: Live; teamName: (id: string | null) => string; L: Tr }) {
  const { state } = live;
  let text: string;
  if (state.turns_done && state.status === 'awaiting_kickoff') {
    text = L('Il tempo è finito: non ci sono più turni. Inizia il tempo successivo o chiudi la partita.', 'The half is over: no turns left. Start the next half or close the match.');
  } else if (state.status === 'awaiting_kickoff') {
    const halfStart = Object.values(state.teams).every(t => t.turn === 0);
    const halfName = state.half === EXTRA_TIME_HALF ? L('i supplementari', 'extra time') : L(`il ${state.half}° tempo`, `half ${state.half}`);
    text = state.drive === 0
      ? L(`La partita comincia col kick-off: calcia ${teamName(state.kicking_team_id)}. Fino ad allora non si segna niente.`, `The match starts with the kick-off: ${teamName(state.kicking_team_id)} kicks. Nothing can be recorded before that.`)
      : halfStart
        ? L(`Inizia ${halfName}: calcia ${teamName(state.kicking_team_id)}.`, `Starting ${halfName}: ${teamName(state.kicking_team_id)} kicks.`)
        : L(`Drive finito: tocca al kick-off di ${teamName(state.kicking_team_id)}.`, `Drive over: ${teamName(state.kicking_team_id)} kicks off next.`);
  } else if (!state.active_team_id) {
    text = L(`Kick-off fatto: il primo turno è di ${teamName(state.next_turn_team_id)}.`, `Kick-off done: ${teamName(state.next_turn_team_id)} has the first turn.`);
  } else {
    const active = state.teams[state.active_team_id];
    text = state.turns_done
      ? L(`Ultimo turno del tempo: ${teamName(state.active_team_id)} (${active.turn}/${TURNS_PER_HALF}). Quando finisce, si cambia tempo.`, `Last turn of the half: ${teamName(state.active_team_id)} (${active.turn}/${TURNS_PER_HALF}). When it ends, the half is over.`)
      : L(`Turno di ${teamName(state.active_team_id)} (${active.turn}/${TURNS_PER_HALF}); poi tocca a ${teamName(state.next_turn_team_id)}.`, `${teamName(state.active_team_id)}'s turn (${active.turn}/${TURNS_PER_HALF}); ${teamName(state.next_turn_team_id)} is next.`);
  }
  return <p className={wz.note} aria-live="polite">{text}</p>;
}

type TeamProps = {
  teamId: string; name: string; color?: string; team: LiveTeamState; live: Live; ended: boolean;
  players: MatchDetails['homePlayers']; playerName: (id: string) => string | null; teamName: (id: string | null) => string; L: Tr;
};

function TeamColumn({ teamId, name, color, team, live, ended, players, playerName, teamName, L }: TeamProps) {
  const { language } = useLanguage();
  const [player, setPlayer] = useState('');
  const { state } = live;
  const send = live.send;
  // Stesse regole del server: il tasto si spegne e il tooltip dice perché
  const why = (type: LiveEvent['type'], payload: Record<string, unknown> = {}): LiveProblem | null => whyNot(state, type, teamId, ADMIN, payload);
  const tip = (p: LiveProblem | null) => (p ? problemText(p, language, teamName) : undefined);
  const turnWhy = why('turn_started');
  const active = state.active_team_id === teamId;

  const record = (type: StatEvent) => {
    send(type, teamId, player ? { player_id: player } : {});
    setPlayer('');
  };
  const adjust = (delta: number) => {
    const reason = prompt(L(`Correggi i Team Re-roll di ${name} (${delta > 0 ? '+1' : '-1'}). Motivo (facoltativo):`, `Adjust ${name}'s Team Re-rolls (${delta > 0 ? '+1' : '-1'}). Reason (optional):`));
    if (reason !== null) send('rerolls_adjusted', teamId, { delta, ...(reason.trim() ? { reason: reason.trim() } : {}) });
  };
  const stats = Object.entries(team.stats).filter(([, s]) => statLine(s));

  return (
      <div className={`${wz.team} ${active ? styles.activeTeam : ''}`} style={{ '--team-color': color } as React.CSSProperties}>
        <div className={styles.teamHead}>
          <h4 className={wz.teamName}>{name}</h4>
          {active && <span className={styles.turnBadge}>{L('di turno', 'on turn')}</span>}
          <span className={styles.score}>{team.score}</span>
        </div>

        <div className={styles.row}>
          <span>{L('Turno', 'Turn')} <strong className={styles.big}>{team.turn || '—'}</strong> / {TURNS_PER_HALF}</span>
          <button type="button" className={state.next_turn_team_id === teamId && !turnWhy ? 'btn btn-primary' : 'btn'} disabled={ended || !!turnWhy}
            title={tip(turnWhy)} onClick={() => send('turn_started', teamId)}>
            {team.turn >= TURNS_PER_HALF ? L('Turni finiti', 'No turns left') : L(`Inizia il turno ${team.turn + 1}`, `Start turn ${team.turn + 1}`)}
          </button>
        </div>

        <div className={styles.row}>
          <span>Team Re-roll <strong className={styles.big}>{team.rerolls}</strong></span>
          <span className={styles.inline}>
            <button type="button" className="btn" disabled={ended || !!why('reroll_used', { kind: 'team' })} title={tip(why('reroll_used', { kind: 'team' }))}
              onClick={() => send('reroll_used', teamId, { kind: 'team' })}>{L('Usa', 'Use')}</button>
            <button type="button" className={`btn ${styles.small}`} disabled={ended} aria-label={L('Togli un reroll', 'Remove a re-roll')} onClick={() => adjust(-1)}><Minus size={14} /></button>
            <button type="button" className={`btn ${styles.small}`} disabled={ended} aria-label={L('Aggiungi un reroll', 'Add a re-roll')} onClick={() => adjust(1)}><Plus size={14} /></button>
          </span>
        </div>
        {team.drive_rerolls > 0 && (
            <div className={`${styles.row} ${styles.bonus}`}>
              <span>{L('Brilliant Coaching (solo questo drive)', 'Brilliant Coaching (this drive only)')} <strong className={styles.big}>{team.drive_rerolls}</strong></span>
              <button type="button" className="btn" disabled={ended || !!why('reroll_used', { kind: 'drive' })} title={tip(why('reroll_used', { kind: 'drive' }))}
                onClick={() => send('reroll_used', teamId, { kind: 'drive' })}>{L('Usa', 'Use')}</button>
            </div>
        )}
        {team.mascot && (
            <div className={`${styles.row} ${styles.bonus}`}>
              <span>{L('Team Mascot: tira il D6 (4+ ok)', 'Team Mascot: roll the D6 (4+ ok)')}</span>
              <span className={styles.inline}>
                {[1, 2, 3, 4, 5, 6].map(n => (
                    <button key={n} type="button" className={`btn ${styles.die}`} disabled={ended || !!why('reroll_used', { kind: 'mascot', roll: n })}
                      title={tip(why('reroll_used', { kind: 'mascot', roll: n }))} onClick={() => send('reroll_used', teamId, { kind: 'mascot', roll: n })}>{n}</button>
                ))}
              </span>
            </div>
        )}
        {(team.bribes > 0) && (
            <div className={styles.row}>
              <span>Bribe <strong className={styles.big}>{team.bribes}</strong></span>
              <button type="button" className="btn" disabled={ended || !!why('bribe_used')} title={tip(why('bribe_used'))} onClick={() => send('bribe_used', teamId)}>{L('Usa', 'Use')}</button>
            </div>
        )}
        {team.cheering_fans && <p className={wz.note}>{L('Cheering Fans: un assist offensivo in più al primo Block del prossimo turno.', 'Cheering Fans: an extra Offensive Assist on the first Block of the next turn.')}</p>}

        {!ended && (
            <div className={styles.stats}>
              <select value={player} onChange={e => setPlayer(e.target.value)} aria-label={L('Giocatore', 'Player')}>
                <option value="">{L('— giocatore (facoltativo) —', '— player (optional) —')}</option>
                {players.map(p => <option key={p.id} value={p.id}>{p.jersey_number ? `#${p.jersey_number} ` : ''}{p.name}</option>)}
              </select>
              <div className={styles.inline}>
                {STAT_BUTTONS.map(b => (
                    <button key={b.type} type="button" className="btn" title={tip(why(b.type)) ?? b.title[language]}
                      disabled={!!why(b.type)} onClick={() => record(b.type)}>{b.label}</button>
                ))}
              </div>
            </div>
        )}
        {(stats.length > 0 || statLine(team.team_stats)) && (
            <ul className={styles.statList}>
              {stats.map(([id, s]) => <li key={id}><span>{playerName(id) ?? '?'}</span><span>{statLine(s)}</span></li>)}
              {statLine(team.team_stats) && <li><span>{L('Senza giocatore', 'No player')}</span><span>{statLine(team.team_stats)}</span></li>}
            </ul>
        )}
      </div>
  );
}

function HalfControls({ match, live, teamName, L }: { match: MatchDetails; live: Live; teamName: (id: string | null) => string; L: Tr }) {
  const { state } = live;
  const [kicking, setKicking] = useState('');
  const tied = state.teams[match.home_team_id]?.score === state.teams[match.away_team_id]?.score;
  const over = state.turns_done;
  const turns = `${teamName(match.home_team_id)} ${state.teams[match.home_team_id]?.turn ?? 0}, ${teamName(match.away_team_id)} ${state.teams[match.away_team_id]?.turn ?? 0}`;
  // Prima della fine dei turni si cambia tempo solo confermando (turni non segnati, concessione...): arriva come force
  const early = (what: string) => L(`I turni del tempo non sono finiti (${turns} su ${TURNS_PER_HALF}). ${what} comunque?`, `The turns of this half are not over (${turns} of ${TURNS_PER_HALF}). ${what} anyway?`);

  if (state.half === 1) {
    const ask = over ? L('Iniziare il secondo tempo? I Team Re-roll tornano pieni (p. 33).', 'Start the second half? Team Re-rolls are replenished (p. 33).') : early(L('Iniziare il secondo tempo', 'Start the second half'));
    return (
        <div className={wz.actions}>
          <button type="button" className={over ? 'btn btn-primary' : 'btn'} onClick={() => { if (confirm(ask)) live.send('half_started', null, { half: 2, ...(over ? {} : { force: true }) }); }}>
            {L('Inizia il secondo tempo', 'Start the second half')}
          </button>
        </div>
    );
  }
  if (state.half === 2 && state.knockout && tied) {
    return (
        <div className={wz.actions}>
          <select value={kicking} onChange={e => setKicking(e.target.value)} aria-label={L('Chi calcia nei supplementari', 'Who kicks in extra time')}>
            <option value="">{L('Chi calcia? (roll-off, p. 83)', 'Who kicks? (roll-off, p. 83)')}</option>
            {[match.home_team_id, match.away_team_id].map(id => <option key={id} value={id}>{teamName(id)}</option>)}
          </select>
          <button type="button" className={over ? 'btn btn-primary' : 'btn'} disabled={!kicking} onClick={() => {
            if (over || confirm(early(L('Iniziare i supplementari', 'Start extra time')))) {
              live.send('half_started', null, { half: EXTRA_TIME_HALF, kicking_team_id: kicking, ...(over ? {} : { force: true }) });
            }
          }}>
            {L('Inizia i supplementari', 'Start extra time')}
          </button>
        </div>
    );
  }
  if (over) {
    return <p className={wz.note}>{state.half === EXTRA_TIME_HALF
      ? L('Supplementari finiti: chiudi la partita col tasto qui sopra. Se è ancora parità, i rigori si segnano nel referto (p. 83).', 'Extra time is over: close the match with the button above. If it is still a draw, the penalty shoot-out goes in the report (p. 83).')
      : L('Partita finita: chiudila col tasto qui sopra e compila il referto.', 'Match over: close it with the button above and fill in the report.')}</p>;
  }
  return null;
}
