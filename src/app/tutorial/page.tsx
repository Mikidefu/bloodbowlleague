'use client';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, GraduationCap, RotateCcw } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import PageHeader from '@/components/brand/PageHeader';
import SectionTitle from '@/components/brand/SectionTitle';
import { TRACKS, totalPills } from '@/lib/tutorial';
import { useTutorialProgress } from '@/lib/tutorialProgress';
import styles from './Tutorial.module.css';

export default function TutorialPage() {
  const { language, t } = useLanguage();
  const { readCount, isQuizDone, progress, reset } = useTutorialProgress();

  const readTotal = progress.pills.length;
  const percent = totalPills ? Math.round((readTotal / totalPills) * 100) : 0;

  return (
      <div className={styles.page}>
        <PageHeader
            kicker="BLOODBOWL LEAGUE"
            title={t.tutorial.title}
            subtitle={t.tutorial.subtitle}
            icon={<GraduationCap size={44} />}
            actions={readTotal > 0 ? (
                <button type="button" className="btn" onClick={reset}>
                  <RotateCcw size={18} /> <span>{t.tutorial.reset}</span>
                </button>
            ) : undefined}
        />

        <section className={`card ${styles.intro}`}>
          <p className={styles.introText}>{t.tutorial.intro}</p>
          <div className={styles.meter}>
            <span className={styles.meterValue}>{percent}%</span>
            <div className={styles.bar}><span style={{ width: `${percent}%` }} /></div>
            <span className={styles.meterLabel}>
              {t.tutorial.readCount.replace('{read}', String(readTotal)).replace('{total}', String(totalPills))}
            </span>
          </div>
        </section>

        <SectionTitle index="01" micro={t.tutorial.tracksMicro} title={t.tutorial.tracks} />

        <div className={styles.trackGrid}>
          {TRACKS.map(track => {
            const read = readCount(track.id);
            const done = read >= track.pills.length && isQuizDone(track.id);
            return (
                <Link key={track.id} href={`/tutorial/${track.id}`} className={`${styles.trackCard} ${done ? styles.trackDone : ''}`}>
                  <span className={styles.trackNumber} aria-hidden="true">{track.number}</span>
                  <h3 className={styles.trackTitle}>{track.title[language]}</h3>
                  <p className={styles.trackSummary}>{track.summary[language]}</p>
                  <div className={styles.trackFooter}>
                    <span className={styles.trackMeta}>
                      {done && <CheckCircle2 size={16} aria-hidden="true" />}
                      {t.tutorial.pillCount.replace('{read}', String(read)).replace('{total}', String(track.pills.length))}
                    </span>
                    <span className={styles.trackGo}>{t.tutorial.start} <ArrowRight size={16} aria-hidden="true" /></span>
                  </div>
                  <div className={styles.bar}><span style={{ width: `${(read / track.pills.length) * 100}%` }} /></div>
                </Link>
            );
          })}
        </div>

        <p className={styles.footNote}>{t.tutorial.footNote}</p>
      </div>
  );
}
