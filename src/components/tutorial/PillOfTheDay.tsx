'use client';
import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, GraduationCap } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { TRACKS } from '@/lib/tutorial';
import TutorialDiagram from './TutorialDiagram';
import styles from './PillOfTheDay.module.css';

// La pillola del giorno in home: una sola schermata di regolamento, scelta dal calendario.
// La scelta avviene dopo il mount: la data del server e quella di chi legge non coincidono
// sempre, e un disallineamento in idratazione si vedrebbe come uno sfarfallio.

// Solo le regole: il percorso Formazione spiega il sito e non ha pagine del Rulebook
const ALL = TRACKS.filter(track => !track.guide).flatMap(track => track.pills.map((pill, i) => ({ track, pill, step: i + 1 })));

function dayNumber(now: Date) {
  const start = Date.UTC(now.getFullYear(), 0, 0);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((today - start) / 86_400_000);
}

// Il calendario e' una sorgente esterna: sul server non lo leggiamo (null),
// sul client resta lo stesso numero per tutta la giornata.
const subscribeDay = () => () => {};
const today = () => dayNumber(new Date());

export default function PillOfTheDay() {
  const { language, t } = useLanguage();
  const day = useSyncExternalStore(subscribeDay, today, () => null);

  if (day === null || !ALL.length) return null;
  const { track, pill, step } = ALL[day % ALL.length];

  return (
      <article className={`card ${styles.card}`}>
        <div className={styles.text}>
          <span className={styles.kicker}>
            <GraduationCap size={16} aria-hidden="true" /> {t.home.pillOfTheDay}
          </span>
          <h3 className={styles.title}>{pill.title[language]}</h3>
          <p className={styles.body}>{pill.body[language][0]}</p>
          <div className={styles.meta}>
            <span className={styles.page}><BookOpen size={14} aria-hidden="true" /> {pill.page}</span>
            <span className={styles.track}>{track.number} · {track.title[language]}</span>
          </div>
          <Link href={`/tutorial/${track.id}#${step}`} className="btn btn-primary">
            {t.home.pillOfTheDayCta} <ArrowRight size={18} />
          </Link>
        </div>

        <div className={styles.figure}>
          <TutorialDiagram id={pill.diagram} lang={language} />
        </div>
      </article>
  );
}
