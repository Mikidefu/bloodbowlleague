'use client';
// Chi ha fatto il Touchdown, la Casualty, il passaggio...: si sceglie il giocatore e si conferma.
// Pannello che sale dal basso con un giocatore per riga: numero, nome, ruolo, profilo di partita
// (Prayers compresi) e quello che ha già segnato in questa partita, così non si sbaglia a chi va.

import { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { useConfirm } from '@/components/ConfirmDialog';
import { STAT_KEYS, statLabel } from '@/lib/characteristics';
import { rosterEntries, type RosterEntry } from '@/lib/live/roster';
import { STAT_COLUMN, type LiveTeamState, type StatEvent } from '@/lib/live/types';
import { prayerEffects, type PrayerResult } from '@/lib/prayers';
import type { MatchPlayer } from '@/lib/types';
import styles from './PlayerPicker.module.css';

type Lang = 'it' | 'en';
export type StatInfo = { type: StatEvent; short: string; it: string; en: string };

type Props = {
  stat: StatInfo;
  stats: StatInfo[];                          // per scrivere cosa ha già fatto ogni giocatore
  players: MatchPlayer[];                     // la mia squadra in questa partita
  tally: LiveTeamState['stats'] | undefined;  // statistiche di questa partita, per giocatore
  prayers: Record<string, PrayerResult[]>;
  allowNoPlayer: boolean;
  language: Lang;
  onPick: (playerId: string | null) => void;
  onClose: () => void;
};

export default function PlayerPicker({ stat, stats, players, tally, prayers, allowNoPlayer, language, onPick, onClose }: Props) {
  const confirm = useConfirm();
  const L = (it: string, en: string) => (language === 'it' ? it : en);
  const label = stat[language];
  const entries = useMemo(() => rosterEntries(null, players, prayerEffects(prayers)).filter(e => !e.unavailable), [players, prayers]);

  // Sotto il pannello il tabellone sta fermo
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  const done = (id: string) => stats
      .map(s => ({ s, n: tally?.[id]?.[STAT_COLUMN[s.type]] ?? 0 }))
      .filter(x => x.n > 0)
      .map(x => `${x.n} ${x.s.short}`);

  const pick = async (entry: RosterEntry | null) => {
    const who = entry ? `${entry.jersey_number ? `#${entry.jersey_number} ` : ''}${entry.name}` : null;
    const ok = await confirm({
      title: label,
      message: who
          ? <>{L('Segnare', 'Record')} <b>{label}</b> {L('a', 'for')} <b>{who}</b>{entry!.role ? ` (${entry!.role})` : ''}?</>
          : <>{L('Segnare', 'Record')} <b>{label}</b> {L('senza giocatore?', 'with no player?')}</>,
      confirmLabel: L('Segna', 'Record'),
      cancelLabel: L('Indietro', 'Back'),
    });
    if (ok) onPick(entry?.id ?? null);
  };

  return (
      <div className={styles.backdrop} onClick={onClose}>
        <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={`${label}: ${L('chi è stato?', 'who was it?')}`} onClick={e => e.stopPropagation()}>
          <header className={styles.head}>
            <span className={styles.short} aria-hidden="true">{stat.short}</span>
            <span className={styles.headText}>
              <strong>{label}</strong>
              <span>{L('Chi è stato?', 'Who was it?')}</span>
            </span>
            <button type="button" className={styles.close} aria-label={L('Chiudi', 'Close')} onClick={onClose}><X size={24} /></button>
          </header>

          <ul className={styles.list}>
            {entries.map(e => {
              const already = done(e.id);
              return (
                  <li key={e.id}>
                    <button type="button" className={styles.row} onClick={() => pick(e)}>
                      <span className={styles.jersey}>{e.jersey_number ?? '·'}</span>
                      <span className={styles.who}>
                        <strong className={styles.name}>{e.name}</strong>
                        <span className={styles.role}>
                          {e.role}
                          {e.advancements > 0 && <span className={styles.stars}> {'★'.repeat(e.advancements)}</span>}
                          {e.journeyman && <span className={styles.flag}> · Journeyman</span>}
                        </span>
                      </span>
                      {already.length > 0 && <span className={styles.already} aria-label={L(`In questa partita: ${already.join(', ')}`, `This match: ${already.join(', ')}`)}>{already.join(' · ')}</span>}
                      <span className={styles.profile} aria-label={STAT_KEYS.map(k => `${statLabel(k)} ${e[k]}`).join(', ')}>
                        {STAT_KEYS.map(k => (
                            <span key={k} className={(k === 'ma' || k === 'av') && e.base[k] !== e[k] ? styles.changed : undefined} aria-hidden="true">
                              <small>{statLabel(k)}</small>{e[k]}
                            </span>
                        ))}
                      </span>
                    </button>
                  </li>
              );
            })}
          </ul>

          <footer className={styles.foot}>
            {allowNoPlayer && <button type="button" className="btn" onClick={() => pick(null)}>{L('Senza giocatore', 'No player')}</button>}
            <button type="button" className="btn btn-slate" onClick={onClose}>{L('Annulla', 'Cancel')}</button>
          </footer>
        </div>
      </div>
  );
}
