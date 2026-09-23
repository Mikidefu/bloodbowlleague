'use client';
// Tabellone della partita dal vivo: il "versus" della pagina partita in piccolo.
// Due metà tinte coi colori delle squadre divise da un taglio d'ottone, stemmi con anello, punteggio grande
// e una riga tecnica (tempo, drive, meteo). Lo usano il tabellone dell'admin e la companion sul telefono.

import type { ReactNode } from 'react';
import { Shield } from 'lucide-react';
import styles from './LiveScoreboard.module.css';

export type ScoreboardSide = {
  name: string;
  logo: string | null;
  color: string | null;
  score: number;
  active?: boolean;     // il suo turno è in corso
  mine?: boolean;       // la squadra di questo telefono
};

type Props = {
  home: ScoreboardSide;
  away: ScoreboardSide;
  meta: string[];                  // tempo, drive, meteo...
  status: 'live' | 'ended';
  statusLabel: string;             // "LIVE" / "Chiusa"
  activeLabel: string;             // "di turno"
  sync?: ReactNode;
  action?: ReactNode;
  compact?: boolean;               // telefono: più basso, fisso in cima
};

function Side({ side, align, activeLabel }: { side: ScoreboardSide; align: 'home' | 'away'; activeLabel: string }) {
  return (
      <div className={`${styles.side} ${align === 'away' ? styles.away : ''} ${side.mine ? styles.mine : ''}`}
        style={{ '--team-color': side.color ?? undefined } as React.CSSProperties}>
        <span className={`team-crest ${styles.crest}`}>
          {side.logo ? <img src={side.logo} alt="" /> : <Shield size={22} aria-hidden="true" />}
        </span>
        <span className={styles.nameWrap}>
          <span className={styles.name}>{side.name}</span>
          {side.active && <span className={`tag ${styles.turnTag}`}>{activeLabel}</span>}
        </span>
      </div>
  );
}

export default function LiveScoreboard({ home, away, meta, status, statusLabel, activeLabel, sync, action, compact }: Props) {
  return (
      <section className={`${styles.board} ${compact ? styles.compact : ''}`}
        style={{ '--home-color': home.color ?? undefined, '--away-color': away.color ?? undefined } as React.CSSProperties}
        aria-label={`${home.name} ${home.score} – ${away.score} ${away.name}`}>
        <span className={styles.tintHome} aria-hidden="true" />
        <span className={styles.tintAway} aria-hidden="true" />
        <span className={styles.split} aria-hidden="true" />

        <div className={styles.faceoff}>
          <Side side={home} align="home" activeLabel={activeLabel} />
          <div className={styles.score} aria-hidden="true">
            {/* il separatore è il taglio d'ottone che passa tra i due numeri */}
            <span>{home.score}</span><span>{away.score}</span>
          </div>
          <Side side={away} align="away" activeLabel={activeLabel} />
        </div>

        <div className={styles.meta}>
          <span className={`tag ${status === 'live' ? 'tag-red' : ''} ${styles.status}`}>
            {status === 'live' && <span className={styles.dot} aria-hidden="true" />}{statusLabel}
          </span>
          {meta.filter(Boolean).map(m => <span key={m} className={styles.metaItem}>{m}</span>)}
          {(sync || action) && <span className={styles.end}>{sync}{action}</span>}
        </div>
      </section>
  );
}
