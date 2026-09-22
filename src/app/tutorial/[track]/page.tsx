'use client';
import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, GraduationCap, XCircle } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import PageHeader from '@/components/brand/PageHeader';
import TutorialDiagram from '@/components/tutorial/TutorialDiagram';
import { TRACKS, getTrack } from '@/lib/tutorial';
import { useTutorialProgress } from '@/lib/tutorialProgress';
import styles from '../Tutorial.module.css';

export default function TrackPage({ params }: { params: Promise<{ track: string }> }) {
  const { track: trackId } = use(params);
  const router = useRouter();
  const { language, t } = useLanguage();
  const { markPill, markQuiz, isQuizDone, readCount } = useTutorialProgress();

  const track = getTrack(trackId);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const pills = useMemo(() => track?.pills ?? [], [track]);
  const onQuiz = index >= pills.length;
  const pill = onQuiz ? null : pills[index];

  // La pillola si segna come letta appena viene mostrata
  useEffect(() => {
    if (track && pill) markPill(track.id, pill.id);
  }, [track, pill, markPill]);

  useEffect(() => {
    if (!track) router.replace('/tutorial');
  }, [track, router]);

  if (!track) return null;

  const quizDone = track.quiz.every(q => answers[q.id] === q.answer);
  const nextTrack = TRACKS[TRACKS.findIndex(x => x.id === track.id) + 1];

  // Lo stato del quiz si aggiorna qui nel gestore del click, non dentro l'updater di setAnswers:
  // markQuiz scrive nello store dell'avanzamento e React vieta di farlo durante il render.
  const answer = (questionId: string, option: number) => {
    if (answers[questionId] !== undefined) return;
    const next = { ...answers, [questionId]: option };
    setAnswers(next);
    if (track.quiz.every(q => next[q.id] === q.answer)) markQuiz(track.id);
  };

  const step = onQuiz ? pills.length + 1 : index + 1;
  const percent = Math.round((step / (pills.length + 1)) * 100);

  return (
      <div className={styles.page}>
        <PageHeader
            kicker={`${t.tutorial.title} // ${track.number}`}
            title={track.title[language]}
            subtitle={track.summary[language]}
            icon={<GraduationCap size={44} />}
            actions={<Link href="/tutorial" className="btn"><ArrowLeft size={18} /> <span>{t.tutorial.allTracks}</span></Link>}
        />

        <div className={styles.readerBar}>
          <div className={styles.bar}><span style={{ width: `${percent}%` }} /></div>
          <span className={styles.readerStep}>
            {onQuiz ? t.tutorial.quiz : t.tutorial.pillStep.replace('{step}', String(index + 1)).replace('{total}', String(pills.length))}
          </span>
        </div>

        {pill && (
            <article className={`card ${styles.pill}`}>
              <header className={styles.pillHead}>
                <h2 className={styles.pillTitle}>{pill.title[language]}</h2>
                <span className={styles.pillPage}><BookOpen size={14} aria-hidden="true" /> {pill.page}</span>
              </header>

              <div className={styles.pillBody}>
                <div className={styles.pillText}>
                  {pill.body[language].map((paragraph, i) => <p key={i}>{paragraph}</p>)}
                  {pill.link && (
                      <Link href={pill.link.href} className={styles.pillLink}>
                        {pill.link.label[language]} <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                  )}
                </div>

                <div className={styles.pillMedia}>
                  <TutorialDiagram id={pill.diagram} lang={language} />
                  {pill.video && (
                      // Il video compare solo se il file esiste in public/tutorial/
                      <video className={styles.video} controls preload="none" playsInline src={`/tutorial/${pill.video}`} />
                  )}
                </div>
              </div>
            </article>
        )}

        {onQuiz && (
            <article className={`card ${styles.pill}`}>
              <h2 className={styles.pillTitle}>{t.tutorial.quizTitle}</h2>
              <p className={styles.quizIntro}>{t.tutorial.quizIntro}</p>

              {track.quiz.map(question => {
                const given = answers[question.id];
                return (
                    <div key={question.id} className={styles.question}>
                      <h3 className={styles.questionText}>{question.question[language]}</h3>
                      <div className={styles.options}>
                        {question.options.map((option, i) => {
                          const chosen = given === i;
                          const correct = i === question.answer;
                          const state = given === undefined ? '' : correct ? styles.optionRight : chosen ? styles.optionWrong : '';
                          return (
                              <button key={i} type="button" className={`btn ${styles.option} ${state}`}
                                      disabled={given !== undefined} onClick={() => answer(question.id, i)}>
                                <span>{option[language]}</span>
                                {given !== undefined && correct && <CheckCircle2 size={16} aria-hidden="true" />}
                                {given !== undefined && chosen && !correct && <XCircle size={16} aria-hidden="true" />}
                              </button>
                          );
                        })}
                      </div>
                      {given !== undefined && <p className={styles.why}>{question.why[language]}</p>}
                    </div>
                );
              })}

              {quizDone && (
                  <p className={styles.quizDone}>
                    <CheckCircle2 size={18} aria-hidden="true" /> {t.tutorial.quizDone}
                  </p>
              )}
            </article>
        )}

        <nav className={styles.nav} aria-label={t.tutorial.title}>
          <button type="button" className="btn" disabled={index === 0} onClick={() => setIndex(i => Math.max(0, i - 1))}>
            <ArrowLeft size={18} /> <span>{t.tutorial.prev}</span>
          </button>

          {!onQuiz ? (
              <button type="button" className="btn btn-primary" onClick={() => setIndex(i => i + 1)}>
                <span>{index === pills.length - 1 ? t.tutorial.goQuiz : t.tutorial.next}</span> <ArrowRight size={18} />
              </button>
          ) : nextTrack ? (
              <Link href={`/tutorial/${nextTrack.id}`} className="btn btn-primary" onClick={() => setIndex(0)}>
                <span>{t.tutorial.nextTrack.replace('{track}', nextTrack.title[language])}</span> <ArrowRight size={18} />
              </Link>
          ) : (
              <Link href="/tutorial" className="btn btn-primary">
                <span>{t.tutorial.finish}</span> <ArrowRight size={18} />
              </Link>
          )}
        </nav>

        <p className={styles.footNote}>
          {t.tutorial.trackProgress
              .replace('{read}', String(readCount(track.id)))
              .replace('{total}', String(pills.length))}
          {isQuizDone(track.id) ? ` · ${t.tutorial.quizPassed}` : ''}
        </p>
      </div>
  );
}
