'use client';
import { use, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, GraduationCap, MonitorSmartphone, XCircle } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import PageHeader from '@/components/brand/PageHeader';
import TutorialDiagram from '@/components/tutorial/TutorialDiagram';
import PillBody from '@/components/tutorial/PillBody';
import { TRACKS, getTrack } from '@/lib/tutorial';
import { useTutorialProgress } from '@/lib/tutorialProgress';
import styles from '../Tutorial.module.css';

// Dalla home si arriva con /tutorial/<percorso>#<numero della pillola>.
// L'ancora si legge come sorgente esterna (come la lingua e l'avanzamento):
// niente setState dentro un effect e nessun disallineamento con l'idratazione.
const subscribeHash = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
};

function pillFromHash(hash: string): number | null {
  const n = Number(hash.slice(1));
  return Number.isInteger(n) && n > 0 ? n - 1 : null;
}

export default function TrackPage({ params }: { params: Promise<{ track: string }> }) {
  const { track: trackId } = use(params);
  const router = useRouter();
  const { language, t } = useLanguage();
  const { markPill, markQuiz, isQuizDone, isPillRead, readCount } = useTutorialProgress();

  const track = getTrack(trackId);
  const [chosen, setChosen] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => '');

  const pills = useMemo(() => track?.pills ?? [], [track]);
  // La pillola aperta: quella scelta con i pulsanti, altrimenti quella dell'ancora
  const index = Math.min(chosen ?? pillFromHash(hash) ?? 0, pills.length);
  const setIndex = setChosen;
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

  return (
      <div className={styles.page}>
        <PageHeader
            kicker={`${t.tutorial.title} // ${track.number}`}
            title={track.title[language]}
            subtitle={track.summary[language]}
            icon={<GraduationCap size={44} />}
            actions={<Link href="/tutorial" className="btn"><ArrowLeft size={18} /> <span>{t.tutorial.allTracks}</span></Link>}
        />

        {/* Una tacca per pillola più il quiz: si vede a colpo d'occhio dove sei e ci si salta sopra */}
        <div className={styles.readerBar}>
          <div className={styles.steps}>
            {pills.map((p, i) => (
                <button
                    key={p.id}
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={t.tutorial.pillStep.replace('{step}', String(i + 1)).replace('{total}', String(pills.length))}
                    aria-current={i === index ? 'step' : undefined}
                    className={`${styles.step} ${i === index ? styles.stepCurrent : isPillRead(track.id, p.id) ? styles.stepRead : ''}`}
                />
            ))}
            <button
                type="button"
                onClick={() => setIndex(pills.length)}
                aria-label={t.tutorial.quiz}
                aria-current={onQuiz ? 'step' : undefined}
                className={`${styles.step} ${onQuiz ? styles.stepCurrent : isQuizDone(track.id) ? styles.stepRead : ''}`}
            />
          </div>
          <span className={styles.readerStep}>
            {onQuiz ? t.tutorial.quiz : t.tutorial.pillStep.replace('{step}', String(index + 1)).replace('{total}', String(pills.length))}
          </span>
        </div>

        {pill && (
            <article className={`card ${styles.pill}`}>
              <header className={styles.pillHead}>
                <h2 className={styles.pillTitle}>{pill.title[language]}</h2>
                {pill.page && <span className={styles.pillPage}><BookOpen size={14} aria-hidden="true" /> {pill.page}</span>}
                {pill.app && <span className={styles.pillPage}><MonitorSmartphone size={14} aria-hidden="true" /> {pill.app[language]}</span>}
              </header>

              <div className={styles.pillBody}>
                <div>
                  <PillBody paragraphs={pill.body[language]} lang={language} />
                  {pill.link && (
                      <Link href={pill.link.href} className={styles.pillLink}>
                        {pill.link.label[language]} <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                  )}
                </div>

                <div className={styles.pillMedia}>
                  {pill.gallery && (
                      <div className={styles.shotGrid}>
                        {pill.gallery.map(s => (
                            <figure key={s.src} className={styles.shot}>
                              <img src={s.src} alt={s.label[language]} loading="lazy" />
                              <figcaption className={styles.shotLabel}>{s.label[language]}</figcaption>
                              {s.note && <span className={styles.shotNote}>{s.note[language]}</span>}
                            </figure>
                        ))}
                      </div>
                  )}
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
              <header className={styles.pillHead}>
                <h2 className={styles.pillTitle}>{t.tutorial.quizTitle}</h2>
                <span className={styles.pillPage}>{track.title[language]}</span>
              </header>
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
                    <CheckCircle2 size={22} aria-hidden="true" /> {t.tutorial.quizDone}
                  </p>
              )}
            </article>
        )}

        <nav className={styles.nav} aria-label={t.tutorial.title}>
          <button type="button" className="btn" disabled={index === 0} onClick={() => setIndex(Math.max(0, index - 1))}>
            <ArrowLeft size={18} /> <span>{t.tutorial.prev}</span>
          </button>

          {!onQuiz ? (
              <button type="button" className="btn btn-primary" onClick={() => setIndex(index + 1)}>
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
