'use client';
// Il Meteo attuale sul telefono: una scheda chiusa sotto il tabellone, che aperta spiega cosa cambia in campo.
// È quello del pre-partita finché un kick-off Changing Weather non lo ritira (p. 48): allora si aggiorna da solo.

import { ChevronDown } from 'lucide-react';
import { getMatchTable, rowForTotal, type Lang } from '@/lib/matchTables';
import styles from './Kickoff.module.css';

const WEATHER_PAGE = getMatchTable('weather')!.page;

// Cosa tenere a mente al tavolo, con parole nostre: il riassunto della regola è già nella tabella
const TIPS: Record<string, Record<Lang, string>> = {
  'Sweltering Heat': {
    it: 'Ricordatevi il D3 a fine di ogni drive: tieni in panchina qualche riserva, perché chi esce per il caldo salta il drive dopo.',
    en: 'Remember the D3 at the end of every drive: keep some Reserves on the bench, since whoever drops from the heat sits out the next drive.',
  },
  'Very Sunny': {
    it: 'Vale per ogni test di Passing Ability: passaggi, Throw Team-mate e bombe sono più rischiosi. Meglio passaggi corti e pochi lanci lunghi.',
    en: 'It applies to every Passing Ability test: passes, Throw Team-mate and bombs are riskier. Prefer short passes and few long throws.',
  },
  'Perfect Conditions': {
    it: 'Si gioca senza modificatori dovuti al tempo.',
    en: 'No weather modifiers: play as normal.',
  },
  'Pouring Rain': {
    it: 'Raccogliere la palla da terra, riceverla e intercettare costano un punto in più: occhio alla palla dopo il kick-off e ai passaggi su chi è marcato.',
    en: 'Picking up the ball, catching it and intercepting are one point harder: watch the ball after the kick-off and passes to Marked players.',
  },
  Blizzard: {
    it: 'Niente Long Pass né Long Bomb, e ogni Rush è più difficile: avanza a piccoli passi e porta la palla a mano.',
    en: 'No Long Passes or Long Bombs, and every Rush is harder: advance in short steps and carry the ball.',
  },
};

type Props = {
  roll: number;
  changed: boolean;    // ritirato da un kick-off Changing Weather
  language: Lang;
};

export default function WeatherCard({ roll, changed, language }: Props) {
  const L = (it: string, en: string) => (language === 'it' ? it : en);
  const row = rowForTotal(getMatchTable('weather')!, roll);
  if (!row) return null;
  const tip = TIPS[row.name]?.[language];

  return (
      <details className={`panel-slate ${styles.card}`}>
        <summary>
          <span className={styles.head}>
            <span className={styles.micro}>
              {L('Meteo', 'Weather')} · 2D6 = {roll}{changed ? ` · ${L('cambiato al kick-off', 'changed at kick-off')}` : ''}
            </span>
            <ChevronDown size={22} className={styles.chevron} aria-hidden="true" />
          </span>
          <strong className={`${styles.name} ${styles.nameSmall}`}>{row.name}</strong>
          <span className={styles.headline}>{row.tone === 'neutral' ? L('Nessun effetto sul gioco', 'No effect on play') : L('Tocca a entrambe le squadre: aprila per i dettagli', 'Affects both teams: open for details')}</span>
        </summary>

        <div className={styles.cardBody}>
          <div>
            <span className={styles.micro}>{L(`La regola (p. ${WEATHER_PAGE})`, `The rule (p. ${WEATHER_PAGE})`)}</span>
            <p className={styles.rule}>{row.text[language]}</p>
          </div>
          {tip && row.tone !== 'neutral' && (
              <p className={`${styles.forMe} ${styles.bad}`}>
                <span className="tag tag-red">{L('In campo', 'On the pitch')}</span>
                {tip}
              </p>
          )}
          <div>
            <span className={styles.micro}>{L('Quando cambia', 'When it changes')}</span>
            <p className={styles.rule}>
              {changed
                ? L('Questo Meteo viene da un kick-off Changing Weather. ', 'This Weather comes from a Changing Weather kick-off. ')
                : L('È il Meteo tirato nel pre-partita. ', 'This is the Weather rolled in the pre-game. ')}
              {L('Se al kick-off esce Changing Weather (8) si ritira il 2D6 e questa scheda si aggiorna da sola.',
                'If the kick-off is Changing Weather (8) the 2D6 is rolled again and this card updates by itself.')}
            </p>
          </div>
        </div>
      </details>
  );
}
